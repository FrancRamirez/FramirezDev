// lib/auth.js
//
// Helpers de autenticación usados por api/auth/*.js:
//   - hash/verificación de contraseñas (bcrypt)
//   - validación de usuario/contraseña en el registro
//   - firma/verificación de la sesión (JWT)
//   - armado de las cookies httpOnly de sesión

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SESSION_COOKIE_NAME = 'session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

function getJwtSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'Falta la variable de entorno SESSION_SECRET (usada para firmar la sesión). Revisá tu .env.local.'
    );
  }
  return secret;
}

// ---------- Contraseñas ----------

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

export async function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

// ---------- Validaciones de registro ----------

// 3-24 caracteres: letras, números, "_" o "-"
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,24}$/;

export function isValidUsername(username) {
  return typeof username === 'string' && USERNAME_REGEX.test(username);
}

export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

// ---------- Sesión (JWT) ----------

export function signSessionToken(user) {
  return jwt.sign(
    { username: user.username, role: user.role },
    getJwtSecret(),
    { expiresIn: SESSION_MAX_AGE_SECONDS }
  );
}

export function verifySessionToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    // Token vencido, inválido o manipulado: tratamos todo igual, como "sin sesión".
    return null;
  }
}

// Lee el valor de la cookie de sesión desde el header Cookie del request.
// No usamos el paquete `cookie-parser` para no sumar otra dependencia;
// alcanza con parsear a mano ese único valor.
export function readSessionToken(req) {
  const header = req.headers.cookie;
  if (!header) return null;

  const match = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));

  if (!match) return null;
  return decodeURIComponent(match.slice(SESSION_COOKIE_NAME.length + 1));
}

export function buildSessionCookie(token) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ];
  // Secure solo tiene sentido con HTTPS; en local (http://localhost) el
  // navegador descarta la cookie si la marcamos Secure.
  if (process.env.NODE_ENV !== 'development') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function buildLogoutCookie() {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV !== 'development') {
    parts.push('Secure');
  }
  return parts.join('; ');
}
