// api/auth/index.js
//
// Consolida login, logout, me y register en una sola función serverless
// (antes eran 4 archivos separados) para no gastar de más del límite de
// 12 funciones del plan Hobby de Vercel. Se elige la acción con
// ?action=login|logout|me|register — ver js/auth.js en el frontend.

import { getPool } from '../../lib/db.js';
import {
  verifyPassword,
  signSessionToken,
  buildSessionCookie,
  buildLogoutCookie,
  readSessionToken,
  verifySessionToken,
  hashPassword,
  isValidUsername,
  isValidPassword,
} from '../../lib/auth.js';

const ALLOWED_ORIGINS = [
  'https://framirezdev.com.ar',
  'https://www.framirezdev.com.ar',
];
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3001', 'http://localhost:3000');
}

// Mensaje genérico a propósito: no reveles si falló por usuario inexistente
// o por contraseña incorrecta (evita que se pueda enumerar usuarios).
const INVALID_CREDENTIALS_MSG = 'Usuario o contraseña incorrectos.';

async function handleLogin(req, res) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Completá usuario y contraseña.' });
    }

    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT id, usuario AS username, contrasena AS password_hash, rol AS role FROM usuarios WHERE usuario = ? LIMIT 1',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS_MSG });
    }

    const dbUser = rows[0];
    const passwordOk = await verifyPassword(password, dbUser.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS_MSG });
    }

    // La columna `rol` en TiDB usa 'Admin' / 'Usuario' (así se creó el ENUM).
    // Acá lo normalizamos a 'admin' / 'user' en minúscula, que es lo que
    // esperan el resto del código y el frontend (dashboard.js compara
    // contra 'admin').
    const user = {
      ...dbUser,
      role: dbUser.role === 'Admin' ? 'admin' : 'user',
    };

    const token = signSessionToken(user);
    res.setHeader('Set-Cookie', buildSessionCookie(token));

    res.status(200).json({
      success: true,
      user: { username: user.username, role: user.role },
    });
  } catch (error) {
    console.error('Error en /api/auth?action=login:', error);
    res.status(500).json({
      success: false,
      message: 'Hubo un error al iniciar sesión. Intentá de nuevo más tarde.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function handleLogout(req, res) {
  res.setHeader('Set-Cookie', buildLogoutCookie());
  res.status(200).json({ success: true });
}

async function handleMe(req, res) {
  const token = readSessionToken(req);
  const payload = token ? verifySessionToken(token) : null;

  if (!payload) {
    return res.status(401).json({ success: false, message: 'No hay sesión activa.' });
  }

  res.status(200).json({
    success: true,
    user: { username: payload.username, role: payload.role },
  });
}

async function handleRegister(req, res) {
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
    console.error('Error en /api/auth?action=register:', error);
    res.status(500).json({
      success: false,
      message: 'Hubo un error al crear la cuenta. Intentá de nuevo más tarde.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

export default async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action } = req.query || {};

  switch (action) {
    case 'login':
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
      }
      return handleLogin(req, res);

    case 'logout':
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
      }
      return handleLogout(req, res);

    case 'me':
      if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
      }
      return handleMe(req, res);

    case 'register':
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
      }
      return handleRegister(req, res);

    default:
      return res.status(400).json({ success: false, message: 'Acción no reconocida.' });
  }
};
