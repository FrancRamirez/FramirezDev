import { getPool } from '../../lib/db.js';
import {
  verifyPassword,
  signSessionToken,
  buildSessionCookie,
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
    console.error('Error en /api/auth/login:', error);
    res.status(500).json({
      success: false,
      message: 'Hubo un error al iniciar sesión. Intentá de nuevo más tarde.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
