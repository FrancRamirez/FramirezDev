// js/donar.js
//
// Sistema de donaciones (Mercado Pago Checkout Pro). Independiente de js/pago.js
// (que maneja la compra de productos).
//
// Qué hace:
//   1) El bloque [data-donar] (sección #donar) tiene una barra
//      (slider) y una caja numérica que se mantienen sincronizadas:
//        - Mover la barra  -> actualiza la caja (de $500 en $500).
//        - Escribir en la caja -> mueve la barra al punto más cercano.
//          Si el monto es mayor al máximo, se ajusta al máximo al instante;
//          si es menor al mínimo, se ajusta al mínimo al salir de la caja
//          (para no molestar mientras se escribe, ej. "5" antes de "5000").
//   2) El botón "Donar" pide a POST /api/donar una URL de pago y redirige
//      a Mercado Pago.
//   3) Al volver de Mercado Pago (?donacion=exito|pendiente|falla), muestra
//      el mensaje de agradecimiento (o de error) y limpia la URL.
//
// El servidor valida el monto de nuevo (lib/donaciones.js); lo de aquí es
// solo la interfaz y una validación previa para avisar rápido al visitante.

(function () {
  // Rango de la barra y de la caja. Deben coincidir con min/max/step del <input type="range">
  // del HTML y con MONTO_MIN / MONTO_MAX de lib/donaciones.js.
  const MONTO_MIN = 1000;
  const MONTO_MAX = 10000;

  // Traduce con I18N si está disponible; si no, usa el texto de respaldo.
  function t(clave, respaldo, params) {
    return window.I18N ? window.I18N.t(clave, params) : respaldo;
  }

  // Formatea un número con punto de miles (5000 -> "5.000").
  function formatear(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // Muestra un mensaje en el contenedor [data-donar] indicado.
  function mostrar(contenedor, texto, tipo) {
    const estado = contenedor?.querySelector('[data-donar-status]');
    if (!estado) return;
    estado.textContent = texto;
    estado.className = `donar__status is-${tipo}`;
  }

  // Inicializa un bloque [data-donar]: conecta barra, caja y botón.
  function iniciarBloque(contenedor) {
    const slider = contenedor.querySelector('[data-donar-slider]');
    const input = contenedor.querySelector('[data-donar-input]');
    const boton = contenedor.querySelector('[data-donar-enviar]');
    const display = contenedor.querySelector('[data-donar-display]');
    const montoBoton = contenedor.querySelector('[data-donar-boton-monto]');
    if (!slider || !input || !boton) return;

    // Monto actual (entero) o null si la caja está vacía.
    let monto = null;

    const limitar = (n) => Math.min(Math.max(n, MONTO_MIN), MONTO_MAX);

    // Pinta la parte "llena" de la barra según la posición del índice.
    function pintarBarra() {
      const fraccion = (slider.value - MONTO_MIN) / (MONTO_MAX - MONTO_MIN); // 0 a 1
      slider.style.setProperty('--f', String(fraccion));
    }

    // Refleja el monto (ya limitado al rango) en el texto grande, el botón y la barra.
    function actualizarVista() {
      const valido = monto !== null;
      boton.disabled = !valido;
      const txt = valido ? `$${formatear(limitar(monto))}` : '—';
      if (display) display.textContent = txt;
      if (montoBoton) montoBoton.textContent = valido ? txt : '';
    }

    // Ajusta al rango permitido: lo que esté fuera pasa al mínimo o al máximo.
    function ajustarARango() {
      if (monto === null) return;
      monto = limitar(monto);
      input.value = String(monto);
      slider.value = String(monto);
      pintarBarra();
      actualizarVista();
    }

    // Mover la barra -> actualiza la caja.
    slider.addEventListener('input', () => {
      monto = Number(slider.value);
      input.value = String(monto);
      pintarBarra();
      actualizarVista();
    });

    // Escribir en la caja -> actualiza la barra (en vivo).
    input.addEventListener('input', () => {
      // Solo dígitos: se descartan letras, símbolos, puntos y comas.
      const limpio = input.value.replace(/\D/g, '');
      if (limpio !== input.value) input.value = limpio;

      monto = limpio === '' ? null : Number(limpio);

      if (monto !== null) {
        // Mayor al máximo: se ajusta al máximo al instante.
        if (monto > MONTO_MAX) {
          monto = MONTO_MAX;
          input.value = String(monto);
        }
        // La barra queda en el paso más cercano (y en el mínimo si el monto es menor).
        slider.value = String(limitar(monto));
        pintarBarra();
      }
      actualizarVista();
    });

    // Al salir de la caja: menor al mínimo -> mínimo; vacía -> vuelve al valor de la barra.
    input.addEventListener('blur', () => {
      if (monto === null) monto = Number(slider.value);
      ajustarARango();
    });

    // Enter en la caja = ajustar y donar.
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && monto !== null) {
        e.preventDefault();
        ajustarARango();
        donar();
      }
    });

    boton.addEventListener('click', donar);

    function bloquear(bloqueado) {
      slider.disabled = bloqueado;
      input.disabled = bloqueado;
      boton.disabled = bloqueado || monto === null;
    }

    async function donar() {
      if (monto === null) return;
      ajustarARango();

      bloquear(true);
      mostrar(contenedor, t('donar.redirigiendo', 'Redirigiendo a Mercado Pago...'), 'info');

      try {
        const resp = await fetch('/api/donar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ monto }),
        });
        const data = await resp.json().catch(() => ({}));

        if (!resp.ok || !data.url) {
          throw new Error(data.message || 'error');
        }
        // Solo se redirige a Mercado Pago (evita redirecciones a otros dominios).
        const destino = new URL(data.url);
        if (!/(^|\.)mercadopago\.com(\.ar)?$/.test(destino.hostname)) {
          throw new Error('destino inesperado');
        }
        window.location.href = destino.href;
      } catch (error) {
        console.error('Error al iniciar la donación:', error);
        mostrar(contenedor, t('donar.error', 'No se pudo iniciar la donación. Inténtalo de nuevo.'), 'error');
        bloquear(false);
      }
    }

    // Si el visitante vuelve con el botón "atrás" desde Mercado Pago, el navegador
    // puede restaurar la página bloqueada: se vuelve a habilitar.
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) {
        bloquear(false);
        mostrar(contenedor, '', 'info');
      }
    });

    // Estado inicial (valor que trae el HTML en la caja).
    monto = Number(input.value) || Number(slider.value);
    ajustarARango();
  }

  // Mensaje al volver de Mercado Pago.
  function mostrarResultado() {
    const params = new URLSearchParams(window.location.search);
    const resultado = params.get('donacion');
    const mensajes = {
      exito: ['donar.exito', '¡Muchas gracias por tu donación!', 'success'],
      pendiente: ['donar.pendiente', 'Tu donación está pendiente de confirmación. ¡Gracias!', 'info'],
      falla: ['donar.falla', 'La donación no se completó. Puedes intentarlo de nuevo cuando quieras.', 'error'],
    };
    if (!Object.hasOwn(mensajes, resultado)) return;

    const [clave, respaldo, tipo] = mensajes[resultado];
    mostrar(document.querySelector('#donar [data-donar]'), t(clave, respaldo), tipo);

    // Limpia ?donacion=... de la barra de direcciones (deja el #donar).
    params.delete('donacion');
    const query = params.toString();
    history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-donar]').forEach(iniciarBloque);
    mostrarResultado();
  });
})();
