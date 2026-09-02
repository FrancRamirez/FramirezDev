import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async (req, res) => {
  // Habilitar CORS (primero, antes de cualquier validación)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
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
    const { nombre, email, mensaje } = req.body;

    // Validaciones
    if (!nombre || !email || !mensaje) {
      return res.status(400).json({
        success: false,
        message: 'Por favor completá todos los campos requeridos.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'El email no es válido.',
      });
    }

    // Email a Francisco (notificación de nuevo contacto) - esta es la prioridad
    const notifResult = await resend.emails.send({
      from: 'FraMirez Dev <notificaciones@framirezdev.com.ar>',
      to: 'Francisco76.ef@gmail.com',
      reply_to: email,
      subject: `📬 Nuevo mensaje de contacto: ${nombre}`,
      html: `
        <h2>Nuevo mensaje de contacto</h2>
        <p><strong>De:</strong> ${nombre} (${email})</p>
        <p><strong>Mensaje:</strong></p>
        <p>${mensaje.replace(/\n/g, '<br>')}</p>
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
          <h2>¡Gracias por contactarnos, ${nombre}!</h2>
          <p>Recibimos tu mensaje correctamente.</p>
          <p><strong>Tu mensaje:</strong></p>
          <p>${mensaje.replace(/\n/g, '<br>')}</p>
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
