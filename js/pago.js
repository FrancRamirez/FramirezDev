// js/pago.js
//
// Maneja el botón "Comprar" de la sección Aplicaciones:
//   1) Abre el modal y pide la config pública (public key, precio) a
//      /api/pagos/pago (GET)
//   2) Inicializa el Card Payment Brick del SDK de Mercado Pago dentro
//      del modal
//   3) Al enviar, manda los datos del Brick a /api/pagos/pago (POST)
//   4) Muestra el resultado (aprobado / rechazado / en revisión) y, si
//      corresponde, el link de descarga
//
// Requiere que en index.html esté cargado antes:
//   <script src="https://sdk.mercadopago.com/js/v2"></script>

(function () {
  const modal = document.getElementById('pagoModal');
  const statusEl = document.getElementById('pagoStatus');
  const BRICK_CONTAINER_ID = 'paymentBrick_container';

  let mp; // instancia del SDK, se crea una sola vez
  let brickController; // instancia del brick actual, para poder destruirlo al cerrar

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

  async function iniciarCompra(appId) {
    abrirModal();
    statusEl.textContent = 'Cargando...';

    try {
      const resp = await fetch('/api/pagos/pago');
      const config = await resp.json();
      if (!resp.ok) throw new Error(config.error || 'No se pudo cargar la configuración de pago.');

      if (!mp) {
        mp = new MercadoPago(config.publicKey, { locale: 'es-AR' });
      }

      statusEl.textContent = '';

      const bricksBuilder = mp.bricks();
      brickController = await bricksBuilder.create('cardPayment', BRICK_CONTAINER_ID, {
        initialization: {
          amount: config.precio,
        },
        callbacks: {
          onReady: () => {},
          onSubmit: (cardFormData) =>
            new Promise((resolve, reject) => {
              procesarPago(cardFormData).then(resolve).catch(reject);
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

  async function procesarPago(cardFormData) {
    statusEl.textContent = 'Procesando pago...';

    const resp = await fetch('/api/pagos/pago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardFormData),
    });
    const data = await resp.json();

    statusEl.textContent = data.message || '';

    if (data.status === 'approved' && data.downloadUrl) {
      statusEl.innerHTML = `${data.message} <a href="${data.downloadUrl}" class="pago-modal__descarga">Descargar ahora</a>`;
    }
  }

  document.addEventListener('click', (e) => {
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
})();
