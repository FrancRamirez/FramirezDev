// api/pagos/config.js
//
// La Public Key de Mercado Pago está diseñada para ser expuesta en el
// frontend (a diferencia del Access Token, que jamás debe salir del
// backend). Igual la servimos desde acá en vez de hardcodearla en el
// HTML/JS, para que TODO lo relacionado a Mercado Pago (claves, precio,
// título) quede centralizado en variables de entorno y no haya que tocar
// código estático si cambian.

import { getProductoConfig } from '../../lib/mercadopago.js';

export default async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const publicKey = process.env.MP_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({ error: 'Falta configurar MP_PUBLIC_KEY.' });
  }

  try {
    const { precio, titulo, appId, moneda } = getProductoConfig();
    res.status(200).json({ publicKey, precio, titulo, appId, moneda });
  } catch (error) {
    console.error('Error al leer config de producto:', error);
    res.status(500).json({ error: 'Falta configurar el producto en las variables de entorno.' });
  }
};
