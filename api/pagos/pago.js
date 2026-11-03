// api/pagos/pago.js
//
// Combina dos endpoints en un solo archivo (se distinguen por método HTTP)
// para no gastar 2 funciones serverless del límite de 12 que tiene el
// plan Hobby de Vercel:
//
//   GET  -> Devuelve la Public Key de Mercado Pago (diseñada para
//           exponerse en el frontend) + el catálogo completo de
//           lib/productos.js (precio/título de cada app en venta), y si
//           hay sesión activa, cuáles de esas apps ya compró esa cuenta
//           (yaComprado) — así el frontend puede mostrar "Descargar" en
//           vez de "Comprar" para cada una.
//   POST -> Recibe qué app se está comprando (?app=videolader|patra) +
//           los datos del Card Payment Brick, y crea el pago real contra
//           la API de Mercado Pago. Requiere sesión activa: la compra se
//           ata a la cuenta (usuario_id) para que el comprador pueda
//           volver a descargar esa app (y sus actualizaciones futuras)
//           para siempre, con solo iniciar sesión.
//
// Todo lo sensible (Access Token) sigue viviendo en lib/mercadopago.js;
// el catálogo de productos (no sensible) vive en lib/productos.js.

import crypto from 'crypto';
import { getPaymentClient } from '../../lib/mercadopago.js';
import { getProducto, listarProductos } from '../../lib/productos.js';
import { registrarCompra, listarAppsCompradasPorUsuario, usuarioComproApp } from '../../lib/compras.js';
import { readSessionToken, verifySessionToken } from '../../lib/auth.js';
import { limitar, responder429 } from '../../lib/rateLimit.js';

const ALLOWED_ORIGINS = [
  'https://framirezdev.com.ar',
  'https://www.framirezdev.com.ar',
];
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3001', 'http://localhost:3000');
}

function getSesionActual(req) {
  const token = readSessionToken(req);
  return token ? verifySessionToken(token) : null;
}

async function handleGet(req, res) {
  const publicKey = process.env.MP_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({ error: 'Falta configurar MP_PUBLIC_KEY.' });
  }

  try {
    const sesion = getSesionActual(req);
    const appsCompradas = sesion ? await listarAppsCompradasPorUsuario(sesion.id) : [];

    const productos = listarProductos().map((p) => ({
      appId: p.appId,
      titulo: p.titulo,
      precio: p.precio,
      moneda: p.moneda,
      yaComprado: appsCompradas.includes(p.appId),
    }));

    res.status(200).json({
      publicKey,
      autenticado: Boolean(sesion),
      productos,
    });
  } catch (error) {
    console.error('Error al leer el catálogo de productos:', error);
    res.status(500).json({ error: 'No se pudo cargar la configuración de pago.' });
  }
}

async function handlePost(req, res) {
  try {
    const sesion = getSesionActual(req);
    if (!sesion) {
      return res.status(401).json({
        success: false,
        requiresAuth: true,
        message: 'Necesitás iniciar sesión (o crear una cuenta) antes de comprar, para poder descargar la app y sus futuras actualizaciones desde tu cuenta.',
      });
    }

    // Máximo 10 intentos de pago cada 10 minutos por IP: frena a quien use
    // el formulario para probar tarjetas robadas ("carding").
    const limite = limitar(req, 'pago', 10, 10 * 60 * 1000);
    if (!limite.permitido) {
      return responder429(res, limite, 'Demasiados intentos de pago. Espera unos minutos e inténtalo de nuevo.');
    }

    const { app: appId } = req.query || {};
    if (!appId || typeof appId !== 'string') {
      return res.status(400).json({ success: false, message: 'Falta indicar qué producto se compra.' });
    }

    let producto;
    try {
      producto = getProducto(appId);
    } catch {
      return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    }

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
    if (
      typeof token !== 'string' ||
      typeof payment_method_id !== 'string' ||
      typeof payer.email !== 'string'
    ) {
      return res.status(400).json({ success: false, message: 'Datos de pago inválidos.' });
    }

    // Si esta cuenta ya compró la app, no se vuelve a cobrar: se la manda
    // directo a la descarga.
    if (await usuarioComproApp(sesion.id, producto.appId)) {
      return res.status(409).json({
        success: false,
        status: 'already_owned',
        message: 'Esta cuenta ya compró esta app. Puedes descargarla desde tu cuenta, sin pagar de nuevo.',
        downloadUrl: `/api/pagos/descargar?app=${producto.appId}`,
      });
    }

    const paymentClient = getPaymentClient();

    // Clave de idempotencia: el token de la tarjeta es de un solo uso, así
    // que un doble click manda el MISMO token dos veces. Con la misma clave,
    // Mercado Pago devuelve el pago ya creado en vez de cobrar de nuevo.
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${sesion.id}:${producto.appId}:${token}`)
      .digest('hex');

    const resultado = await paymentClient.create({
      requestOptions: { idempotencyKey },
      body: {
        transaction_amount: producto.precio,
        token,
        description: producto.titulo,
        installments: Number(installments) || 1,
        payment_method_id,
        issuer_id,
        payer: {
          email: payer.email,
          identification: payer.identification,
        },
        // Referencia para identificar el pago en el panel de Mercado Pago.
        // (La protección contra doble cobro es la idempotencyKey de arriba.)
        external_reference: `${producto.appId}-${sesion.username}-${Date.now()}`,
      },
    });

    const estado =
      resultado.status === 'approved'
        ? 'aprobado'
        : resultado.status === 'rejected'
        ? 'rechazado'
        : 'pendiente';

    await registrarCompra({
      usuarioId: sesion.id,
      appId: producto.appId,
      mpPaymentId: String(resultado.id),
      estado,
      email: payer.email,
      monto: producto.precio,
    });

    if (estado === 'aprobado') {
      return res.status(200).json({
        success: true,
        status: 'approved',
        message: '¡Pago aprobado! Ya podés descargar la app desde tu cuenta.',
        // No depende de un token de un solo uso: como la compra quedó
        // atada a la cuenta, este mismo link sirve para siempre (incluidas
        // futuras actualizaciones) mientras haya sesión iniciada.
        downloadUrl: `/api/pagos/descargar?app=${producto.appId}`,
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
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
};
