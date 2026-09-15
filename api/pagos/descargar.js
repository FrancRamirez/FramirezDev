// api/pagos/descargar.js
//
// Resuelve las descargas de apps del portfolio contra el Blob store de
// Vercel ("framirez-dev-blob"). Combina 3 casos en un solo archivo para
// no gastar funciones serverless de más del límite de 12 del plan Hobby:
//
//   ?app=...     -> descarga PAGA, mecanismo principal: requiere sesión
//                    iniciada y que esa cuenta tenga una compra aprobada
//                    de esa app. Como resuelve el archivo por nombre en
//                    el Blob (no por versión), si el día de mañana subís
//                    una actualización con el mismo nombre, el comprador
//                    la descarga sola, sin volver a pagar ni pedir nada.
//   ?token=...   -> descarga PAGA, mecanismo de respaldo (de antes de
//                    exigir login): valida el token de una sola compra.
//                    Se mantiene por compatibilidad con compras viejas.
//   ?archivo=... -> descarga GRATIS: lista fija de nombres permitidos
//                    (Galería, BlocNote), sin pago de por medio.

import { buscarCompraPorToken, usuarioComproApp } from '../../lib/compras.js';
import { getBlobUrl } from '../../lib/blob.js';
import { readSessionToken, verifySessionToken } from '../../lib/auth.js';
import { PRODUCTOS } from '../../lib/productos.js';

// Nombres de descargas gratuitas permitidos, tal cual se subieron al Blob.
// Patra dejó de ser gratis (ver lib/productos.js) — sacado de esta lista.
const ARCHIVOS_GRATIS = new Set(['Galeria.apk', 'BlocNote.apk', 'MultiExtractor_Freemium.rar']);

async function resolverArchivoDeApp(appId) {
  const producto = PRODUCTOS[appId];
  if (!producto) {
    console.error(`Producto desconocido: "${appId}". Revisá lib/productos.js.`);
    return null;
  }
  return producto.archivoBlob;
}

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const { token, archivo, app: appId } = req.query || {};

  try {
    // Caso 1: descarga gratuita, directa por nombre de archivo.
    if (archivo) {
      if (!ARCHIVOS_GRATIS.has(archivo)) {
        return res.status(404).send('Archivo no encontrado.');
      }
      const url = await getBlobUrl(archivo);
      return res.redirect(302, url);
    }

    // Caso 2: descarga paga por cuenta (mecanismo principal, permanente).
    if (appId) {
      const sesionToken = readSessionToken(req);
      const sesion = sesionToken ? verifySessionToken(sesionToken) : null;
      if (!sesion) {
        return res
          .status(401)
          .send('Necesitás iniciar sesión con la cuenta que compró esta app para descargarla.');
      }

      const compro = await usuarioComproApp(sesion.id, appId);
      if (!compro) {
        return res.status(403).send('Tu cuenta no tiene una compra aprobada de esta app.');
      }

      const nombreArchivo = await resolverArchivoDeApp(appId);
      if (!nombreArchivo) {
        return res.status(500).send('La descarga todavía no está disponible. Contactanos.');
      }

      const url = await getBlobUrl(nombreArchivo);
      return res.redirect(302, url);
    }

    // Caso 3: descarga paga por token de un solo uso (respaldo, compras viejas).
    if (!token) {
      return res.status(400).send('Falta el token de descarga.');
    }

    const compra = await buscarCompraPorToken(token);

    if (!compra || compra.estado !== 'aprobado') {
      return res.status(403).send('Este link de descarga no es válido o el pago no está aprobado.');
    }

    const nombreArchivo = await resolverArchivoDeApp(compra.app_id);
    if (!nombreArchivo) {
      return res.status(500).send('La descarga todavía no está disponible. Contactanos.');
    }

    const url = await getBlobUrl(nombreArchivo);
    res.redirect(302, url);
  } catch (error) {
    console.error('Error al procesar la descarga:', error);
    res.status(500).send('Hubo un error al procesar la descarga.');
  }
};
