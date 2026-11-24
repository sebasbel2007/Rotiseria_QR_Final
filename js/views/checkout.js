// js/views/checkout.js
(() => {

  let _consumoSeleccionado    = null;
  let _metodoPagoSeleccionado = null;
  let _mpPreference           = null;
  let _esMesa                 = false;

  function renderizarCheckout() {
    const items = obtenerCarrito();
    const total = obtenerTotal();

    if (!items.length) { renderizarCliente(); return; }

    const params = new URLSearchParams(location.search);
    _esMesa = params.has('mesa');
    const mesaId = params.get('mesa');

    if (_esMesa) _consumoSeleccionado = 'Comer en el local';

    document.getElementById('app').innerHTML = `
      <div class="checkout-wrap">

        <div class="checkout-card">
          <h2 class="checkout-card__title">📋 Tu pedido</h2>
          <div class="checkout-items">
            ${items.map(i => `
              <div class="checkout-item">
                <div class="checkout-item__info">
                  <span class="checkout-item__name">${i.cantidad}× ${i.nombre}${i.variante ? ` <em>(${i.variante})</em>` : ''}</span>
                  <input class="form-input checkout-item__notas" type="text"
                         data-key="${i._key}"
                         value="${(i.notas || '').replace(/"/g, '&quot;')}"
                         placeholder="Notas (ej: sin cebolla)"
                         oninput="_actualizarNotaItem('${i._key}', this.value)" />
                </div>
                <span class="checkout-item__price">${formatearPrecio(i.subtotal)}</span>
              </div>`).join('')}
          </div>
          <div class="checkout-total" id="checkout-total-display">
            <span>Total</span>
            <strong>${formatearPrecio(total)}</strong>
          </div>
        </div>

        ${!_esMesa ? `
        <div class="checkout-card">
          <h2 class="checkout-card__title">🪑 ¿Cómo consumís?</h2>
          <div class="checkout-consumo">
            <label class="consumo-option" id="opt-local">
              <input type="radio" name="consumo" value="Comer en el local" onchange="seleccionarConsumo(this)" />
              <span class="consumo-option__icon">🍽️</span>
              <span class="consumo-option__label">En el local</span>
            </label>
            <label class="consumo-option" id="opt-retirar">
              <input type="radio" name="consumo" value="Retirar" onchange="seleccionarConsumo(this)" />
              <span class="consumo-option__icon">🥡</span>
              <span class="consumo-option__label">Para llevar</span>
            </label>
            <label class="consumo-option" id="opt-domicilio">
              <input type="radio" name="consumo" value="Domicilio" onchange="seleccionarConsumo(this)" />
              <span class="consumo-option__icon">🛵</span>
              <span class="consumo-option__label">Delivery</span>
            </label>
          </div>
        </div>` : `
        <div class="checkout-card checkout-card--mesa">
          <p class="checkout-mesa-label">🪑 Mesa ${mesaId} — Comer en el local</p>
        </div>`}

        <div class="checkout-card" id="delivery-fields" style="display:none">
          <h2 class="checkout-card__title">📍 Dirección de entrega</h2>
          <div class="form-group">
            <label class="form-label">Dirección completa</label>
            <textarea class="form-textarea" id="direccion-input"
                      placeholder="Ej: Av. San Martín 1234, piso 2, depto B"
                      rows="2" oninput="_verificarListo()"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Referencia (opcional)</label>
            <input class="form-input" type="text" id="referencia-input"
                   placeholder="Ej: casa pintada de azul, reja negra" />
          </div>
          <div class="delivery-recargo" id="delivery-recargo">
            <span>+15% recargo delivery</span>
            <strong id="delivery-recargo-monto"></strong>
          </div>
        </div>

        <div class="checkout-card">
          <h2 class="checkout-card__title">💳 ¿Cómo pagás?</h2>
          <div class="checkout-metodos">
            ${['Efectivo','MercadoPago'].map(m => `
              <button class="metodo-btn" onclick="seleccionarMetodo('${m}')" data-metodo="${m}">
                ${_iconoMetodo(m)} ${m}
              </button>`).join('')}
          </div>
          <div id="form-pago-container"></div>
        </div>

        <div class="checkout-card">
          <h2 class="checkout-card__title">📝 Notas del pedido <span style="font-weight:400;font-size:var(--text-sm);color:var(--gris-medio)">(opcional)</span></h2>
          <textarea class="form-textarea" id="notas-cliente" placeholder="Ej: sin cebolla, salsa aparte..."></textarea>
        </div>

        <button class="btn btn--primary btn--full btn--lg" id="btn-confirmar"
                onclick="confirmarPedido()" disabled>
          Confirmar pedido
        </button>
        <button class="btn btn--ghost btn--full" onclick="renderizarCliente()">← Volver al menú</button>

      </div>`;

    _metodoPagoSeleccionado = null;
    _mpPreference = null;
    if (!_esMesa) _consumoSeleccionado = null;
    _verificarListo();
  }

  function _iconoMetodo(m) {
    const iconos = {
      'Efectivo':       '💵',
      'MercadoPago':    '📱'
    };
    return iconos[m] || '💰';
  }

  // ── Notas por item ────────────────────────────────────────
  window._actualizarNotaItem = (key, value) => {
    const carrito = window._carrito || [];
    const item = carrito.find(i => i._key === key);
    if (item) item.notas = value;
  };

  // ── Consumo ───────────────────────────────────────────────
  function seleccionarConsumo(radio) {
    _consumoSeleccionado = radio.value;
    document.querySelectorAll('.consumo-option').forEach(el => el.classList.remove('consumo-option--active'));
    radio.closest('.consumo-option').classList.add('consumo-option--active');

    const deliveryFields = document.getElementById('delivery-fields');
    if (deliveryFields) {
      deliveryFields.style.display = _consumoSeleccionado === 'Domicilio' ? 'block' : 'none';
    }

    if (_consumoSeleccionado === 'Domicilio') {
      const usuario = obtenerUsuarioActual();
      if (!usuario) {
        mostrarToast('Necesitás iniciar sesión para delivery', 'warning');
        renderizarLogin();
        return;
      }
      _actualizarRecargo();
    }

    _verificarListo();
  }

  function _actualizarRecargo() {
    const base = obtenerTotal();
    const recargoPct = (window.APP_CONFIG?.recargo_delivery_pct || 15) / 100;
    const recargo = Math.round(base * recargoPct);
    const total = base + recargo;

    const montoEl = document.getElementById('delivery-recargo-monto');
    if (montoEl) montoEl.textContent = `+${formatearPrecio(recargo)}`;

    const totalEl = document.getElementById('checkout-total-display');
    if (totalEl) {
      totalEl.innerHTML = `
        <div>
          <span>Subtotal: ${formatearPrecio(base)}</span>
          <span style="font-size:var(--text-xs);color:var(--naranja-alerta)">+${window.APP_CONFIG?.recargo_delivery_pct || 15}% delivery: ${formatearPrecio(recargo)}</span>
        </div>
        <strong>${formatearPrecio(total)}</strong>`;
    }
  }

  // ── Método de pago ────────────────────────────────────────
  function seleccionarMetodo(metodo) {
    _metodoPagoSeleccionado = metodo;
    document.querySelectorAll('.metodo-btn').forEach(b => b.classList.remove('metodo-btn--active'));
    document.querySelector(`[data-metodo="${metodo}"]`).classList.add('metodo-btn--active');
    _renderizarFormPago(metodo);
    _verificarListo();
  }

  function _renderizarFormPago(metodo) {
    const container = document.getElementById('form-pago-container');
    const total = _consumoSeleccionado === 'Domicilio'
      ? _calcularTotalConRecargo()
      : obtenerTotal();

    if (metodo === 'Efectivo') {
      container.innerHTML = `
        <div class="pago-info pago-info--efectivo">
          💵 Pagás en caja al retirar. ¡Tené el monto exacto si podés!
        </div>`;
    } else if (metodo === 'MercadoPago') {
      container.innerHTML = `
        <div class="pago-info pago-info--mp">
          <div id="mp-checkout-loading" class="mp-checkout-loading">
            <div class="spinner spinner--sm"></div>
            <p>Preparando pago...</p>
          </div>
          <div id="mp-checkout-btn-container" style="display:none"></div>
          <div id="mp-qr-container" style="display:none">
            <p style="margin-top:var(--space-3)"><strong>o escaneá este QR:</strong></p>
            <img id="mp-qr-img" class="mp-qr-img" alt="QR MercadoPago" />
          </div>
        </div>`;
      _iniciarCheckoutMP();
    }
  }

  // ── MP Checkout Pro ───────────────────────────────────────
  async function _iniciarCheckoutMP() {
    const items = obtenerCarrito();
    const params = new URLSearchParams(location.search);
    const mesaId = params.get('mesa');
    const pedidoIds = []; // vacío porque el pedido aún no se creó

    try {
      const res = await fetch('/api/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mesa_id: mesaId || '0',
          pedido_ids: pedidoIds,
          items: items.map(i => ({
            title: i.variante ? `${i.nombre} (${i.variante})` : i.nombre,
            quantity: i.cantidad,
            unit_price: i.precio_unitario
          })),
          total: obtenerTotal()
        })
      });

      if (!res.ok) throw new Error('Error creando preferencia');
      const data = await res.json();
      _mpPreference = data;

      // Ocultar loading, mostrar botón
      document.getElementById('mp-checkout-loading').style.display = 'none';

      const btnContainer = document.getElementById('mp-checkout-btn-container');
      btnContainer.style.display = 'block';
      btnContainer.innerHTML = `
        <a href="${data.init_point}" class="btn-mp-checkout" id="btn-mp-pay">
          <span class="btn-mp-checkout__icon">💳</span>
          Pagar con MercadoPago
        </a>`;

      // Mostrar QR
      if (mesaId) {
        const qrContainer = document.getElementById('mp-qr-container');
        const qrImg = document.getElementById('mp-qr-img');
        qrImg.src = `/qr-mp-redirect?mesa=${mesaId}&pref_id=${data.id}`;
        qrContainer.style.display = 'block';
      }
    } catch (err) {
      console.error('Error MP checkout:', err);
      const loading = document.getElementById('mp-checkout-loading');
      if (loading) loading.innerHTML = `
        <p style="color:var(--rojo-tuco)">Error al preparar el pago. Intentá de nuevo.</p>`;
    }
  }

  function _calcularTotalConRecargo() {
    const base = obtenerTotal();
    const recargoPct = (window.APP_CONFIG?.recargo_delivery_pct || 15) / 100;
    return Math.round(base * (1 + recargoPct));
  }

  function _verificarListo() {
    const btn = document.getElementById('btn-confirmar');
    const direccionOk = _consumoSeleccionado !== 'Domicilio' || document.getElementById('direccion-input')?.value.trim();
    if (btn) btn.disabled = !(_consumoSeleccionado && _metodoPagoSeleccionado && direccionOk);
  }

  // ── Confirmar pedido ──────────────────────────────────────
  async function confirmarPedido() {
    const btn     = document.getElementById('btn-confirmar');
    const usuario = obtenerUsuarioActual();
    const items   = obtenerCarrito().map(({ _key, ...rest }) => rest);
    const notas   = document.getElementById('notas-cliente')?.value.trim() || '';

    btn.disabled    = true;
    btn.textContent = 'Procesando...';

    const esDelivery = _consumoSeleccionado === 'Domicilio';
    const total = esDelivery ? _calcularTotalConRecargo() : obtenerTotal();
    const recargo = esDelivery ? total - obtenerTotal() : 0;

    let direccion = null;
    let referencia = null;
    if (esDelivery) {
      direccion = document.getElementById('direccion-input')?.value.trim();
      referencia = document.getElementById('referencia-input')?.value.trim() || null;
      if (!direccion) {
        mostrarToast('Ingresá la dirección de entrega', 'error');
        btn.disabled = false;
        btn.textContent = 'Confirmar pedido';
        return;
      }
    }

    const params = new URLSearchParams(location.search);
    const mesaId = params.get('mesa');

    const pedidoData = {
      // Mesa primero: aunque haya usuario logueado, los pedidos de mesa van
      // con cliente_uid "mesa:N" para que el cliente del QR pueda verlos
      cliente_uid:    mesaId ? `mesa:${mesaId}` : (usuario ? usuario.uid : null),
      nombre_cliente: usuario ? usuario.nombre : (mesaId ? `Mesa ${mesaId}` : 'Cliente'),
      tipo_consumo:   _consumoSeleccionado,
      items,
      notas_cliente:  notas,
      estado_cocina:  _esMesa ? 'Pendiente confirma caja' : 'Pendiente',
      estado_pago:    _metodoPagoSeleccionado === 'Efectivo' ? 'Pendiente' : 'Pendiente verificacion MP',
      metodo_pago:    _metodoPagoSeleccionado,
      total,
      recargo_delivery: recargo,
      direccion_entrega: direccion,
      referencia_delivery: referencia,
      mesa_id:        mesaId || null,
    };

    try {
      if (_metodoPagoSeleccionado === 'MercadoPago' && _mpPreference) {
        // Crear pedido, redirect a MP
        const pedidoId = await crearPedido(pedidoData);
        vaciarCarrito();
        mostrarToast('Redirigiendo a MercadoPago...', 'success');
        // Redirect al checkout de MP
        window.location.href = _mpPreference.init_point;
        return;
      }

      // Efectivo / Transferencia
      await crearPedido(pedidoData);
      vaciarCarrito();
      _consumoSeleccionado    = null;
      _metodoPagoSeleccionado = null;

      mostrarToast('¡Pedido confirmado! 🎉', 'success');
      if (_esMesa) {
        renderizarCliente();
      } else {
        irAlTracker(pedidoId);
      }

    } catch (err) {
      console.error('Error al confirmar pedido:', err);
      mostrarToast('Error al crear el pedido. Intentá de nuevo.', 'error');
      btn.disabled    = false;
      btn.textContent = 'Confirmar pedido';
    }
  }

  window.renderizarCheckout = renderizarCheckout;
  window.seleccionarConsumo = seleccionarConsumo;
  window.seleccionarMetodo  = seleccionarMetodo;
  window.confirmarPedido    = confirmarPedido;
  window._verificarListo    = _verificarListo;

})();
