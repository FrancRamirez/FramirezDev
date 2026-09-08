import { readSessionToken, verifySessionToken } from '../../lib/auth.js';
import {
  registrarVisita,
  buildVisitorCookie,
  obtenerTotalPeriodo,
} from '../../lib/visits.js';

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
    const token = readSessionToken(req);
    const payload = token ? verifySessionToken(token) : null;
    const username = payload?.username || null;

    const { visitorId } = await registrarVisita(req, username);

    // Solo hace falta la cookie de visitante anónimo si no hay sesión:
    // un usuario logueado ya se identifica con su usuario, no con la cookie.
    if (!username) {
      res.setHeader('Set-Cookie', buildVisitorCookie(visitorId));
    }

    const total = await obtenerTotalPeriodo();
    res.status(200).json({ success: true, total });
  } catch (error) {
    console.error('Error en /api/visitas/registrar:', error);
    res.status(500).json({
      success: false,
      message: 'Hubo un error al registrar la visita.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
