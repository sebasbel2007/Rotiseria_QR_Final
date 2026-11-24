// js/router.js
(() => {

  let _usuarioActual  = null;
  let _pedidoActivoId = null;

  // ── Helpers URL ────────────────────────────────────────────────
  function _getMesaFromURL() {
    const p = new URLSearchParams(location.search);
    return p.has('mesa') ? parseInt(p.get('mesa'), 10) : null;
  }

  function _isTVRoute() {
    return location.pathname === '/tv' || location.search.includes('tv=1');
  }

  // ── Exposed ────────────────────────────────────────────────────
  function obtenerUsuarioActual() { return _usuarioActual; }

  function setPedidoActivo(id) {
    _pedidoActivoId = id;
    _actualizarBtnPedidoActivo();
  }

  function _actualizarBtnPedidoActivo() {
    const btn = document.getElementById('btn-ver-pedido');
    if (!btn) return;
    btn.style.display = _pedidoActivoId ? 'inline-flex' : 'none';
  }

  function irAlTracker(pedidoId) {
    if (!pedidoId) return;
    setPedidoActivo(pedidoId);
    renderizarTracker(pedidoId);
  }

  function ocultarSpinner() {
    const spinner = document.getElementById('initial-spinner');
    if (spinner) spinner.remove();
  }

  // ── Header por modo ───────────────────────────────────────────
  function _renderHeaderMesa(numeroMesa) {
    const nav     = document.getElementById('header-nav');
    const actions = document.getElementById('header-actions');
    nav.innerHTML = `<button class="header__nav-link header__nav-link--active">🍽️ Mesa ${numeroMesa}</button>`;
    actions.innerHTML = `
      <button class="header__nav-link" onclick="abrirBottomSheet()">
        🛒 <span class="badge--count" id="mesa-cart-badge">0</span>
      </button>`;
  }

  function _renderHeaderTV() {
    const nav     = document.getElementById('header-nav');
    const actions = document.getElementById('header-actions');
    nav.innerHTML = `<button class="header__nav-link header__nav-link--active">📺 Lobby TV</button>`;
    actions.innerHTML = '';
  }

  function renderizarHeader(usuario) {
    const nav     = document.getElementById('header-nav');
    const actions = document.getElementById('header-actions');

    if (!usuario) {
      nav.innerHTML     = '';
      actions.innerHTML = '';
      return;
    }

    if (usuario.rol === 'cliente') {
      nav.innerHTML = `
        <button class="header__nav-link" onclick="renderizarCliente()">🍽️ Menú</button>
        <button class="header__nav-link btn-pedido-activo" id="btn-ver-pedido"
                style="display:none;background:rgba(245,176,65,0.2);color:var(--dorado-fritura)"
                onclick="irAlTracker(_pedidoActivoId)">
          📦 Mi pedido
        </button>
        <button class="header__nav-link" onclick="abrirCarrito()">
          🛒 Carrito <span class="badge--count" id="cart-badge">0</span>
        </button>`;
      _actualizarBtnPedidoActivo();
    } else if (usuario.rol === 'cajero') {
      nav.innerHTML = `<button class="header__nav-link header__nav-link--active">📋 POS</button>`;
    } else if (usuario.rol === 'cocina') {
      nav.innerHTML = `<button class="header__nav-link header__nav-link--active">👨‍🍳 Cocina</button>`;
    } else if (usuario.rol === 'admin') {
      nav.innerHTML = `
        <button class="header__nav-link header__nav-link--active">⚙️ Admin</button>`;
    }

    actions.innerHTML = `
      <span class="header__user-name">Hola, <strong>${usuario.nombre}</strong></span>
      <button class="btn btn--outline btn--sm"
              style="border-color:rgba(255,255,255,0.5);color:#fff;"
              onclick="logout().then(()=>renderizarLogin())">
        Salir
      </button>`;
  }

  // ── Limpiar body classes ───────────────────────────────────────
  function _clearBodyModes() {
    document.body.classList.remove(
      'modo-cocina', 'modo-cajero', 'modo-admin', 'modo-mesa', 'tv-kiosco'
    );
  }

  // ── Router principal ───────────────────────────────────────────
  function iniciarRouter() {
    cargarConfig();

    // 1. Modo mesa: ?mesa=N → sin auth, PWA
    const mesaNum = _getMesaFromURL();
    if (mesaNum !== null) {
      ocultarSpinner();
      _clearBodyModes();
      document.body.classList.add('modo-mesa');
      _renderHeaderMesa(mesaNum);
      _setupMesaMode(mesaNum).catch(e => {
        console.error('Error en modo mesa:', e);
        _renderMesaError(mesaNum, 'Error', 'Ocurrió un error inesperado.');
      });
      return; // No escuchar auth
    }

    // 2. Modo TV: /tv → auth con rol tv
    if (_isTVRoute()) {
      auth.onAuthStateChanged(async (user) => {
        ocultarSpinner();
        if (!user) {
          renderizarLogin();
          return;
        }
        const datos = await obtenerUsuario(user.uid);
        if (!datos || datos.rol !== 'tv') {
          mostrarToast('Acceso no autorizado.', 'error');
          await logout();
          return;
        }
        _clearBodyModes();
        document.body.classList.add('tv-kiosco');
        _renderHeaderTV();
        renderizarTV();
      });
      return;
    }

    // 3. Modo normal: auth + rol
    auth.onAuthStateChanged(async (user) => {
      ocultarSpinner();

      if (!user) {
        _usuarioActual = null;
        renderizarHeader(null);
        renderizarLogin();
        return;
      }

      const datos = await obtenerUsuario(user.uid);

      if (!datos) {
        _usuarioActual = null;
        renderizarHeader(null);
        mostrarToast('Tu cuenta no tiene perfil asignado. Contactá al administrador.', 'error');
        await logout();
        return;
      }

      _usuarioActual = { uid: user.uid, ...datos };
      renderizarHeader(_usuarioActual);

      _clearBodyModes();
      if (datos.rol === 'cocina') document.body.classList.add('modo-cocina');
      if (datos.rol === 'cajero') document.body.classList.add('modo-cajero');
      if (datos.rol === 'admin')  document.body.classList.add('modo-admin');

      switch (datos.rol) {
        case 'cliente': renderizarCliente(); break;
        case 'cocina':  renderizarCocina();  break;
        case 'cajero':  renderizarCajero();  break;
        case 'admin':   renderizarAdmin();   break;
        default:
          mostrarToast('Rol desconocido. Contactá al administrador.', 'error');
          await logout();
      }
    });
  }

  // ── Modo Mesa: sin auth, solo carrito + menú ──────────────────
  async function _setupMesaMode(numeroMesa) {
    // 1. Validar que la mesa exista y esté activa
    let mesaDoc = null;

    const snap1 = await db.collection('mesas')
      .where('numero', '==', numeroMesa).limit(1).get();
    if (!snap1.empty) mesaDoc = snap1.docs[0];

    if (!mesaDoc) {
      const snap2 = await db.collection('mesas')
        .where('numero', '==', String(numeroMesa)).limit(1).get();
      if (!snap2.empty) mesaDoc = snap2.docs[0];
    }

    if (!mesaDoc) {
      _renderMesaError(numeroMesa, 'Mesa no encontrada', 'Esta mesa no existe en el sistema.');
      return;
    }

    const mesaData = mesaDoc.data();

    if (!mesaData.activa) {
      _renderMesaError(numeroMesa, 'Mesa inactiva', 'Esta mesa fue desactivada por el personal.');
      return;
    }

    // 2. Lock de sesión: impedir doble escaneo
    const deviceId = _getDeviceId();
    const scanKey = `mesa:${numeroMesa}:scan`;
    const mySession = localStorage.getItem(scanKey);

    if (mesaData.scan_session_id && mesaData.scan_session_id !== deviceId) {
      // Otro dispositivo tiene la mesa activa
      const scanAt = mesaData.scan_at?.toDate?.() || new Date(0);
      const minsSince = (Date.now() - scanAt.getTime()) / 60000;

      if (minsSince < 5) {
        _renderMesaError(numeroMesa, 'Mesa en uso',
          `Otra persona ya está usando esta mesa (hace ${Math.floor(minsSince)} min). Esperá a que termine.`);
        return;
      }
      // Si pasaron >5 min, permitir reclamar
    }

    // 3. Reclamar sesión (silencioso si falla)
    try {
      await db.collection('mesas').doc(mesaDoc.id).update({
        scan_session_id: deviceId,
        scan_at: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn('No se pudo actualizar sesión de mesa:', e.message);
    }
    localStorage.setItem(scanKey, deviceId);

    // Esta visita es de ESTA mesa (siempre, haya o no pedido activo):
    // si no, en la ronda 2 el carrito se leía/escribía con la clave de otra mesa.
    localStorage.setItem('mesa_actual', numeroMesa);

    // 4. Verificar pedido activo SIN entregado_mozo
    try {
      // Filtra por cliente_uid ('mesa:N'): es lo que las reglas de Firestore
      // exigen para que un cliente sin sesión pueda leer sus pedidos (el
      // filtro por mesa_id solo daba "permission denied"). Los filtros de
      // estado se hacen en memoria → no necesita índice compuesto.
      const snap = await db.collection('pedidos')
        .where('cliente_uid', '==', `mesa:${numeroMesa}`)
        .get();

      const pedidosActivos = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.entregado !== true && !['Cancelado', 'Entregado'].includes(p.estado_cocina));

      if (pedidosActivos.length) {
        // Hay pedido en curso → LIMPIAR CARRITO VIEJO + DASHBOARD
        localStorage.removeItem(`mesa:${numeroMesa}:cart`);

        // `_abrirDashboardMesa` inicializa el contexto de mesa (si no salía
        // "Mesa null"), engancha el listener ANTES de pintar y recién ahí
        // renderiza. Antes se llamaba `_cleanupCliente()` (que mataba el
        // listener) y la pantalla se quedaba estática para siempre.
        if (typeof window._abrirDashboardMesa === 'function') {
          window._abrirDashboardMesa(numeroMesa, pedidosActivos);
        } else if (typeof window._renderDashboardEspera === 'function') {
          window._renderDashboardEspera(pedidosActivos);
        } else {
          // Fallback: renderizarCliente y el listener se encargará
          renderizarCliente();
        }
        return;
      }

      // 5. No hay pedido → flujo normal catálogo
      localStorage.setItem('mesa_actual', numeroMesa);
      renderizarCliente();
    } catch (e) {
      // Error específico: query requires index
      if (e.code === 'failed-precondition' && e.message.includes('index')) {
        console.error('Falta índice compuesto en pedidos:', e);
        _renderMesaError(numeroMesa, 'Configuración requerida',
          'Falta índice en Firestore. Contactá al administrador.');
        return;
      }
      console.error('Error en modo mesa:', e);
      _renderMesaError(numeroMesa, 'Error', 'Ocurrió un error inesperado.');
      return;
    }
  }

  function _renderMesaError(numero, titulo, mensaje) {
    ocultarSpinner();
    document.getElementById('app').innerHTML = `
      <div class="cliente-mesa-wrap" style="display:flex;align-items:center;justify-content:center;min-height:60vh">
        <div style="text-align:center;max-width:400px;padding:var(--space-6)">
          <div style="font-size:64px;margin-bottom:var(--space-4)">🚫</div>
          <h2 style="color:var(--gris-carbon);margin-bottom:var(--space-2)">${titulo}</h2>
          <p style="color:var(--gris-medio);margin-bottom:var(--space-4)">Mesa ${numero} — ${mensaje}</p>
          <button class="btn btn--primary" onclick="location.href='/'">Volver al inicio</button>
        </div>
      </div>`;
  }

  function _getDeviceId() {
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('device_id', id);
    }
    return id;
  }

  // ── Candado de escaneo (lo usa cliente.js en la ronda 2) ───────
  async function _mesaDocPorNumero(numero) {
    let snap = await db.collection('mesas')
      .where('numero', '==', numero).limit(1).get();
    if (snap.empty) {
      snap = await db.collection('mesas')
        .where('numero', '==', String(numero)).limit(1).get();
    }
    return snap.empty ? null : snap.docs[0];
  }

  // "Sí, quiero otro pedido": volvemos a tomar el candado de escaneo
  // (caja lo liberó al cobrar/limpiar la mesa).
  async function _reclamarMesa(numero) {
    try {
      const doc = await _mesaDocPorNumero(numero);
      if (!doc) return false;
      await db.collection('mesas').doc(doc.id).update({
        scan_session_id: _getDeviceId(),
        scan_at: firebase.firestore.FieldValue.serverTimestamp(),
      });
      localStorage.setItem(`mesa:${numero}:scan`, _getDeviceId());
      return true;
    } catch (e) {
      console.warn('No se pudo reclamar la mesa:', e.message);
      return false;
    }
  }

  // "No, gracias": dejamos la mesa libre para que otro celular pueda escanear.
  // Sólo liberamos si el candado es de ESTE dispositivo (si otro se la tomó,
  // no podemos tocarla).
  async function _liberarMesaCliente(numero) {
    try {
      const doc = await _mesaDocPorNumero(numero);
      if (!doc) return false;
      const data = doc.data();
      if (data.scan_session_id && data.scan_session_id !== _getDeviceId()) return false;
      await db.collection('mesas').doc(doc.id).update({
        scan_session_id: null,
        scan_at: null,
      });
      localStorage.removeItem(`mesa:${numero}:scan`);
      return true;
    } catch (e) {
      console.warn('No se pudo liberar la mesa:', e.message);
      return false;
    }
  }

  // ── Expose ─────────────────────────────────────────────────────
  window.obtenerUsuarioActual = obtenerUsuarioActual;
  window.setPedidoActivo      = setPedidoActivo;
  window.irAlTracker          = irAlTracker;
  window.iniciarRouter        = iniciarRouter;
  window.renderizarHeader     = renderizarHeader;
  window._reclamarMesa        = _reclamarMesa;
  window._liberarMesaCliente  = _liberarMesaCliente;
  Object.defineProperty(window, '_pedidoActivoId', {
    get: () => _pedidoActivoId
  });

})();
