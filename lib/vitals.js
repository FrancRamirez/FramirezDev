// lib/vitals.js
//
// Guarda y resume las métricas de Core Web Vitals que manda js/vitals.js.
// Una fila por visita (página vista). No se guarda IP, user agent ni ningún
// identificador del visitante: solo métricas anónimas.
//
// Tabla `web_vitals` a crear en TiDB (ver docs/web_vitals.sql):
//
// CREATE TABLE web_vitals (
//   id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
//   pagina VARCHAR(120) NOT NULL,
//   lcp FLOAT NULL,
//   cls FLOAT NULL,
//   inp FLOAT NULL,
//   fcp FLOAT NULL,
//   ttfb FLOAT NULL,
//   dispositivo ENUM('mobile','tablet','desktop') NOT NULL,
//   conexion VARCHAR(10) NULL,
//   fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
//   INDEX idx_fecha (fecha_hora),
//   INDEX idx_pagina_fecha (pagina, fecha_hora)
// ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

import { getPool } from './db.js';

const DISPOSITIVOS = ['mobile', 'tablet', 'desktop'];

// Umbrales oficiales de Google (bueno / necesita mejora / pobre).
export const UMBRALES = {
  lcp: [2500, 4000],
  inp: [200, 500],
  cls: [0.1, 0.25],
  fcp: [1800, 3000],
  ttfb: [800, 1800],
};

// Devuelve un número finito dentro de [0, max] o null. Evita que alguien
// ensucie la tabla mandando basura al endpoint público.
function numero(valor, max) {
  const n = Number(valor);
  if (valor === null || valor === undefined || !Number.isFinite(n) || n < 0) {
    return null;
  }
  return Math.min(n, max);
}

export function sanitizarPayload(body) {
  let data = body;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;

  const pagina = typeof data.pagina === 'string' ? data.pagina.slice(0, 120) : '';
  if (!pagina.startsWith('/')) return null;
  if (!DISPOSITIVOS.includes(data.dispositivo)) return null;

  const fila = {
    pagina,
    lcp: numero(data.lcp, 60000),
    cls: numero(data.cls, 10),
    inp: numero(data.inp, 60000),
    fcp: numero(data.fcp, 60000),
    ttfb: numero(data.ttfb, 60000),
    dispositivo: data.dispositivo,
    conexion:
      typeof data.conexion === 'string' && /^[a-z0-9-]{1,10}$/i.test(data.conexion)
        ? data.conexion
        : null,
  };

  // Una fila sin ninguna métrica no aporta nada.
  if (fila.lcp === null && fila.fcp === null) return null;
  return fila;
}

export async function registrarVitals(fila) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO web_vitals (pagina, lcp, cls, inp, fcp, ttfb, dispositivo, conexion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fila.pagina,
      fila.lcp,
      fila.cls,
      fila.inp,
      fila.fcp,
      fila.ttfb,
      fila.dispositivo,
      fila.conexion,
    ]
  );
}

// p75 por métrica (el percentil que usa Google para evaluar Core Web Vitals),
// calculado en JS para no depender de funciones de percentil de la base.
function percentil75(valores) {
  if (!valores.length) return null;
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.min(orden.length - 1, Math.ceil(orden.length * 0.75) - 1)];
}

export async function obtenerResumenVitals({ dias = 28, dispositivo } = {}) {
  const pool = getPool();
  const params = [Number(dias) || 28];
  let filtro = '';
  if (DISPOSITIVOS.includes(dispositivo)) {
    filtro = ' AND dispositivo = ?';
    params.push(dispositivo);
  }

  // Tope de 20.000 filas recientes: más que suficiente para un portfolio.
  const [rows] = await pool.query(
    `SELECT lcp, cls, inp, fcp, ttfb FROM web_vitals
     WHERE fecha_hora >= DATE_SUB(NOW(), INTERVAL ? DAY)${filtro}
     ORDER BY fecha_hora DESC LIMIT 20000`,
    params
  );

  const resumen = { muestras: rows.length, dias: params[0], metricas: {} };
  for (const metrica of ['lcp', 'inp', 'cls', 'fcp', 'ttfb']) {
    const valores = rows.map((r) => r[metrica]).filter((v) => v !== null);
    const p75 = percentil75(valores);
    const [bueno, pobre] = UMBRALES[metrica];
    resumen.metricas[metrica] = {
      p75,
      muestras: valores.length,
      estado:
        p75 === null ? null : p75 <= bueno ? 'bueno' : p75 <= pobre ? 'mejorable' : 'pobre',
    };
  }
  return resumen;
}
