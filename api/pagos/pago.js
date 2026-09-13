// api/pagos/pago.js
//
// Combina dos endpoints en un solo archivo (se distinguen por método HTTP)
// para no gastar 2 funciones serverless del límite de 12 que tiene el
// plan Hobby de Vercel:
//
//   GET  -> antes era api/pagos/config.js
//           Devuelve la Public Key de Mercado Pago (diseñada para
//           exponerse en el frontend) + precio/título del producto.
//   POST -> antes era api/pagos/procesar-pago.js
//           Recibe los datos del Card Payment Brick y crea el pago real
//           contra la API de Mercado Pago.
//
// Toda la config sensible (Access Token, precio) sigue viviendo en
// lib/mercadopago.js — este archivo no la toca directamente.

import { getPaymentClient, getProductoConfig } from '../../lib/mercadopago.js';
import { registrarCompra } from '../../lib/compras.js';

const ALLOWED_ORIGINS = [
  'https://framirezdev.com.ar',
  'https://www.framirezdev.com.ar',
];
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3001', 'http://localhost:3000');
}

async function handleGet(req, res) {
  const publicKey = process.env.MP_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({ error: 'Falta configurar MP_PUBLIC_KEY.' });
  }

  try {
    const { precio, titulo, appId, moneda } = getProductoConfig();
    res.status(200).json({ publicKey, precio, titulo, appId, moneda });
  } catch (error) {
    console.error('Error al leer config de producto:', error);
    res.status(500).json({ error: 'Falta configurar el producto en las variables de entorno.' });
  }
}

async function handlePost(req, res) {
  try {
    const {
      token,
      payment_method_id,
      installments,
      issuer_id,
      payer,
    } = req.body || {};

    if (!token || !payment_method_id || !payer?.email) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos del pago. Volvé a intentar desde el formulario.',
      });
    }

    const { precio, titulo, appId, moneda } = getProductoConfig();
    const paymentClient = getPaymentClient();

    const resultado = await paymentClient.create({
      body: {
        transaction_amount: precio,
        token,
        description: titulo,
        installments: Number(installments) || 1,
        payment_method_id,
        issuer_id,
        currency_id: moneda,
        payer: {
          email: payer.email,
          identification: payer.identification,
        },
        // Evita que un doble click/reintento del navegador cree dos cobros.
        external_reference: `${appId}-${payer.email}-${Date.now()}`,
      },
    });

    const estado =
      resultado.status === 'approved'
        ? 'aprobado'
        : resultado.status === 'rejected'
        ? 'rechazado'
        : 'pendiente';

    const { tokenDescarga } = await registrarCompra({
      appId,
      mpPaymentId: String(resultado.id),
      estado,
      email: payer.email,
      monto: precio,
    });

    if (estado === 'aprobado') {
      return res.status(200).json({
        success: true,
        status: 'approved',
        message: '¡Pago aprobado! Ya podés descargar la app.',
        downloadUrl: `/api/pagos/descargar?token=${tokenDescarga}`,
      });
    }

    if (estado === 'rechazado') {
      return res.status(200).json({
        success: false,
        status: 'rejected',
        message: 'El pago fue rechazado. Probá con otro medio de pago o contactanos.',
        detail: resultado.status_detail,
      });
    }

    return res.status(200).json({
      success: true,
      status: 'in_process',
      message: 'Tu pago está en revisión. Te avisaremos por email cuando se confirme.',
    });
  } catch (error) {
    console.error('Error al procesar el pago:', error);
    res.status(500).json({
      success: false,
      message: 'Hubo un error al procesar el pago. Intentá de nuevo más tarde.',
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

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
