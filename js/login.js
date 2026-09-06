document.addEventListener('DOMContentLoaded', () => {
  window.AuthAPI.me().then((user) => {
    if (user) window.location.href = 'dashboard.html';
  });

  const form = document.getElementById('loginForm');
  const status = document.getElementById('authStatus');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;

    setStatus('Ingresando...', null);
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const { ok, data } = await window.AuthAPI.login(username, password);
      if (ok) {
        window.location.href = 'dashboard.html';
      } else {
        setStatus(data.message || 'No se pudo iniciar sesión.', 'error');
      }
    } catch (err) {
      setStatus('Error de conexión. Intentá de nuevo.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  function setStatus(message, type) {
    status.textContent = message;
    status.classList.remove('is-success', 'is-error');
    if (type) status.classList.add(`is-${type}`);
  }
});
