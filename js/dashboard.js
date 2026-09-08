document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('dashboardLoading');
  const content = document.getElementById('dashboardContent');
  const welcome = document.getElementById('dashboardWelcome');
  const roleBadge = document.getElementById('dashboardRoleBadge');
  const adminSection = document.getElementById('adminSection');
  const logoutBtn = document.getElementById('logoutBtn');

  const user = await window.AuthAPI.me();

  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  loading.style.display = 'none';
  content.style.display = 'block';

  welcome.textContent = `¡Hola, ${user.username}!`;
  roleBadge.textContent = user.role === 'admin' ? 'Admin' : 'Usuario';
  roleBadge.classList.toggle('dashboard-header__role--admin', user.role === 'admin');

  if (user.role === 'admin') {
    adminSection.style.display = 'grid';
    cargarVisitas();
  }

  logoutBtn.addEventListener('click', async () => {
    await window.AuthAPI.logout();
    window.location.href = 'login.html';
  });
});

// Trae el detalle de visitas (solo Admin) para el período indicado, o el
// mes actual si no se pasa ninguno, y lo pinta en la tarjeta de Visitas.
async function cargarVisitas(periodo) {
  const url = periodo
    ? `/api/visitas/detalle?periodo=${encodeURIComponent(periodo)}`
    : '/api/visitas/detalle';

  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) return;

  const data = await res.json();
  if (!data.success) return;

  const select = document.getElementById('visitasPeriodoSelect');
  if (select && select.options.length === 0) {
    data.periodosDisponibles.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      select.appendChild(opt);
    });
    select.addEventListener('change', () => cargarVisitas(select.value));
  }
  if (select) select.value = data.detalle.periodo;

  document.getElementById('visitasResumenTotal').textContent = data.detalle.total;
  document.getElementById('visitasResumenUsuarios').textContent = data.detalle.totalUsuarios;
  document.getElementById('visitasResumenVisitantes').textContent = data.detalle.totalVisitantes;

  const tbodyUsuarios = document.querySelector('#visitasTablaUsuarios tbody');
  tbodyUsuarios.innerHTML = data.detalle.porUsuario.length
    ? data.detalle.porUsuario
        .map(
          (row) => `
      <tr>
        <td>${row.usuario}</td>
        <td>${row.visitas}</td>
        <td>${new Date(row.ultimaVisita).toLocaleString('es-AR')}</td>
      </tr>`
        )
        .join('')
    : '<tr><td colspan="3">Sin visitas registradas.</td></tr>';

  const tbodyVisitantes = document.querySelector('#visitasTablaVisitantes tbody');
  tbodyVisitantes.innerHTML = data.detalle.porVisitante.length
    ? data.detalle.porVisitante
        .map(
          (row) => `
      <tr>
        <td>${row.visitanteId.slice(0, 8)}…</td>
        <td>${row.visitas}</td>
        <td>${new Date(row.ultimaVisita).toLocaleString('es-AR')}</td>
      </tr>`
        )
        .join('')
    : '<tr><td colspan="3">Sin visitas registradas.</td></tr>';
}
