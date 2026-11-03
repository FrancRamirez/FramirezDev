// js/visitas.js
//
// Se incluye en cualquier página que deba contar como visita (index,
// dashboard). La anti-inflación vive ACÁ, con sessionStorage: se cuenta
// una sola visita por sesión de navegador (mientras la pestaña/ventana
// siga abierta, navegar entre páginas del sitio no vuelve a sumar). Si el
// visitante cierra y vuelve a entrar, sessionStorage arranca vacío de
// nuevo y se cuenta una visita nueva.
//
// Pinta dos contadores distintos según qué elementos haya en la página:
//   [data-visitas-total]          -> total del mes actual (dashboard)
//   [data-visitas-total-general]  -> total histórico, nunca se reinicia (index)
//
// Tolerancia a fallos:
//   - Si la API falla, se reintenta una vez después de una pausa corta.
//   - Cada vez que la API responde bien, los totales se guardan en
//     localStorage; si después falla (por ejemplo, base de datos caída),
//     se muestra el último total conocido en vez de dejar el "—".
//   - Una visita solo se marca como contada en esta sesión cuando el
//     servidor confirma que la guardó (`registrada: true`). Si no la
//     guardó, se vuelve a intentar en la próxima carga de página.

const SESSION_FLAG = 'framirezdev_visita_registrada';
const CACHE_KEY = 'framirezdev_visitas_cache';
const REINTENTO_MS = 1500;

// --- Acceso seguro a storage -------------------------------------------
// sessionStorage/localStorage pueden lanzar error (modo privado estricto,
// cookies bloqueadas, etc.). Que eso nunca rompa el contador.

function leerSesion() {
  try {
    return sessionStorage.getItem(SESSION_FLAG) === '1';
  } catch {
    return false;
  }
}

function marcarSesion() {
  try {
    sessionStorage.setItem(SESSION_FLAG, '1');
  } catch {
    /* sin storage: se contará de nuevo en la próxima carga, no es grave */
  }
}

function guardarCache({ total, totalGeneral }) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ total, totalGeneral }));
  } catch {
    /* sin storage: simplemente no hay cache */
  }
}

function leerCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// --- Llamada a la API --------------------------------------------------

// Devuelve { ok, data }. `data` se intenta leer aunque la respuesta sea
// un error (500), porque ahí el servidor también informa `registrada`.
async function pedirVisitas(registrar) {
  const res = await fetch(
    registrar ? '/api/visitas?action=registrar' : '/api/visitas?action=total',
    {
      method: registrar ? 'POST' : 'GET',
      credentials: 'include',
    }
  );

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta sin JSON (por ejemplo, error de la plataforma) */
  }

  return { ok: res.ok && Boolean(data?.success), data };
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

document.addEventListener('DOMContentLoaded', async () => {
  // Si ya se contó en esta sesión, solo se pide el total (GET).
  let registrar = !leerSesion();

  for (let intento = 0; intento < 2; intento++) {
    try {
      const { ok, data } = await pedirVisitas(registrar);

      // El servidor confirma que guardó la visita: se marca la sesión y,
      // si hubiera que reintentar, se pide solo el total para no contarla
      // dos veces.
      if (data?.registrada === true) {
        marcarSesion();
        registrar = false;
      }

      if (ok) {
        guardarCache(data);
        pintarTotalesVisitas(data);
        return;
      }
    } catch (error) {
      console.error('No se pudo obtener/registrar la visita:', error);
    }

    if (intento === 0) await esperar(REINTENTO_MS);
  }

  // Los dos intentos fallaron: se muestra el último total conocido, si hay.
  const cache = leerCache();
  if (cache) pintarTotalesVisitas(cache);
});

function pintarTotalesVisitas({ total, totalGeneral }) {
  if (typeof total !== 'undefined') {
    document.querySelectorAll('[data-visitas-total]').forEach((el) => {
      el.textContent = Number(total).toLocaleString('es-AR');
    });
  }
  if (typeof totalGeneral !== 'undefined') {
    document.querySelectorAll('[data-visitas-total-general]').forEach((el) => {
      el.textContent = Number(totalGeneral).toLocaleString('es-AR');
    });
  }
}
