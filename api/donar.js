// api/donar.js
//
// Endpoint del sistema de donaciones (aparte del de pagos de productos).
//
//   POST /api/donar   body: { "monto": <entero en ARS, entre MONTO_MIN y MONTO_MAX> }
//   -> { success: true, url: "<init_point de Mercado Pago>" }
//
// El navegador redirige al visitante a esa url y allí completa la donación.
// Toda la lógica vive en lib/donaciones.js.

import { montoValido, crearPreferenciaDonacion } from '../lib/donaciones.js';
import { limitar, responder429 } from '../lib/rateLimit.js';

const SITIO_POR_DEFECTO = 'https://www.framirezdev.com.ar';
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

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Máximo 10 intentos cada 10 minutos por IP.
  const limite = limitar(req, 'donar', 10, 10 * 60 * 1000);
  if (!limite.permitido) {
    return responder429(res, limite, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.');
  }

  // El monto se valida en el servidor contra el rango permitido (lib/donaciones.js).
  const monto = Number(req.body?.monto);
  if (!montoValido(monto)) {
    return res.status(400).json({ success: false, message: 'Monto de donación inválido.' });
  }

  // Las back_urls usan el dominio desde el que llegó el visitante (si es uno permitido).
  const baseUrl = origin && ALLOWED_ORIGINS.includes(origin) ? origin : SITIO_POR_DEFECTO;

  try {
    const url = await crearPreferenciaDonacion({ monto, baseUrl });
    if (!url) throw new Error('Mercado Pago no devolvió init_point.');
    return res.status(200).json({ success: true, url });
  } catch (error) {
    console.error('Error al crear la donación:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo iniciar la donación. Inténtalo de nuevo más tarde.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
