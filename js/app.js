// js/app.js
// Entry point — se ejecuta último, después de cargar todos los scripts
(() => {

  // ── Toast global ──────────────────────────────────────────────
  function mostrarToast(mensaje, tipo = 'info', duracion = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${tipo}`;
    toast.textContent = mensaje;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duracion);
  }

  // ── Overlay / Carrito ─────────────────────────────────────────
  function abrirCarrito() {
    document.getElementById('cart-sidebar').classList.add('cart-sidebar--open');
    document.getElementById('overlay').classList.add('overlay--visible');
  }

  function cerrarCarrito() {
    document.getElementById('cart-sidebar').classList.remove('cart-sidebar--open');
    document.getElementById('overlay').classList.remove('overlay--visible');
  }

  document.getElementById('cart-close-btn').addEventListener('click', cerrarCarrito);
  document.getElementById('overlay').addEventListener('click', () => {
    cerrarCarrito();
    cerrarModal();
  });

  // ── Modal global ──────────────────────────────────────────────
  function abrirModal(htmlContenido) {
    const container = document.getElementById('modal-container');
    container.innerHTML = htmlContenido;
    container.querySelector('.modal').classList.add('modal--visible');
    document.getElementById('overlay').classList.add('overlay--visible');
  }

  function cerrarModal() {
    const container = document.getElementById('modal-container');
    container.innerHTML = '';
    document.getElementById('overlay').classList.remove('overlay--visible');
  }

  window.mostrarToast  = mostrarToast;
  window.abrirCarrito  = abrirCarrito;
  window.cerrarCarrito = cerrarCarrito;
  window.abrirModal    = abrirModal;
  window.cerrarModal   = cerrarModal;

  // ── PWA: Service Worker + Install Prompt ──────────────────────
  let _deferredPrompt = null;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    _deferredPrompt = e;
    const params = new URLSearchParams(location.search);
    if (params.has('mesa')) _mostrarBannerInstalacion();
  });

  function _mostrarBannerInstalacion() {
    const banner = document.createElement('div');
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
      <span>📲 Instalá la app para un acceso más rápido</span>
      <button class="btn btn--primary btn--sm" id="pwa-install-btn">Instalar</button>
      <button class="btn btn--ghost btn--sm" id="pwa-dismiss-btn">✕</button>`;
    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (!_deferredPrompt) return;
      _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      if (outcome === 'accepted') mostrarToast('App instalada ✅', 'success');
      _deferredPrompt = null;
      banner.remove();
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      banner.remove();
    });
  }

  // ── Iniciar app ───────────────────────────────────────────────
  iniciarRouter();

})();
