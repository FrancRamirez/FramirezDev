// js/donar.js
//
// Sistema de donaciones (Mercado Pago Checkout Pro). Independiente de js/pago.js
// (que maneja la compra de productos).
//
// Qué hace:
//   1) En el bloque [data-donar] (sección #donar), el visitante escribe el monto
//      que quiera en la caja (solo números, sin máximo). El botón "Donar"
//      muestra ese monto y se deshabilita si la caja está vacía o en $0.
//   2) El botón pide a POST /api/donar una URL de pago y redirige a Mercado Pago.
//   3) Al volver de Mercado Pago (?donacion=exito|pendiente|falla), muestra
//      el mensaje de agradecimiento (o de error) y limpia la URL.
//
// El servidor valida el monto de nuevo (lib/donaciones.js); lo de aquí es
// solo la interfaz y una validación previa para avisar rápido al visitante.

(function () {
  // Monto mínimo (pesos). Debe coincidir con MONTO_MIN de lib/donaciones.js.
  const MONTO_MIN = 1;

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

  // Inicializa un bloque [data-donar]: conecta la caja y el botón.
  function iniciarBloque(contenedor) {
    const input = contenedor.querySelector('[data-donar-input]');
    const boton = contenedor.querySelector('[data-donar-enviar]');
    const montoBoton = contenedor.querySelector('[data-donar-boton-monto]');
    if (!input || !boton) return;

    // Monto actual (entero) o null si la caja está vacía o en 0.
    let monto = null;

    // Refleja el monto en el botón y lo habilita o deshabilita.
    function actualizarVista() {
      boton.disabled = monto === null;
      if (montoBoton) montoBoton.textContent = monto === null ? '' : `$${formatear(monto)}`;
    }

    // Escribir en la caja -> actualiza el monto (solo dígitos).
    input.addEventListener('input', () => {
      const limpio = input.value.replace(/\D/g, '');
      if (limpio !== input.value) input.value = limpio;

      const n = limpio === '' ? 0 : Number(limpio);
      monto = Number.isSafeInteger(n) && n >= MONTO_MIN ? n : null;

      mostrar(contenedor, '', 'info');
      actualizarVista();
    });

    // Al salir de la caja: si no hay un monto válido, se avisa.
    input.addEventListener('blur', () => {
      if (monto === null) {
        mostrar(contenedor, t('donar.montoInvalido', 'Ingresa un monto mayor a $0.'), 'error');
      }
    });

    // Enter en la caja = donar.
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && monto !== null) {
        e.preventDefault();
        donar();
      }
    });

    boton.addEventListener('click', donar);

    function bloquear(bloqueado) {
      input.disabled = bloqueado;
      boton.disabled = bloqueado || monto === null;
    }

    async function donar() {
      if (monto === null) return;

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
    input.dispatchEvent(new Event('input'));
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
