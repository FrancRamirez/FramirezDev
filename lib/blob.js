// lib/blob.js
//
// Genera una URL firmada (Vercel Signed URL) de corta duración para un
// archivo del Blob store privado ("framirez-dev-blob"), a partir de su
// nombre. El store es PRIVADO: la URL "cruda" de un blob privado nunca es
// accesible directamente (devuelve 403 Forbidden aunque la sepas de
// memoria) — por eso acá no devolvemos esa URL, sino una firmada y con
// vencimiento que Vercel valida en su CDN.
//
// Requiere @vercel/blob >= 2.3 (soporte de private storage / Signed URLs
// — antes de la serie 2.x el SDK no lo soportaba en absoluto) y
// autenticación vía OIDC (automática en Vercel) o BLOB_READ_WRITE_TOKEN.

import { issueSignedToken, presignUrl } from '@vercel/blob';

// Token de delegación reutilizable: alcanza para firmar CUALQUIER pathname
// del store ("*"), solo para la operación 'get' (descargas). Emitirlo
// implica un pedido a la API de Blob, así que lo cacheamos en memoria
// mientras la función serverless esté "caliente" y lo renovamos un poco
// antes de que venza, en vez de pedir uno nuevo en cada descarga.
let delegationTokenCache = null;
const RENOVAR_ANTES_DE_VENCER_MS = 5 * 60 * 1000; // 5 min de margen
const DELEGACION_DURACION_MS = 60 * 60 * 1000; // 1 hora

async function getDelegationToken() {
  if (
    delegationTokenCache &&
    delegationTokenCache.validUntil - RENOVAR_ANTES_DE_VENCER_MS > Date.now()
  ) {
    return delegationTokenCache;
  }

  delegationTokenCache = await issueSignedToken({
    pathname: '*',
    operations: ['get'],
    validUntil: Date.now() + DELEGACION_DURACION_MS,
  });

  return delegationTokenCache;
}

// La URL firmada final que le damos al navegador dura bastante menos que
// el token de delegación: de sobra para que arranque la descarga apenas
// redirigimos, sin dejar un link "vivo" dando vueltas mucho tiempo.
const URL_FIRMADA_DURACION_MS = 5 * 60 * 1000; // 5 min

export async function getBlobUrl(nombreArchivo) {
  const token = await getDelegationToken();

  const { presignedUrl } = await presignUrl(token, {
    operation: 'get',
    pathname: nombreArchivo,
    access: 'private',
    validUntil: Date.now() + URL_FIRMADA_DURACION_MS,
  });

  return presignedUrl;
}
