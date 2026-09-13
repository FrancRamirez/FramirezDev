// api/descargas/gratis.js
//
// Redirige las descargas gratuitas del portfolio (Galería, BlocNote,
// Patra) al Blob store de Vercel. A diferencia de api/pagos/descargar.js,
// acá no hay pago que validar — solo restringimos a una lista fija de
// archivos permitidos, para que este endpoint no se pueda usar como proxy
// genérico hacia cualquier nombre de Blob.

import { getBlobUrl } from '../../lib/blob.js';

// Nombres tal cual se subieron al Blob store. Agregar acá cualquier app
// gratuita nueva del portfolio.
const ARCHIVOS_PERMITIDOS = new Set(['Galeria.apk', 'BlocNote.apk', 'Patra.rar']);

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const { archivo } = req.query || {};
  if (!archivo || !ARCHIVOS_PERMITIDOS.has(archivo)) {
    return res.status(404).send('Archivo no encontrado.');
  }

  try {
    const url = await getBlobUrl(archivo);
    res.redirect(302, url);
  } catch (error) {
    console.error('Error al resolver descarga gratuita:', error);
    res.status(500).send('Hubo un error al procesar la descarga.');
  }
};
