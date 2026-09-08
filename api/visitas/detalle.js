import { readSessionToken, verifySessionToken } from '../../lib/auth.js';
import {
  obtenerDetallePeriodo,
  obtenerPeriodosDisponibles,
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

  // Detalle a nivel usuario/visitante: solo lo puede ver el Admin.
  if (!payload || payload.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'No autorizado.' });
  }

  try {
    const periodoSolicitado = req.query?.periodo;
    const [detalle, periodosDisponibles] = await Promise.all([
      obtenerDetallePeriodo(periodoSolicitado || undefined),
      obtenerPeriodosDisponibles(),
    ]);

    res.status(200).json({ success: true, detalle, periodosDisponibles });
  } catch (error) {
    console.error('Error en /api/visitas/detalle:', error);
    res.status(500).json({
      success: false,
      message: 'Hubo un error al obtener el detalle de visitas.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
