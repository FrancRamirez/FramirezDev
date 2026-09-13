// lib/compras.js
//
// Acceso a la tabla `compras` en TiDB. Registra cada intento de compra de
// una app y su estado, y genera el link de descarga una vez que el pago
// queda aprobado (vía procesar-pago.js o, más tarde, vía webhook.js).
//
// No contiene nada sensible (precio/token de Mercado Pago viven en
// lib/mercadopago.js) — solo el CRUD contra la base.

import crypto from 'crypto';
import { getPool } from './db.js';

// Tabla `compras` a crear en TiDB (documentación, no se ejecuta):
//
// CREATE TABLE compras (
//   id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
//   app_id VARCHAR(50) NOT NULL,
//   mp_payment_id VARCHAR(50) NOT NULL UNIQUE,
//   estado ENUM('pendiente', 'aprobado', 'rechazado') NOT NULL DEFAULT 'pendiente',
//   email_comprador VARCHAR(200) NOT NULL,
//   monto DECIMAL(10,2) NOT NULL,
//   token_descarga VARCHAR(64) NULL,
//   fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
//   fecha_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

export async function registrarCompra({ appId, mpPaymentId, estado, email, monto }) {
  const pool = getPool();
  // token_descarga solo se genera si ya viene aprobado (pago con tarjeta vía
  // Bricks suele resolver de forma síncrona); si queda pendiente, el
  // webhook lo completa después con marcarCompraAprobada().
  const tokenDescarga = estado === 'aprobado' ? crypto.randomBytes(24).toString('hex') : null;

  await pool.query(
    `INSERT INTO compras (app_id, mp_payment_id, estado, email_comprador, monto, token_descarga)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE estado = VALUES(estado), token_descarga = COALESCE(token_descarga, VALUES(token_descarga))`,
    [appId, mpPaymentId, estado, email, monto, tokenDescarga]
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
// el archivo (o redirigir a su ubicación real).
export async function buscarCompraPorToken(tokenDescarga) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT app_id, estado FROM compras WHERE token_descarga = ? LIMIT 1`,
    [tokenDescarga]
  );
  return rows[0] || null;
}
