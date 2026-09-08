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

const SESSION_FLAG = 'framirezdev_visita_registrada';

document.addEventListener('DOMContentLoaded', async () => {
  const yaRegistradaEnEstaSesion = sessionStorage.getItem(SESSION_FLAG) === '1';

  try {
    const res = await fetch(
      yaRegistradaEnEstaSesion ? '/api/visitas/total' : '/api/visitas/registrar',
      {
        method: yaRegistradaEnEstaSesion ? 'GET' : 'POST',
        credentials: 'include',
      }
    );
    const data = await res.json();

    if (data.success) {
      if (!yaRegistradaEnEstaSesion) {
        sessionStorage.setItem(SESSION_FLAG, '1');
      }
      pintarTotalesVisitas(data);
    }
  } catch (error) {
    console.error('No se pudo obtener/registrar la visita:', error);
  }
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
