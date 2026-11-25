// lib/donaciones.js
//
// Configuración y lógica del sistema de DONACIONES (Mercado Pago Checkout Pro).
// Es un sistema aparte del de venta de productos: no usa lib/productos.js,
// ni lib/compras.js, ni la base de datos. Lo único que comparte es el cliente
// de Mercado Pago (getMercadoPagoClient), que a su vez lee MP_ACCESS_TOKEN de
// las variables de entorno. Aquí no hay nada sensible.
//
// Cómo funciona Checkout Pro: el servidor crea una "preferencia" (el monto y
// a dónde volver) y Mercado Pago devuelve una URL (init_point). El visitante
// es redirigido a esa URL y paga en el sitio de Mercado Pago, así que los
// datos de su tarjeta/cuenta nunca pasan por este sitio.

import { Preference } from 'mercadopago';
import { getMercadoPagoClient } from './mercadopago.js';

// El monto es libre: no hay máximo. Solo se exige un número entero de pesos
// mayor o igual a MONTO_MIN (Mercado Pago no admite montos de $0 o negativos).
// Si el monto fuera demasiado alto para Mercado Pago, él mismo lo rechaza y
// el visitante ve el mensaje de error de la donación.
// Si cambias MONTO_MIN, cámbialo también en public/js/donar.js.
export const MONTO_MIN = 1;

export const MONEDA_DONACION = 'ARS';
export const TITULO_DONACION = 'Donación a Framirez.Dev';

export function montoValido(monto) {
  return Number.isSafeInteger(monto) && monto >= MONTO_MIN;
}

// Crea la preferencia de pago y devuelve la URL a la que hay que redirigir.
//   monto   -> entero mayor o igual a MONTO_MIN (ya validado)
//   baseUrl -> origen del sitio (ej. https://www.framirezdev.com.ar), para las back_urls
export async function crearPreferenciaDonacion({ monto, baseUrl }) {
  const preference = new Preference(getMercadoPagoClient());

  const body = {
    items: [
      {
        id: 'donacion',
        title: TITULO_DONACION,
        quantity: 1,
        unit_price: monto,
        currency_id: MONEDA_DONACION,
      },
    ],
    // Al terminar, Mercado Pago devuelve al visitante a la página principal con
    // ?donacion=<resultado>; public/js/donar.js muestra el mensaje correspondiente.
    back_urls: {
      success: `${baseUrl}/?donacion=exito#donar`,
      pending: `${baseUrl}/?donacion=pendiente#donar`,
      failure: `${baseUrl}/?donacion=falla#donar`,
    },
    // Referencia para identificar la donación en el panel de Mercado Pago.
    external_reference: `donacion-${monto}-${Date.now()}`,
    statement_descriptor: 'FRAMIREZDEV',
    metadata: { tipo: 'donacion' },
  };

  // auto_return (volver solo tras aprobar) exige back_urls con HTTPS;
  // en pruebas locales (http://localhost) se omite.
  if (baseUrl.startsWith('https://')) {
    body.auto_return = 'approved';
  }

  const resultado = await preference.create({ body });
  return resultado.init_point;
}
