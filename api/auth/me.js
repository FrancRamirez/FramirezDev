import { readSessionToken, verifySessionToken } from '../../lib/auth.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const token = readSessionToken(req);
  const payload = token ? verifySessionToken(token) : null;

  if (!payload) {
    return res.status(401).json({ success: false, message: 'No hay sesión activa.' });
  }

  res.status(200).json({
    success: true,
    user: { username: payload.username, role: payload.role },
  });
};
