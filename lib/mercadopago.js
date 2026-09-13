// lib/mercadopago.js
//
// Único punto de contacto con el SDK de Mercado Pago. TODO lo sensible
// (Access Token, y el detalle del producto: precio, título, moneda) vive
// acá y sale exclusivamente de variables de entorno — nunca hardcodeado
// en el código ni compartido fuera de este archivo.
//
// Variables de entorno esperadas (ver .env.example):
//   MP_ACCESS_TOKEN   -> Access Token de tu cuenta Mercado Pago (Producción o Test)
//   MP_APP_PRECIO     -> Precio de la app en ARS, ej: 5000
//   MP_APP_TITULO     -> Título del producto que se le muestra al comprador
//   MP_APP_ID         -> Identificador interno corto de la app (ej: "mi-app-nueva")
//
// Para pasar de modo Test a Producción alcanza con reemplazar el valor de
// MP_ACCESS_TOKEN en Vercel (Settings -> Environment Variables); no hace
// falta tocar ningún otro archivo del proyecto.

import crypto from 'crypto';
import { MercadoPagoConfig, Payment } from 'mercadopago';

let client;

function getAccessToken() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'Falta la variable de entorno MP_ACCESS_TOKEN. Revisá tu .env.local o las variables de entorno en Vercel.'
    );
  }
  return token;
}

export function getMercadoPagoClient() {
  if (client) return client;
  client = new MercadoPagoConfig({
    accessToken: getAccessToken(),
    options: { timeout: 8000 },
  });
  return client;
}

export function getPaymentClient() {
  return new Payment(getMercadoPagoClient());
}

// Datos del producto que se vende. Se leen de env vars para que el
// precio/título se puedan cambiar sin tocar código ni volver a compartir
// este archivo.
export function getProductoConfig() {
  const precio = Number(process.env.MP_APP_PRECIO);
  const titulo = process.env.MP_APP_TITULO;
  const appId = process.env.MP_APP_ID;

  if (!precio || precio <= 0 || !titulo || !appId) {
    throw new Error(
      'Faltan variables de entorno del producto (MP_APP_PRECIO, MP_APP_TITULO, MP_APP_ID). Revisá tu .env.local o las variables de entorno en Vercel.'
    );
  }

  return { precio, titulo, appId, moneda: 'ARS' };
}

// ---------- Validación de firma del webhook ----------
//
// Mercado Pago firma cada notificación con una clave secreta (la que se
// genera al configurar la URL en Tus integraciones > Webhooks). Sin esta
// validación, cualquiera podría pegarle a /api/pagos/webhook simulando un
// pago aprobado. Algoritmo oficial de MP: HMAC-SHA256 sobre un "manifest"
// armado con el id del pago, el request-id y el timestamp, todos provistos
// en los headers x-signature y x-request-id.

export function verifyWebhookSignature({ xSignature, xRequestId, dataId }) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      'Falta la variable de entorno MP_WEBHOOK_SECRET. Configurala con la clave secreta que te dio Mercado Pago al guardar la URL del webhook.'
    );
  }
  if (!xSignature || !xRequestId || !dataId) return false;

  // x-signature llega como "ts=1704908010,v1=618c85345248dd820d5fd456117...".
  const partes = Object.fromEntries(
    xSignature.split(',').map((p) => p.trim().split('=').map((s) => s.trim()))
  );
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;
  const hashEsperado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  // Comparación en tiempo constante para evitar timing attacks.
  const bufEsperado = Buffer.from(hashEsperado, 'utf8');
  const bufRecibido = Buffer.from(v1, 'utf8');
  if (bufEsperado.length !== bufRecibido.length) return false;
  return crypto.timingSafeEqual(bufEsperado, bufRecibido);
}
