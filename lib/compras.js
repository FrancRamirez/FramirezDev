// lib/compras.js
//
// Acceso a la tabla `compras` en TiDB. Registra cada intento de compra de
// una app y su estado. Cada compra queda atada a una cuenta (usuario_id):
// eso es lo que le permite al comprador volver a descargar la app —
// incluida cualquier actualización futura que subamos con el mismo
// nombre de archivo al Blob— con solo iniciar sesión, sin depender de
// guardar ningún link.
//
// No contiene nada sensible (precio/token de Mercado Pago viven en
// lib/mercadopago.js) — solo el CRUD contra la base.

import crypto from 'crypto';
import { getPool } from './db.js';

// Tabla `compras` en TiDB (documentación, no se ejecuta):
//
// CREATE TABLE compras (
//   id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
//   usuario_id BIGINT UNSIGNED NULL REFERENCES usuarios(id),
//   app_id VARCHAR(50) NOT NULL,
//   mp_payment_id VARCHAR(50) NOT NULL UNIQUE,
//   estado ENUM('pendiente', 'aprobado', 'rechazado') NOT NULL DEFAULT 'pendiente',
//   email_comprador VARCHAR(200) NOT NULL,
//   monto DECIMAL(10,2) NOT NULL,
//   token_descarga VARCHAR(64) NULL,
//   fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
//   fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   INDEX idx_usuario_app (usuario_id, app_id)
// ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
//
// Si la tabla ya existe de antes (sin usuario_id), agregar la columna con:
//   ALTER TABLE compras ADD COLUMN usuario_id BIGINT UNSIGNED NULL AFTER id;
//   ALTER TABLE compras ADD INDEX idx_usuario_app (usuario_id, app_id);
// usuario_id queda NULL en compras viejas hechas antes de exigir login —
// esas siguen funcionando por su token_descarga original, pero no van a
// aparecer como "ya comprado" al iniciar sesión.

export async function registrarCompra({ usuarioId, appId, mpPaymentId, estado, email, monto }) {
  const pool = getPool();
  // token_descarga solo se genera si ya viene aprobado (pago con tarjeta vía
  // Bricks suele resolver de forma síncrona); si queda pendiente, el
  // webhook lo completa después con marcarCompraAprobada(). Ya no es el
  // mecanismo principal de descarga (eso ahora es usuario_id + app_id),
  // pero se conserva como link de respaldo.
  const tokenDescarga = estado === 'aprobado' ? crypto.randomBytes(24).toString('hex') : null;

  await pool.query(
    `INSERT INTO compras (usuario_id, app_id, mp_payment_id, estado, email_comprador, monto, token_descarga)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE estado = VALUES(estado), token_descarga = COALESCE(token_descarga, VALUES(token_descarga))`,
    [usuarioId ?? null, appId, mpPaymentId, estado, email, monto, tokenDescarga]
  );

  return { tokenDescarga };
}

export async function marcarCompraAprobada(mpPaymentId) {
  const pool = getPool();
  const tokenDescarga = crypto.randomBytes(24).toString('hex');

  await pool.query(
    `UPDATE compras
     SET estado = 'aprobado', token_descarga = COALESCE(token_descarga, ?)
     WHERE mp_payment_id = ?`,
    [tokenDescarga, mpPaymentId]
  );

  return { tokenDescarga };
}

export async function marcarCompraRechazada(mpPaymentId) {
  const pool = getPool();
  await pool.query(
    `UPDATE compras SET estado = 'rechazado' WHERE mp_payment_id = ?`,
    [mpPaymentId]
  );
}

// Usado por el endpoint de descarga para validar el token antes de servir
// el archivo (mecanismo de respaldo, de antes de exigir login).
export async function buscarCompraPorToken(tokenDescarga) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT app_id, estado FROM compras WHERE token_descarga = ? LIMIT 1`,
    [tokenDescarga]
  );
  return rows[0] || null;
}

// Mecanismo principal de descarga con cuenta: ¿este usuario tiene una
// compra aprobada de esta app? Si la tiene, puede descargar la versión
// que sea que esté hoy en el Blob (incluidas actualizaciones futuras),
// sin importar cuándo compró.
export async function usuarioComproApp(usuarioId, appId) {
  if (!usuarioId) return false;
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id FROM compras WHERE usuario_id = ? AND app_id = ? AND estado = 'aprobado' LIMIT 1`,
    [usuarioId, appId]
  );
  return rows.length > 0;
}

// Usado por el GET de api/pagos/pago.js para saber, al cargar la página,
// qué apps de pago ya tiene el usuario logueado (y así mostrarle
// "Descargar" en vez de "Comprar").
export async function listarAppsCompradasPorUsuario(usuarioId) {
  if (!usuarioId) return [];
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT DISTINCT app_id FROM compras WHERE usuario_id = ? AND estado = 'aprobado'`,
    [usuarioId]
  );
  return rows.map((r) => r.app_id);
}
