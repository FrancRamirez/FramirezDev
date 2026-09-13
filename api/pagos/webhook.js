// api/pagos/webhook.js
//
// Mercado Pago llama a esta URL cuando el estado de un pago cambia
// (aprobación demorada, contracargo, reversión, etc.). No hay que confiar
// nunca solo en lo que devuelve el frontend/procesar-pago.js: este
// webhook es la fuente de verdad final.
//
// Configurar esta URL en: Mercado Pago -> Tus integraciones -> tu app ->
// Webhooks -> https://framirezdev.com.ar/api/pagos/webhook
//
// Nota de seguridad: Mercado Pago solo te avisa "algo cambió, andá a
// consultar" (te pasa el id del pago) — por eso acá SIEMPRE volvemos a
// pedirle el detalle del pago a la API con getPaymentClient().get(), en
// vez de confiar en el body de la notificación. Además validamos que la
// notificación realmente venga de Mercado Pago con verifyWebhookSignature
// (headers x-signature / x-request-id + MP_WEBHOOK_SECRET), para que nadie
// pueda simular un pago aprobado pegándole directo a este endpoint.

import { getPaymentClient, verifyWebhookSignature } from '../../lib/mercadopago.js';
import { marcarCompraAprobada, marcarCompraRechazada } from '../../lib/compras.js';

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    const paymentId = req.body?.data?.id || req.query?.['data.id'];
    const tipo = req.body?.type || req.query?.type;

    // Solo nos interesan notificaciones de pagos.
    if (tipo !== 'payment' || !paymentId) {
      return res.status(200).json({ received: true });
    }

    const firmaValida = verifyWebhookSignature({
      xSignature: req.headers['x-signature'],
      xRequestId: req.headers['x-request-id'],
      dataId: String(paymentId),
    });
    if (!firmaValida) {
      console.warn('Webhook de Mercado Pago con firma inválida, ignorado. paymentId:', paymentId);
      // 200 igual: no queremos que MP reintente algo que rechazamos a propósito,
      // ni darle pistas a un atacante sobre por qué falló.
      return res.status(200).json({ received: true });
    }

    const paymentClient = getPaymentClient();
    const pago = await paymentClient.get({ id: paymentId });

    if (pago.status === 'approved') {
      await marcarCompraAprobada(String(pago.id));
    } else if (pago.status === 'rejected' || pago.status === 'cancelled') {
      await marcarCompraRechazada(String(pago.id));
    }
    // Otros estados (in_process, etc.) no requieren acción: se espera
    // la próxima notificación.

    res.status(200).json({ received: true });
  } catch (error) {
    // Devolvemos 200 igual: si le contestamos error, Mercado Pago reintenta
    // en bucle esta misma notificación. Solo logueamos para investigar.
    console.error('Error procesando webhook de Mercado Pago:', error);
    res.status(200).json({ received: true });
  }
};
