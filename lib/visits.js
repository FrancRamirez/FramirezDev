// lib/visits.js
//
// Lógica del contador de visitas:
//   - identifica al visitante (usuario logueado vía sesión, o anónimo vía
//     cookie `visitor_id`, que lo identifica como la misma persona a lo
//     largo del tiempo aunque abra muchas sesiones distintas)
//   - la anti-inflación NO se controla acá: la controla el cliente
//     (js/visitas.js) con sessionStorage, que se borra solo al cerrar la
//     pestaña/ventana. Mientras el navegador no llame a registrarVisita(),
//     esta función ni se entera — por eso cada llamada acá inserta una
//     fila sin preguntar nada. Si el visitante cierra y vuelve a entrar
//     (nueva sessionStorage), el cliente vuelve a llamar y se suma otra
//     visita, aunque sea el mismo día
//   - guarda cada visita contada en la tabla `visitas`, con su `periodo`
//     (YYYY-MM en huso horario de Argentina) para poder calcular el total
//     del mes actual y consultar el histórico de meses anteriores, además
//     de un total general (histórico, nunca se reinicia)
//
// El "reinicio mensual" del contador mensual no requiere ningún job/cron:
// el total de un mes es simplemente COUNT(*) WHERE periodo = ese mes, así
// que el mes nuevo arranca en 0 solo, y el detalle de los meses viejos
// queda intacto en la misma tabla para siempre. El contador general es el
// COUNT(*) de toda la tabla, sin filtrar por periodo.

import crypto from 'crypto';
import { getPool } from './db.js';

const VISITOR_COOKIE_NAME = 'visitor_id';
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2; // 2 años
const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

// Tabla `visitas` a crear en TiDB (documentación, no se ejecuta):
//
// CREATE TABLE visitas (
//   id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
//   tipo ENUM('Usuario', 'Visitante') NOT NULL,
//   usuario_id BIGINT UNSIGNED NULL,
//   visitante_id VARCHAR(64) NULL,
//   ip VARCHAR(45) NULL,
//   user_agent VARCHAR(255) NULL,
//   periodo CHAR(7) NOT NULL,
//   fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
//   FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
//   INDEX idx_periodo (periodo),
//   INDEX idx_usuario_periodo (usuario_id, periodo),
//   INDEX idx_visitante_periodo (visitante_id, periodo)
// ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

// ---------- Cookie de visitante anónimo ----------

export function getVisitorIdFromCookies(req) {
  const header = req.headers.cookie;
  if (!header) return null;

  const match = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE_NAME}=`));

  if (!match) return null;
  return decodeURIComponent(match.slice(VISITOR_COOKIE_NAME.length + 1));
}

export function buildVisitorCookie(visitorId) {
  const parts = [
    `${VISITOR_COOKIE_NAME}=${encodeURIComponent(visitorId)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${VISITOR_COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV !== 'development') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

// ---------- Periodo (YYYY-MM) ----------

// Calculado en huso horario de Argentina para que el corte de mes
// coincida con el mes calendario local, sin importar en qué huso
// horario corra la función serverless (Vercel corre en UTC).
export function getPeriodoActual(fecha = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
  });
  const partes = formatter.formatToParts(fecha);
  const year = partes.find((p) => p.type === 'year').value;
  const month = partes.find((p) => p.type === 'month').value;
  return `${year}-${month}`;
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

// ---------- Registro de visitas ----------

// Inserta una visita en la tabla. Se asume que quien llama (el endpoint
// /api/visitas/registrar) ya decidió que corresponde contarla — el
// criterio de "una vez por sesión de navegador" vive en el cliente
// (sessionStorage), no acá.
// `username` es el usuario de la sesión activa, o null/undefined si es un
// visitante anónimo. Devuelve { visitorId }.
export async function registrarVisita(req, username) {
  const pool = getPool();
  const periodo = getPeriodoActual();
  const ip = getClientIp(req);
  const userAgent = (req.headers['user-agent'] || '').slice(0, 255);
  const esUsuario = Boolean(username);

  let visitorId = getVisitorIdFromCookies(req);
  if (!esUsuario && !visitorId) {
    visitorId = crypto.randomUUID();
  }

  if (esUsuario) {
    await pool.execute(
      `INSERT INTO visitas (tipo, usuario_id, ip, user_agent, periodo)
       VALUES ('Usuario', (SELECT id FROM usuarios WHERE usuario = ? LIMIT 1), ?, ?, ?)`,
      [username, ip, userAgent, periodo]
    );
  } else {
    await pool.execute(
      `INSERT INTO visitas (tipo, visitante_id, ip, user_agent, periodo)
       VALUES ('Visitante', ?, ?, ?, ?)`,
      [visitorId, ip, userAgent, periodo]
    );
  }

  return { visitorId };
}

// ---------- Consultas ----------

export async function obtenerTotalPeriodo(periodo = getPeriodoActual()) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT COUNT(*) AS total FROM visitas WHERE periodo = ?',
    [periodo]
  );
  return rows[0].total;
}

// Contador consecutivo: histórico completo, nunca se reinicia.
export async function obtenerTotalGeneral() {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM visitas');
  return rows[0].total;
}

export async function obtenerDetallePeriodo(periodo = getPeriodoActual()) {
  const pool = getPool();

  const [totales] = await pool.execute(
    `SELECT
       COUNT(*) AS total,
       SUM(tipo = 'Usuario') AS totalUsuarios,
       SUM(tipo = 'Visitante') AS totalVisitantes
     FROM visitas WHERE periodo = ?`,
    [periodo]
  );

  const [porUsuario] = await pool.execute(
    `SELECT u.usuario AS usuario, COUNT(*) AS visitas, MAX(v.fecha_hora) AS ultimaVisita
     FROM visitas v
     JOIN usuarios u ON u.id = v.usuario_id
     WHERE v.periodo = ? AND v.tipo = 'Usuario'
     GROUP BY u.usuario
     ORDER BY visitas DESC`,
    [periodo]
  );

  const [porVisitante] = await pool.execute(
    `SELECT visitante_id AS visitanteId, COUNT(*) AS visitas, MAX(fecha_hora) AS ultimaVisita
     FROM visitas
     WHERE periodo = ? AND tipo = 'Visitante'
     GROUP BY visitante_id
     ORDER BY visitas DESC`,
    [periodo]
  );

  return {
    periodo,
    total: totales[0].total || 0,
    totalUsuarios: totales[0].totalUsuarios || 0,
    totalVisitantes: totales[0].totalVisitantes || 0,
    porUsuario,
    porVisitante,
  };
}

export async function obtenerPeriodosDisponibles() {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT DISTINCT periodo FROM visitas ORDER BY periodo DESC'
  );
  const periodos = rows.map((r) => r.periodo);
  // El mes actual siempre tiene que estar disponible, aunque todavía
  // no tenga ninguna visita registrada.
  const actual = getPeriodoActual();
  if (!periodos.includes(actual)) {
    periodos.unshift(actual);
  }
  return periodos;
}
