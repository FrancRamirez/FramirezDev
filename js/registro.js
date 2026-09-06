document.addEventListener('DOMContentLoaded', () => {
  window.AuthAPI.me().then((user) => {
    if (user) window.location.href = 'dashboard.html';
  });

  const form = document.getElementById('registroForm');
  const status = document.getElementById('authStatus');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;
    const password2 = form.password2.value;

    if (password !== password2) {
      setStatus('Las contraseñas no coinciden.', 'error');
      return;
    }

    setStatus('Creando cuenta...', null);
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const { ok, data } = await window.AuthAPI.register(username, password);
      if (ok) {
        setStatus('Cuenta creada. Iniciando sesión...', 'success');
        const loginResult = await window.AuthAPI.login(username, password);
        if (loginResult.ok) {
          window.location.href = 'dashboard.html';
        } else {
          setStatus('Cuenta creada. Iniciá sesión manualmente.', 'success');
        }
      } else {
        setStatus(data.message || 'No se pudo crear la cuenta.', 'error');
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
