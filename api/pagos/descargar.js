// api/pagos/descargar.js
//
// Valida el token de descarga (generado tras un pago aprobado) y
// redirige al archivo real, alojado en el Blob store de Vercel
// ("framirez-dev-blob"). Mantener el link real fuera de una URL pública
// fija evita que se comparta sin haber pagado: acá siempre se valida el
// token contra la compra antes de resolver la URL del Blob.

import { buscarCompraPorToken } from '../../lib/compras.js';
import { getBlobUrl } from '../../lib/blob.js';

// Mapeo appId -> nombre del archivo tal cual se subió al Blob store.
// Al agregar más apps de pago, sumar la entrada acá.
const ARCHIVOS_POR_APP = {
  videolader: 'Videolader.apk',
};

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const { token } = req.query || {};
  if (!token) {
    return res.status(400).send('Falta el token de descarga.');
  }

  try {
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
    console.error('Error al validar la descarga:', error);
    res.status(500).send('Hubo un error al procesar la descarga.');
  }
};
