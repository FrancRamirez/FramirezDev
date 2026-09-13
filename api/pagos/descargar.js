// api/pagos/descargar.js
//
// Resuelve las descargas de apps del portfolio contra el Blob store de
// Vercel ("framirez-dev-blob"). Combina 2 casos en un solo archivo para
// no gastar 2 funciones serverless del límite de 12 del plan Hobby:
//
//   ?token=...   -> descarga PAGA: valida que exista una compra aprobada
//                    con ese token antes de resolver el archivo real.
//   ?archivo=... -> descarga GRATIS: solo restringido a una lista fija de
//                    nombres permitidos (Galería, BlocNote, Patra), sin
//                    pago de por medio.

import { buscarCompraPorToken } from '../../lib/compras.js';
import { getBlobUrl } from '../../lib/blob.js';

// Mapeo appId -> nombre del archivo tal cual se subió al Blob store.
// Al agregar más apps de pago, sumar la entrada acá.
const ARCHIVOS_POR_APP = {
  videolader: 'Videolader.apk',
};

// Nombres de descargas gratuitas permitidos, tal cual se subieron al Blob.
const ARCHIVOS_GRATIS = new Set(['Galeria.apk', 'BlocNote.apk', 'Patra.rar']);

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const { token, archivo } = req.query || {};

  try {
    // Caso 1: descarga gratuita, directa por nombre de archivo.
    if (archivo) {
      if (!ARCHIVOS_GRATIS.has(archivo)) {
        return res.status(404).send('Archivo no encontrado.');
      }
      const url = await getBlobUrl(archivo);
      return res.redirect(302, url);
    }

    // Caso 2: descarga paga, requiere token de una compra aprobada.
    if (!token) {
      return res.status(400).send('Falta el token de descarga.');
    }

    const compra = await buscarCompraPorToken(token);

    if (!compra || compra.estado !== 'aprobado') {
      return res.status(403).send('Este link de descarga no es válido o el pago no está aprobado.');
    }

    const nombreArchivo = ARCHIVOS_POR_APP[compra.app_id];
    if (!nombreArchivo) {
      console.error(`No hay archivo configurado para app_id="${compra.app_id}" en ARCHIVOS_POR_APP.`);
      return res.status(500).send('La descarga todavía no está disponible. Contactanos.');
    }

    const url = await getBlobUrl(nombreArchivo);
    res.redirect(302, url);
  } catch (error) {
    console.error('Error al procesar la descarga:', error);
    res.status(500).send('Hubo un error al procesar la descarga.');
  }
};
