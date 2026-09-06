import express from 'express';
import cors from 'cors';
import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import loginHandler from '../api/auth/login.js';
import registerHandler from '../api/auth/register.js';
import logoutHandler from '../api/auth/logout.js';
import meHandler from '../api/auth/me.js';

dotenv.config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

const app = express();
const PORT = process.env.PORT || 3001;

// Red de seguridad: si algo (una promesa sin catch, un evento 'error' sin
// listener, etc.) se escapa, lo logueamos en vez de dejar que tumbe todo
// el servidor de desarrollo a mitad de una request.
process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err);
});
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});

// Middleware
app.use(cors());
app.use(express.json());

// Rutas de autenticación.
//
// api/auth/*.js está escrito con la firma estándar (req, res) que usan
// las funciones serverless de Vercel, así que en producción Vercel las
// detecta solo con que existan en la carpeta api/. Para poder probarlas
// acá en local con "npm run dev" (sin instalar el CLI de Vercel), las
// montamos directo como si fueran rutas de Express: usan .status(),
// .json() y .setHeader(), que también existen en el objeto `res` de
// Express, así que funcionan sin cambios.
app.all('/api/auth/login', loginHandler);
app.all('/api/auth/register', registerHandler);
app.all('/api/auth/logout', logoutHandler);
app.all('/api/auth/me', meHandler);

// Configurar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

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
    await resend.emails.send({
      from: 'noreply@resend.dev',
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

    // Email a Francisco (notificación de nuevo contacto)
    await resend.emails.send({
      from: 'noreply@resend.dev',
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
    });

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

// Sirve el sitio estático (index.html, login.html, registro.html,
// dashboard.html, css/, js/, assets/) desde el mismo origen que la API.
// Esto es solo para desarrollo local: en Vercel el sitio se sirve por
// separado y esta línea no aplica (VERCEL_ENV !== undefined ahí).
app.use(express.static(PROJECT_ROOT));

// Nota: con express.static ya activo, "/" ahora sirve index.html
// directo (como en producción). Esta ruta queda como referencia rápida
// de los endpoints disponibles.
app.get('/api/info', (req, res) => {
  res.json({
    message: 'Backend de Portfolio - Francisco Ramirez',
    endpoints: {
      health: '/api/health',
      sendEmail: 'POST /api/send-email',
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      logout: 'POST /api/auth/logout',
      me: 'GET /api/auth/me',
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
