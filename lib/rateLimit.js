// lib/rateLimit.js
//
// Límite de pedidos por IP, en memoria. Sirve para frenar abusos simples
// (un script en bucle pegándole a login, registro, contacto, etc.) sin
// gastar consultas a la base de datos.
//
// Limitación importante: en Vercel cada instancia de la función tiene su
// propia memoria, y las instancias se reinician o se multiplican según la
// carga. Por eso esto es una defensa "de mejor esfuerzo": frena al abuso
// casual desde una misma IP, pero NO reemplaza a un rate limiting real a
// nivel de red (reglas en Cloudflare o Vercel Firewall).

const buckets = new Map();
const MAX_ENTRADAS = 5000; // tope de IPs recordadas, para no crecer sin límite

export function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'desconocida';
}

function limpiar(ahora) {
  for (const [clave, bucket] of buckets) {
    if (bucket.reinicio <= ahora) buckets.delete(clave);
  }
  // Si aun así quedó lleno, se vacía todo (falla "abierta": mejor dejar
  // pasar que bloquear a visitantes reales por un problema de memoria).
  if (buckets.size > MAX_ENTRADAS) buckets.clear();
}

// Cuenta este pedido y dice si todavía está dentro del límite.
//   nombre    -> identifica el endpoint (ej. 'login'); cada uno tiene su cupo
//   max       -> pedidos permitidos por ventana
//   ventanaMs -> duración de la ventana en milisegundos
// Devuelve { permitido, reintentarEnSeg }.
export function limitar(req, nombre, max, ventanaMs) {
  const ahora = Date.now();
  const clave = `${nombre}:${getClientIp(req)}`;

  let bucket = buckets.get(clave);
  if (!bucket || bucket.reinicio <= ahora) {
    bucket = { cuenta: 0, reinicio: ahora + ventanaMs };
    buckets.set(clave, bucket);
  }
  bucket.cuenta += 1;

  if (buckets.size > MAX_ENTRADAS) limpiar(ahora);

  return {
    permitido: bucket.cuenta <= max,
    reintentarEnSeg: Math.max(1, Math.ceil((bucket.reinicio - ahora) / 1000)),
  };
}

// Respuesta estándar 429 (Too Many Requests) con el header Retry-After.
export function responder429(res, limite, mensaje) {
  res.setHeader('Retry-After', String(limite.reintentarEnSeg));
  return res.status(429).json({
    success: false,
    message: mensaje || 'Demasiados pedidos. Espera unos minutos e inténtalo de nuevo.',
  });
}
