import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configurar transporte de email (Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'Francisco76.ef@gmail.com',
    pass: process.env.EMAIL_PASS || '', // Usar contraseña de aplicación de Gmail
  },
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend está funcionando' });
});

// Endpoint para enviar email desde el formulario de contacto
app.post('/api/send-email', async (req, res) => {
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

    // Email al usuario (confirmación)
    const mailToUser = {
      from: process.env.EMAIL_USER || 'Francisco76.ef@gmail.com',
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
    };

    // Email a Francisco (notificación de nuevo contacto)
    const mailToFrancisco = {
      from: process.env.EMAIL_USER || 'Francisco76.ef@gmail.com',
      to: 'Francisco76.ef@gmail.com',
      subject: `📬 Nuevo mensaje de contacto: ${nombre}`,
      html: `
        <h2>Nuevo mensaje de contacto</h2>
        <p><strong>De:</strong> ${nombre} (${email})</p>
        <p><strong>Mensaje:</strong></p>
        <p>${mensaje.replace(/\n/g, '<br>')}</p>
        <hr>
        <p><small>Enviado desde el formulario de contacto del portfolio</small></p>
      `,
    };

    // Enviar ambos emails
    await Promise.all([
      transporter.sendMail(mailToUser),
      transporter.sendMail(mailToFrancisco),
    ]);

    res.json({
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
});

// Ruta por defecto
app.get('/', (req, res) => {
  res.json({
    message: 'Backend de Portfolio - Francisco Ramirez',
    endpoints: {
      health: '/api/health',
      sendEmail: 'POST /api/send-email',
    },
  });
});

// Exportar para Vercel
export default app;

// Solo iniciar servidor si no estamos en Vercel
if (process.env.VERCEL_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });
}
