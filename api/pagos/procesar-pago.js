// api/pagos/procesar-pago.js
//
// Recibe los datos que arma el Card Payment Brick (token de tarjeta,
// método de pago, cuotas, email) y crea el pago real contra la API de
// Mercado Pago. Con tarjeta, Mercado Pago suele resolver el estado de
// forma síncrona (approved/rejected/in_process) en esta misma respuesta;
// igual dejamos webhook.js como red de seguridad para cambios de estado
// posteriores (ej. contracargos, revisión manual).
//
// Toda la config sensible (Access Token, precio) vive en
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
};
