// Si vino con ?redirect=/algo (ej. desde el botón "Comprar" en el
// portfolio), vuelve ahí después de loguearse en vez de ir siempre al
// dashboard. Solo se acepta una ruta relativa propia del sitio (empieza
// con "/" y no con "//"), para no habilitar un open redirect.
function getRedirectDestino() {
  const params = new URLSearchParams(window.location.search);
  const destino = params.get('redirect');
  if (destino && destino.startsWith('/') && !destino.startsWith('//')) {
    return destino;
  }
  return 'dashboard.html';
}

document.addEventListener('DOMContentLoaded', () => {
  const destino = getRedirectDestino();

  const registroLink = document.getElementById('registroLink');
  if (registroLink && destino !== 'dashboard.html') {
    registroLink.href = `registro.html?redirect=${encodeURIComponent(destino)}`;
  }

  window.AuthAPI.me().then((user) => {
    if (user) window.location.href = destino;
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
        window.location.href = destino;
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
