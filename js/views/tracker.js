// js/views/tracker.js
(() => {

  let _unsubTracker = null;
  let _esMesa = false;
  let _numeroMesa = null;

  const ESTADOS_TRACKER = [
    { key: 'Pendiente confirma caja', label: 'Esperando caja',    icono: '⏳' },
    { key: 'Pendiente',                label: 'Pedido recibido',   icono: '📋' },
    { key: 'En Preparación',           label: 'En preparación',    icono: '👨‍🍳' },
    { key: 'Demorado',                 label: 'Demorado',          icono: '⚠️' },
    { key: 'Listo para Retirar/Comer', label: 'Listo para retirar', icono: '✅' },
    { key: 'Enviado',                  label: 'En camino',         icono: '🛵' },
    { key: 'Cancelado',                label: 'Cancelado',         icono: '❌' },
  ];

  function renderizarTracker(pedidoId) {
    const params = new URLSearchParams(location.search);
    _esMesa = params.has('mesa');
    _numeroMesa = _esMesa ? parseInt(params.get('mesa'), 10) : null;

    // Manejar retorno de MP
    _checkMPReturn();

    if (_esMesa) {
      _escucharPedidoMesa();
      return;
    }

    if (!pedidoId) return;
    _mostrarTrackerUnico(pedidoId);
  }

  // ── Retorno de MercadoPago ─────────────────────────────────
  function _checkMPReturn() {
    const params = new URLSearchParams(location.search);
    const mpResult = params.get('mp_result');
    const paymentId = params.get('payment_id');

    if (mpResult) {
      if (mpResult === 'approved') {
        setTimeout(() => mostrarToast('¡Pago aprobado! 🎉', 'success'), 500);
      } else if (mpResult === 'rejected') {
        setTimeout(() => mostrarToast('El pago fue rechazado. Intentá de nuevo.', 'error'), 500);
      } else {
        setTimeout(() => mostrarToast('Pago pendiente de verificación', 'warning'), 500);
      }
      // Limpiar URL
      const cleanUrl = _numeroMesa ? `/?mesa=${_numeroMesa}` : '/';
      window.history.replaceState({}, '', cleanUrl);
    }
  }

  // ── Multi-pedido mesa ──────────────────────────────────────
  function _escucharPedidoMesa() {
    if (!_numeroMesa) return;
    if (_unsubTracker) _unsubTracker();

    _unsubTracker = escucharPedidosMesa(_numeroMesa, (pedidos) => {
      if (!pedidos.length) {
        _volverAMenu();
        return;
      }
      _renderTrackerMesa(pedidos);
    });
  }

  function _renderTrackerMesa(pedidos) {
    const app = document.getElementById('app');
    if (!app) return;

    const pedidosActivos = pedidos.filter(p =>
      ['Pendiente confirma caja','Pendiente','En Preparación','Demorado','Listo para Retirar/Comer'].includes(p.estado_cocina)
    );
    const pedidosNoPagados = pedidos.filter(p => p.estado_pago === 'Pendiente' || p.estado_pago === 'Pendiente verificacion MP');
    const totalNoPagados = pedidosNoPagados.reduce((sum, p) => sum + (p.total || 0), 0);

    app.innerHTML = `
      <div class="tracker-wrap">
        <div class="tracker-card">
          <div class="tracker-header">
            <h2 class="tracker-header__title">🍽️ Mesa ${_numeroMesa}</h2>
            <p class="tracker-header__id">${pedidos.length} pedido(s)</p>
          </div>
          <div id="tracker-body">
            ${pedidos.map(p => _renderPedidoCard(p)).join('')}
          </div>
        </div>

        <div class="tracker-mesa-actions">
          ${pedidosNoPagados.length ? `
            <button class="btn btn--primary btn--full btn--lg" onclick="pagarTodoMesa()">
              💳 Pagar todo (${formatearPrecio(totalNoPagados)})
            </button>
            <p class="tracker-pay-all__detail">${pedidosNoPagados.length} pedido(s) sin pagar</p>
          ` : `
            <div class="tracker-all-paid">
              <span>✅ Todos los pedidos pagados</span>
            </div>
          `}
          <button class="btn btn--secondary btn--full" onclick="hacerOtroPedido()">
            🍽️ Hacer otro pedido
          </button>
          <button class="btn btn--ghost btn--full" onclick="volverMenuMesa()">
            ← Volver al menú
          </button>
        </div>
      </div>`;
  }

  function _renderPedidoCard(pedido) {
    const estadoActual = pedido.estado_cocina;
    const ticket = pedido.id.slice(-6).toUpperCase();
    const idxActual = ESTADOS_TRACKER.findIndex(e => e.key === estadoActual);
    const estadosProgreso = ESTADOS_TRACKER.filter(e => e.key !== 'Demorado' && e.key !== 'Cancelado');
    const idxProgreso = estadosProgreso.findIndex(e => e.key === estadoActual);
    // idxProgreso puede ser -1 (estado no contemplado, ej: 'Enviado' de delivery):
    // sin este guard el porcentaje quedaba negativo y la barra no se movía.
    const porcentaje = estadoActual === 'Demorado' ? 33
      : idxProgreso < 0 ? 0
      : Math.round((idxProgreso / (estadosProgreso.length - 1)) * 100);

    const pagoBadge = pedido.estado_pago === 'Pagado'
      ? '<span class="badge badge--listo">✅ Pagado</span>'
      : pedido.estado_pago === 'Pendiente verificacion MP'
        ? '<span class="badge badge--mp-pendiente">📱 MP verificando</span>'
        : '<span class="badge badge--pendiente">⏳ Sin pagar</span>';

    return `
      <div class="tracker-pedido-card ${estadoActual === 'Listo para Retirar/Comer' ? 'tracker-pedido-card--listo' : ''}">
        <div class="tracker-pedido-card__header">
          <span class="tracker-pedido-card__ticket">#${ticket}</span>
          ${pagoBadge}
        </div>

        <div class="tracker-progress">
          <div class="tracker-progress__bar">
            <div class="tracker-progress__fill" style="width:${porcentaje}%"></div>
          </div>
          <div class="tracker-steps">
            ${estadosProgreso.map((e, i) => {
              const completado = idxProgreso > i || estadoActual === 'Listo para Retirar/Comer';
              const activo = e.key === estadoActual;
              return `
                <div class="tracker-step ${completado ? 'tracker-step--done' : ''} ${activo ? 'tracker-step--active' : ''}">
                  <div class="tracker-step__dot">${completado ? '✓' : e.icono}</div>
                  <p class="tracker-step__label">${e.label}</p>
                </div>`;
            }).join('')}
          </div>
        </div>

        <div class="tracker-estado tracker-estado--${claseEstado(estadoActual)}">
          <span class="tracker-estado__icono">${ESTADOS_TRACKER[idxActual]?.icono || '📋'}</span>
          <div>
            <p class="tracker-estado__valor">${estadoActual}</p>
          </div>
        </div>

        <div class="tracker-detalle">
          ${(pedido.items || []).map(i => `
            <div class="tracker-detalle__item">
              <span>${i.cantidad}× ${i.nombre}${i.variante ? ` (${i.variante})` : ''}${i.notas ? ` <em style="font-size:var(--text-xs);color:var(--dorado-fritura)">— ${i.notas}</em>` : ''}</span>
              <span>${formatearPrecio(i.subtotal)}</span>
            </div>`).join('')}
          <div class="tracker-detalle__total">
            <span>Total</span>
            <strong>${formatearPrecio(pedido.total)}</strong>
          </div>
        </div>

        ${estadoActual === 'Listo para Retirar/Comer' ? `
          <div class="tracker-listo-banner">
            🎉 ¡Pedido listo! Pasá a buscarlo.
          </div>
          ${(pedido.estado_pago !== 'Pagado') ? `
            <div class="tracker-pago-acciones" style="margin-top:16px;padding:16px;background:var(--flat-red-light);border-radius:var(--flat-radius-md);text-align:center">
              <p style="font-size:var(--text-sm);color:var(--flat-red);margin-bottom:12px">El pedido está listo pero no pagado</p>
              <button class="flat-btn flat-btn--primary flat-btn--full flat-btn--lg" onclick="pagarPedidoMP('${pedido.id}', ${pedido.total})">
                💳 Pagar con MercadoPago
              </button>
              <p style="font-size:var(--text-xs);color:var(--flat-text-muted);margin-top:8px">Te redirige a la app/web de MercadoPago</p>
            </div>` : ''}
        ` : ''}
      </div>`;
  }

  // ── Tracker individual (non-mesa) ──────────────────────────
  function _mostrarTrackerUnico(pedidoId) {
    document.getElementById('app').innerHTML = `
      <div class="tracker-wrap">
        <div class="tracker-card">
          <div class="tracker-header">
            <h2 class="tracker-header__title">Seguimiento de tu pedido</h2>
            <p class="tracker-header__id">Ticket #${pedidoId.slice(-6).toUpperCase()}</p>
          </div>
          <div id="tracker-body">
            <div class="spinner-container"><div class="spinner"></div></div>
          </div>
        </div>
        <button class="btn btn--ghost" onclick="window._limpiarTracker(); renderizarCliente()">
          ← Volver al menú
        </button>
      </div>`;

    if (_unsubTracker) _unsubTracker();
    _unsubTracker = escucharPedido(pedidoId, (pedido) => {
      const body = document.getElementById('tracker-body');
      if (!body) { _limpiarTracker(); return; }
      _renderPedidoCard(pedido);
      body.innerHTML = _renderPedidoCard(pedido);
    });
  }

  // ── Acciones mesa ──────────────────────────────────────────
  window.pagarPedidoMP = async (pedidoId, total) => {
  try {
    const res = await fetch('/api/mp-preference-for-pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedidoId })
    });
    if (!res.ok) throw new Error('Error creando preferencia');
    const data = await res.json();
    mostrarToast('Redirigiendo a MercadoPago...', 'success');
    window.location.href = data.init_point;
  } catch (err) {
    console.error('Error MP:', err);
    mostrarToast('Error al conectar con MercadoPago', 'error');
  }
};

  // NOTE: `hacerOtroPedido()` ahora vive en js/views/cliente.js
  // (es la misma acción para el dashboard de espera y para el tracker de mesa,
  //  y resetea además el flag de "pago reciente" + carrito + candado de mesa).
  // tracker.js se carga DESPUÉS que cliente.js, por eso se quitó de acá:
  // si no, pisaba la definición.

  window.volverMenuMesa = () => {
    _limpiarTracker();
    renderizarCliente();
  };

  window.pagarTodoMesa = async () => {
    try {
      const pedidos = await obtenerPedidosNoPagadosMesa(_numeroMesa);
      if (!pedidos.length) {
        mostrarToast('No hay pedidos sin pagar', 'info');
        return;
      }

      const total = pedidos.reduce((sum, p) => sum + (p.total || 0), 0);
      const pedidoIds = pedidos.map(p => p.id);

      abrirModal(`
        <div class="modal modal--visible">
          <div class="modal__box">
            <div class="modal__header">
              <h3 class="modal__title">💳 Pagar todo — Mesa ${_numeroMesa}</h3>
              <button class="modal__close" onclick="cerrarModal()">✕</button>
            </div>
            <div class="modal__body">
              <p class="modal-total">${pedidos.length} pedido(s) — Total: <strong>${formatearPrecio(total)}</strong></p>
              <div class="checkout-metodos" style="margin-top:var(--space-4)">
                <button class="metodo-btn" onclick="pagarMesaEfectivo()">
                  💵 Efectivo
                </button>
                <button class="metodo-btn" onclick="pagarMesaMP(${total}, '${_numeroMesa}', '${JSON.stringify(pedidoIds).replace(/'/g, "\\'")}')">
                  📱 MercadoPago
                </button>
              </div>
              <p style="font-size:var(--text-xs);color:var(--gris-medio);margin-top:var(--space-3);text-align:center">
                Efectivo se confirma en caja
              </p>
            </div>
          </div>
        </div>
      `);
    } catch (err) {
      console.error('Error al obtener pedidos:', err);
      mostrarToast('Error al procesar', 'error');
    }
  };

  window.pagarMesaEfectivo = () => {
    cerrarModal();
    mostrarToast('Pagá en caja al finalizar 🍽️', 'info');
  };

  window.pagarMesaMP = async (total, mesaId, pedidoIdsJson) => {
    cerrarModal();
    try {
      const pedidoIds = JSON.parse(pedidoIdsJson);
      const res = await fetch('/api/mp-preference-for-mesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesa_id: mesaId, pedido_ids: pedidoIds })
      });
      if (!res.ok) throw new Error('Error creando preferencia');
      const data = await res.json();
      mostrarToast('Redirigiendo a MercadoPago...', 'success');
      window.location.href = data.init_point;
    } catch (err) {
      console.error('Error MP:', err);
      mostrarToast('Error al conectar con MercadoPago', 'error');
    }
  };

  function _limpiarTracker() {
    if (_unsubTracker) { _unsubTracker(); _unsubTracker = null; }
  }

  window.renderizarTracker = renderizarTracker;
  window._limpiarTracker   = _limpiarTracker;

})();
