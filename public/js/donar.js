// js/donar.js
//
// Sistema de donaciones (Mercado Pago Checkout Pro). Independiente de js/pago.js
// (que maneja la compra de productos).
//
// Qué hace:
//   1) Todo botón con data-donar-monto="<monto>" (sección #donar y footer)
//      pide a POST /api/donar una URL de pago y redirige a Mercado Pago.
//   2) Al volver de Mercado Pago (?donacion=exito|pendiente|falla), muestra
//      el mensaje de agradecimiento (o de error) y limpia la URL.
//
// Los montos permitidos se validan en el servidor (lib/donaciones.js);
// los botones del HTML son solo la interfaz.

(function () {
  // Traduce con I18N si está disponible; si no, usa el texto de respaldo.
  function t(clave, respaldo) {
    return window.I18N ? window.I18N.t(clave) : respaldo;
  }

  // Muestra un mensaje en el contenedor [data-donar] indicado.
  function mostrar(contenedor, texto, tipo) {
    const estado = contenedor?.querySelector('[data-donar-status]');
    if (!estado) return;
    estado.textContent = texto;
    estado.className = `donar__status is-${tipo}`;
  }

  async function donar(boton) {
    const contenedor = boton.closest('[data-donar]');
    const botones = contenedor.querySelectorAll('[data-donar-monto]');
    const monto = Number(boton.dataset.donarMonto);

    botones.forEach((b) => (b.disabled = true));
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
      botones.forEach((b) => (b.disabled = false));
    }
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
    document.querySelectorAll('[data-donar-monto]').forEach((boton) => {
      boton.addEventListener('click', () => donar(boton));
    });
    mostrarResultado();
  });
})();
