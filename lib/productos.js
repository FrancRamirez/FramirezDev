// lib/productos.js
//
// Catálogo de todo lo que se vende con Mercado Pago. Nada de esto es
// sensible (a diferencia del Access Token, que vive solo en variables de
// entorno dentro de lib/mercadopago.js) — precio, título y nombre de
// archivo son datos públicos que ya se muestran en el sitio, así que se
// mantienen acá en código en vez de una variable de entorno por producto.
//
// Para agregar un producto nuevo: sumar una entrada acá con el mismo
// appId que uses en el atributo data-app-id del botón "Comprar" en
// index.html, y el nombre de archivo tal cual lo subiste al Blob store.
// No hace falta tocar ningún otro archivo del backend.

export const PRODUCTOS = {
  multiextractor: {
    titulo: 'Multi-Extractor Premium',
    precio: 15000,
    moneda: 'ARS',
    archivoBlob: 'MultiExtractor_Premium.rar',
  },
  videolader: {
    titulo: 'Videolader',
    precio: 10000,
    moneda: 'ARS',
    archivoBlob: 'Videolader.apk',
  },
  patra: {
    titulo: 'Patra',
    precio: 20000,
    moneda: 'ARS',
    archivoBlob: 'Patra.rar',
  },
  omnimedia: {
    titulo: 'OmniMedia',
    precio: 15000,
    moneda: 'ARS',
    archivoBlob: 'OmniMedia.apk',
  },
  multiextractor: {
    titulo: 'Multi-Extractor Premium',
    precio: 15000,
    moneda: 'ARS',
    archivoBlob: 'MultiExtractor_Premium.rar',
  },
};

export function getProducto(appId) {
  const producto = PRODUCTOS[appId];
  if (!producto) {
    throw new Error(`Producto desconocido: "${appId}". Revisá lib/productos.js.`);
  }
  return { appId, ...producto };
}

export function listarProductos() {
  return Object.keys(PRODUCTOS).map((appId) => getProducto(appId));
}
