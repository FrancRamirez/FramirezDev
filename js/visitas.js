// js/visitas.js
//
// Se incluye en cualquier página que deba contar como visita (index,
// dashboard). Al cargar, registra la visita actual (usuario logueado o
// visitante anónimo, vía cookie) contra /api/visitas/registrar y pinta el
// total del mes en cualquier elemento con [data-visitas-total].

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/visitas/registrar', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success) {
      pintarTotalVisitas(data.total);
    }
  } catch (error) {
    console.error('No se pudo registrar la visita:', error);
  }
});

function pintarTotalVisitas(total) {
  document.querySelectorAll('[data-visitas-total]').forEach((el) => {
    el.textContent = Number(total).toLocaleString('es-AR');
  });
}
