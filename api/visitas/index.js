// api/visitas/index.js
//
// Consolida detalle, registrar y total en una sola función serverless
// (antes eran 3 archivos separados) para no gastar de más del límite de
// 12 funciones del plan Hobby de Vercel. Se elige la acción con
// ?action=detalle|registrar|total — ver js/visitas.js y js/dashboard.js
// en el frontend.

import { readSessionToken, verifySessionToken } from '../../lib/auth.js';
import {
  obtenerDetallePeriodo,
  obtenerPeriodosDisponibles,
  registrarVisita,
  buildVisitorCookie,
  obtenerTotalPeriodo,
  obtenerTotalGeneral,
} from '../../lib/visits.js';

const ALLOWED_ORIGINS = [
  'https://framirezdev.com.ar',
  'https://www.framirezdev.com.ar',
];
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3001', 'http://localhost:3000');
}

async function handleDetalle(req, res) {
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
    console.error('Error en /api/visitas?action=detalle:', error);
    res.status(500).json({
      success: false,
      message: 'Hubo un error al obtener el detalle de visitas.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

// Cuenta SIEMPRE una visita nueva: la anti-inflación (una visita por
// sesión de navegador) la decide el cliente antes de llamar acá —
// ver js/visitas.js, que solo pega este POST una vez por sessionStorage
// (se resetea al cerrar la pestaña/ventana).
async function handleRegistrar(req, res) {
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

    const [total, totalGeneral] = await Promise.all([
      obtenerTotalPeriodo(),
      obtenerTotalGeneral(),
    ]);
    res.status(200).json({ success: true, total, totalGeneral });
  } catch (error) {
    console.error('Error en /api/visitas?action=registrar:', error);
    res.status(500).json({
      success: false,
      message: 'Hubo un error al registrar la visita.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

async function handleTotal(req, res) {
  try {
    const [total, totalGeneral] = await Promise.all([
      obtenerTotalPeriodo(),
      obtenerTotalGeneral(),
    ]);
    res.status(200).json({ success: true, total, totalGeneral });
  } catch (error) {
    console.error('Error en /api/visitas?action=total:', error);
    res.status(500).json({
      success: false,
      message: 'Hubo un error al obtener el total de visitas.',
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
    case 'detalle':
      if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
      }
      return handleDetalle(req, res);

    case 'registrar':
      if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
      }
      return handleRegistrar(req, res);

    case 'total':
      if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
      }
      return handleTotal(req, res);

    default:
      return res.status(400).json({ success: false, message: 'Acción no reconocida.' });
  }
};
