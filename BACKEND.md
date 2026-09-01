# Backend - Formulario de Contacto

Backend Node.js + Express para manejar el formulario de contacto del portfolio.
Utiliza **Resend** para envío de emails (100 emails/día gratis).

## 🚀 Configuración Local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Resend API Key

Tu API Key ya está configurada en `.env.local`:

```
RESEND_API_KEY=re_TWoPq5v5_9sw7iVPAvusGfMuH8CSSjC3n
```

(Si necesitas regenerarla, ve a [resend.com/dashboard](https://resend.com/dashboard))

### 3. Ejecutar en desarrollo

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3001`

## 📤 Endpoints

### POST `/api/send-email`

Envía un email de contacto usando Resend.

**Body:**
```json
{
  "nombre": "Tu Nombre",
  "email": "tu@email.com",
  "mensaje": "Tu mensaje aquí"
}
```

**Response (éxito):**
```json
{
  "success": true,
  "message": "✓ Tu mensaje fue enviado exitosamente..."
}
```

**Response (error):**
```json
{
  "success": false,
  "message": "Por favor completá todos los campos requeridos."
}
```

## 🌐 Desplegar en Vercel

### 1. Pushear a GitHub

```bash
git add .
git commit -m "Update backend to use Resend"
git push origin main
```

### 2. Conectar a Vercel

1. Ve a https://vercel.com
2. Importa este repositorio
3. En las variables de entorno, agrega:
   - `RESEND_API_KEY`: `re_TWoPq5v5_9sw7iVPAvusGfMuH8CSSjC3n`

### 3. Deploy

Vercel deployará automáticamente. Tu backend estará en:
```
https://tu-dominio.vercel.app/api/send-email
```

## 📝 Cómo funciona

1. Usuario completa el formulario en el portfolio
2. Frontend envía POST a `/api/send-email`
3. Backend valida los datos
4. **Resend** envía 2 emails:
   - ✓ Email de confirmación al usuario
   - ✓ Email de notificación a Francisco76.ef@gmail.com
5. Respuesta al frontend con estado success/error

## 💳 Plan Resend Gratuito

- **100 emails/día**
- **Soporta transactional emails**
- **Interfaz de dashboard**
- **Logs de envíos**

Para más emails, Resend ofrece planes pagos desde $20/mes.

## 🔒 Seguridad

- Las validaciones se hacen en frontend Y backend
- API Key se guarda en `.env` (no versionado)
- CORS está configurado
- Los emails de confirmación son automáticos
