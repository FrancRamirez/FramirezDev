// js/pago.js
//
// Maneja los botones de compra ("Comprar") de cualquier app/juego de pago
// del portfolio (catálogo completo en lib/productos.js):
//   0) Al cargar la página, pide /api/pagos/pago (GET) — devuelve el
//      catálogo completo con precio de cada producto y, si hay sesión,
//      cuáles ya compró esa cuenta — para mostrar el precio en cada
//      botón y cambiarlo a "Descargar" directo en las que ya tiene.
//   1) Al hacer clic en "Comprar": si no hay sesión iniciada, manda a
//      login.html (con el registro también disponible desde ahí) en vez
//      de abrir el modal — comprar requiere cuenta, para poder descargar
//      la app (y sus futuras actualizaciones) para siempre.
//   2) Si hay sesión, abre el modal e inicializa el Card Payment Brick
//      del SDK de Mercado Pago para ESE producto puntual.
//   3) Al enviar, manda los datos del Brick a /api/pagos/pago?app=<id> (POST)
//   4) Muestra el resultado (aprobado / rechazado / en revisión) y, si
//      corresponde, el link de descarga
//
// Requiere que en index.html estén cargados antes:
//   <script src="js/auth.js"></script>   (expone window.AuthAPI)
//   <script src="https://sdk.mercadopago.com/js/v2"></script>

(function () {
  const modal = document.getElementById('pagoModal');
  const statusEl = document.getElementById('pagoStatus');
  const BRICK_CONTAINER_ID = 'paymentBrick_container';

  let mp; // instancia del SDK, se crea una sola vez (sirve para cualquier producto)
  let brickController; // instancia del brick actual, para poder destruirlo al cerrar
  let catalogoCache = null; // { publicKey, productos: [...] }, cacheado tras el primer fetch

  const formateadorPrecio = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });

  function abrirModal() {
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }

  function cerrarModal() {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    statusEl.textContent = '';
    if (brickController) {
      brickController.unmount();
      brickController = null;
    }
    document.getElementById(BRICK_CONTAINER_ID).innerHTML = '';
  }

  // Redirige a login.html guardando la página actual, para volver acá
  // apenas inicie sesión (login.js/registro.js ya saben leer ?redirect=).
  function irALogin() {
    const volver = encodeURIComponent(window.location.pathname + window.location.hash);
    window.location.href = `login.html?redirect=${volver}`;
  }

  async function obtenerCatalogo({ forzarRecarga = false } = {}) {
    if (catalogoCache && !forzarRecarga) return catalogoCache;
    const resp = await fetch('/api/pagos/pago', { credentials: 'include' });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'No se pudo cargar la configuración de pago.');
    catalogoCache = data;
    return data;
  }

  // Al cargar la página: mostrar el precio en cada botón "Comprar", y si
  // la cuenta logueada ya compró esa app puntual, convertir SU botón (no
  // los demás) en descarga directa (verde, sin pasar por el modal).
  async function inicializarBotones() {
    const botones = document.querySelectorAll('[data-buy-app]');
    if (botones.length === 0) return;

    try {
      const { productos } = await obtenerCatalogo();

      botones.forEach((btn) => {
        const producto = productos.find((p) => p.appId === btn.dataset.appId);
        if (!producto) return;

        const precioEl = btn.querySelector('[data-precio-label]');
        if (producto.yaComprado) {
          btn.classList.remove('app-card__buy--dorado');
          btn.classList.add('app-card__buy--comprado');
          btn.querySelector('span[data-i18n]').textContent = 'Descargar';
          if (precioEl) precioEl.textContent = '';
          btn.removeAttribute('data-buy-app');
          btn.setAttribute('data-download-owned-app', producto.appId);
        } else if (precioEl) {
          precioEl.textContent = formateadorPrecio.format(producto.precio);
        }
      });
    } catch (error) {
      console.error('No se pudo cargar el precio/estado de compra:', error);
    }
  }

  async function iniciarCompra(appId) {
    // Comprar requiere cuenta: se valida acá (no solo en el backend) para
    // no abrir el modal de pago innecesariamente si no hay sesión.
    const usuario = await window.AuthAPI.me();
    if (!usuario) {
      irALogin();
      return;
    }

    abrirModal();
    statusEl.textContent = 'Cargando...';

    try {
      const { publicKey, productos } = await obtenerCatalogo();
      const producto = productos.find((p) => p.appId === appId);
      if (!producto) throw new Error('Producto no encontrado.');

      if (!mp) {
        mp = new MercadoPago(publicKey, { locale: 'es-AR' });
      }

      statusEl.textContent = '';

      const bricksBuilder = mp.bricks();
      brickController = await bricksBuilder.create('cardPayment', BRICK_CONTAINER_ID, {
        initialization: {
          amount: producto.precio,
        },
        callbacks: {
          onReady: () => {},
          onSubmit: (cardFormData) =>
            new Promise((resolve, reject) => {
              procesarPago(appId, cardFormData).then(resolve).catch(reject);
            }),
          onError: (error) => {
            console.error('Error en el Brick de pago:', error);
            statusEl.textContent = 'Hubo un problema con el formulario de pago. Recargá e intentá de nuevo.';
          },
        },
      });
    } catch (error) {
      console.error('Error al iniciar la compra:', error);
      statusEl.textContent = 'No se pudo iniciar la compra. Intentá de nuevo más tarde.';
    }
  }

  async function procesarPago(appId, cardFormData) {
    statusEl.textContent = 'Procesando pago...';

    const resp = await fetch(`/api/pagos/pago?app=${encodeURIComponent(appId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(cardFormData),
    });
    const data = await resp.json();

    if (data.requiresAuth) {
      // La sesión venció justo mientras completaba el formulario de pago.
      statusEl.textContent = data.message || 'Tu sesión venció. Iniciá sesión de nuevo para continuar.';
      setTimeout(irALogin, 1500);
      return;
    }

    statusEl.textContent = data.message || '';

    if (data.status === 'approved' && data.downloadUrl) {
      statusEl.innerHTML = `${data.message} <a href="${data.downloadUrl}" class="pago-modal__descarga">Descargar ahora</a>`;
    }
  }

  document.addEventListener('click', (e) => {
    const ownedBtn = e.target.closest('[data-download-owned-app]');
    if (ownedBtn) {
      window.location.href = `/api/pagos/descargar?app=${ownedBtn.dataset.downloadOwnedApp}`;
      return;
    }
    const buyBtn = e.target.closest('[data-buy-app]');
    if (buyBtn) {
      iniciarCompra(buyBtn.dataset.appId);
      return;
    }
    if (e.target.closest('[data-pago-cerrar]')) {
      cerrarModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) cerrarModal();
  });

  document.addEventListener('DOMContentLoaded', inicializarBotones);
})();
