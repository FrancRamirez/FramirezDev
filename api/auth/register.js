import { getPool } from '../../lib/db.js';
import {
  hashPassword,
  isValidUsername,
  isValidPassword,
} from '../../lib/auth.js';

// Mismo criterio de CORS que api/send-email.js: solo el propio dominio.
const ALLOWED_ORIGINS = [
  'https://framirezdev.com.ar',
  'https://www.framirezdev.com.ar',
];
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3001', 'http://localhost:3000');
}

export default async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { username, password } = req.body || {};

    if (!isValidUsername(username)) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de usuario debe tener 3-24 caracteres (letras, números, "_" o "-").',
      });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 8 caracteres.',
      });
    }

    const pool = getPool();

    const [existing] = await pool.execute(
      'SELECT id FROM usuarios WHERE usuario = ? LIMIT 1',
      [username]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Ese nombre de usuario ya está en uso.',
      });
    }

    const passwordHash = await hashPassword(password);

    // El rol SIEMPRE se fuerza a 'Usuario' acá: el cliente nunca puede elegir
    // su propio rol. Convertir a alguien en 'Admin' se hace a mano en la DB.
    // 'Usuario'/'Admin' son los valores exactos del ENUM de la columna `rol`.
    await pool.execute(
      'INSERT INTO usuarios (usuario, contrasena, rol) VALUES (?, ?, ?)',
      [username, passwordHash, 'Usuario']
    );

    res.status(201).json({
      success: true,
      message: 'Cuenta creada correctamente. Ya podés iniciar sesión.',
    });
  } catch (error) {
    console.error('Error en /api/auth/register:', error);
    res.status(500).json({
      success: false,
      message: 'Hubo un error al crear la cuenta. Intentá de nuevo más tarde.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
