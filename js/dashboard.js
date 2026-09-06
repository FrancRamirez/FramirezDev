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
  }

  logoutBtn.addEventListener('click', async () => {
    await window.AuthAPI.logout();
    window.location.href = 'login.html';
  });
});
