// lib/db.js
//
// Maneja la conexión a la base de datos (TiDB Cloud, protocolo MySQL).
// Usamos un pool de conexiones en vez de abrir una conexión nueva por
// request: en Vercel cada invocación de función puede reciclar el
// mismo proceso, así que reusar el pool evita agotar las conexiones
// permitidas por TiDB Cloud.
//
// Variables de entorno esperadas (ver .env.example):
//   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DATABASE

import mysql from 'mysql2/promise';

let pool;

export function getPool() {
  if (pool) return pool;

  const {
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASSWORD,
    DATABASE,
  } = process.env;

  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DATABASE) {
    throw new Error(
      'Faltan variables de entorno de la base de datos (DB_HOST, DB_USER, DB_PASSWORD, DATABASE). Revisá tu .env.local o las variables de entorno en Vercel.'
    );
  }

  pool = mysql.createPool({
    host: DB_HOST,
    port: Number(DB_PORT) || 4000,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DATABASE,
    // TiDB Cloud (endpoint público) exige TLS. TiDB Cloud usa certificados
    // de una CA públicamente confiada, así que alcanza con activar SSL;
    // no hace falta apuntar a un archivo .pem local.
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
    },
    waitForConnections: true,
    connectionLimit: 5, // conservador: los planes serverless de TiDB limitan conexiones concurrentes
    maxIdle: 5,
    idleTimeout: 60000,
    queueLimit: 0,
  });

  // mysql2 Pool es un EventEmitter: si una conexión de fondo falla (se cae,
  // hay un problema de auth/SSL, etc.) emite 'error'. Sin un listener acá,
  // Node lo trata como excepción no capturada y tira abajo TODO el proceso
  // (incluso requests que no tenían nada que ver). Lo logueamos en cambio.
  pool.on('error', (err) => {
    console.error('Error de fondo en el pool de TiDB:', err);
  });

  return pool;
}

// Tabla `usuarios` ya creada en TiDB (documentación, no se ejecuta):
//
// CREATE TABLE usuarios (
//   id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
//   usuario VARCHAR(50) NOT NULL UNIQUE,
//   contrasena VARCHAR(255) NOT NULL,
//   rol ENUM('Admin', 'Usuario') NOT NULL DEFAULT 'Usuario',
//   fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
// ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
//
// Nota: el ENUM usa 'Admin'/'Usuario' (mayúscula inicial, en español).
// api/auth/login.js normaliza esos valores a 'admin'/'user' en minúscula
// antes de armar la sesión, para que el resto del código (dashboard.js,
// el JWT, etc.) trabaje siempre con esos dos valores fijos.
