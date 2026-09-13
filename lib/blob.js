// lib/blob.js
//
// Resuelve la URL pública real de un archivo alojado en el Blob store de
// Vercel ("framirez-dev-blob") a partir de su nombre. Así el código nunca
// necesita la URL completa hardcodeada (que además cambia si volvés a
// subir el archivo) — solo el nombre del archivo tal cual lo subiste.
//
// Requiere la variable de entorno BLOB_READ_WRITE_TOKEN, que Vercel agrega
// sola al conectar el proyecto con el Blob store (no hay que copiarla a mano).

import { list } from '@vercel/blob';

// Cache simple en memoria: mientras la función serverless esté "caliente"
// (Vercel reutiliza el mismo proceso entre invocaciones seguidas), evita
// pegarle a la API de Blob en cada descarga. Se vence solo a los 5 min,
// así que si resubís un archivo con el mismo nombre, tarda como mucho
// eso en reflejarse.
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getBlobUrl(nombreArchivo) {
  const cacheado = cache.get(nombreArchivo);
  if (cacheado && Date.now() - cacheado.timestamp < CACHE_TTL_MS) {
    return cacheado.url;
  }

  const { blobs } = await list({ prefix: nombreArchivo });
  const encontrado = blobs.find((b) => b.pathname === nombreArchivo);

  if (!encontrado) {
    throw new Error(
      `No se encontró "${nombreArchivo}" en el Blob store. Revisá que esté subido con ese nombre exacto.`
    );
  }

  cache.set(nombreArchivo, { url: encontrado.url, timestamp: Date.now() });
  return encontrado.url;
}
