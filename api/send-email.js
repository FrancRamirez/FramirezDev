import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Orígenes permitidos para llamar a este endpoint.
// Ajustá esta lista si sumás otro dominio/subdominio (ej. staging).
const ALLOWED_ORIGINS = [
  'https://framirezdev.com.ar',
  'https://www.framirezdev.com.ar',
];

// En desarrollo local se permite localhost para poder probar el form.
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3001', 'http://localhost:3000');
}

// Límites de longitud para evitar abuso (mensajes gigantes, spam, costos en Resend).
const MAX_NOMBRE = 100;
const MAX_EMAIL = 200;
const MAX_MENSAJE = 5000;

// Escapa caracteres HTML para que nombre/mensaje no puedan inyectar
// markup dentro de los emails que arma este endpoint.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async (req, res) => {
  // CORS restringido: solo el propio dominio puede llamar a este endpoint.
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );

  // Manejar preflight request (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { nombre, email, mensaje, website } = req.body || {};

    // Honeypot: campo oculto que un usuario real nunca completa.
    // Si viene con contenido, es casi seguro un bot -> respondemos "éxito"
    // sin enviar nada, para no revelarle al bot que fue detectado.
    if (website) {
      return res.status(200).json({
        success: true,
        message: '✓ Tu mensaje fue enviado exitosamente. Te responderemos pronto.',
      });
    }

    // Validaciones
    if (!nombre || !email || !mensaje) {
      return res.status(400).json({
        success: false,
        message: 'Por favor completá todos los campos requeridos.',
      });
    }

    if (
      nombre.length > MAX_NOMBRE ||
      email.length > MAX_EMAIL ||
      mensaje.length > MAX_MENSAJE
    ) {
      return res.status(400).json({
        success: false,
        message: 'Uno de los campos supera la longitud máxima permitida.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'El email no es válido.',
      });
    }

    const nombreSafe = escapeHtml(nombre);
    const emailSafe = escapeHtml(email);
    const mensajeSafe = escapeHtml(mensaje).replace(/\n/g, '<br>');

    // Email a Francisco (notificación de nuevo contacto) - esta es la prioridad
    const notifResult = await resend.emails.send({
      from: 'FraMirez Dev <notificaciones@framirezdev.com.ar>',
      to: 'Francisco76.ef@gmail.com',
      reply_to: email,
      subject: `📬 Nuevo mensaje de contacto: ${nombreSafe}`,
      html: `
        <h2>Nuevo mensaje de contacto</h2>
        <p><strong>De:</strong> ${nombreSafe} (${emailSafe})</p>
        <p><strong>Mensaje:</strong></p>
        <p>${mensajeSafe}</p>
        <hr>
        <p><small>Enviado desde el formulario de contacto del portfolio. Podés responder directamente a este correo.</small></p>
      `,
    });

    if (notifResult.error) {
      console.error('Resend no pudo enviar la notificación:', notifResult.error);
      throw new Error(notifResult.error.message || 'Fallo al notificar a Francisco');
    }
    console.log('Notificación enviada, id:', notifResult.data?.id);

    // Email al usuario (confirmación) - si falla, no debe romper la respuesta al usuario
    try {
      const confirmResult = await resend.emails.send({
        from: 'FraMirez Dev <notificaciones@framirezdev.com.ar>',
        to: email,
        subject: '✓ Hemos recibido tu mensaje',
        html: `
          <h2>¡Gracias por contactarnos, ${nombreSafe}!</h2>
          <p>Recibimos tu mensaje correctamente.</p>
          <p><strong>Tu mensaje:</strong></p>
          <p>${mensajeSafe}</p>
          <p>Te responderemos pronto.</p>
          <hr>
          <p><em>Saludos,<br>Francisco Ramirez - Desarrollador FullStack</em></p>
        `,
      });
      if (confirmResult.error) {
        console.error('No se pudo enviar la confirmación al usuario:', confirmResult.error);
      }
    } catch (confirmErr) {
      console.error('Error inesperado al confirmar al usuario:', confirmErr);
    }

    res.status(200).json({
      success: true,
      message: '✓ Tu mensaje fue enviado exitosamente. Te responderemos pronto.',
    });
  } catch (error) {
    console.error('Error al enviar email:', error);
    res.status(500).json({
      success: false,
      message: 'Hubo un error al enviar el mensaje. Intenta de nuevo más tarde.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
