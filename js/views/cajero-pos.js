// js/views/cajero-pos.js
(() => {

  let _productosCajero    = [];
  let _categoriasPOS      = [];
  let _categoriaPOSActiva = '';

  function iniciarPOS() {
    escucharProductos(_onProductosCajeroUpdate);
    onCarritoChange(_renderizarCarritoPOS);
    _renderizarCarritoPOS(obtenerCarrito());
  }

  function _onProductosCajeroUpdate(productos) {
    _productosCajero = productos.filter(p => p.estado === 'Disponible');
    const cats = [];
    _productosCajero.forEach(p => { if (!cats.includes(p.categoria)) cats.push(p.categoria); });
    _categoriasPOS = cats;
    if (!_categoriaPOSActiva || !cats.includes(_categoriaPOSActiva)) {
      _categoriaPOSActiva = cats[0] || '';
    }
    _renderizarCatsPOS();
    _renderizarGridPOS();
  }

  function _renderizarCatsPOS() {
    const el = document.getElementById('pos-cats');
    if (!el) return;
    el.innerHTML = _categoriasPOS.map(c => `
      <button class="pos-cat-btn ${c === _categoriaPOSActiva ? 'pos-cat-btn--active' : ''}"
              onclick="seleccionarCategoriaPOS('${c}')">${c}</button>
    `).join('');
  }

  function seleccionarCategoriaPOS(cat) {
    _categoriaPOSActiva = cat;
    const search = document.getElementById('pos-buscador');
    if (search) search.value = '';
    _renderizarCatsPOS();
    _renderizarGridPOS();
  }

  function _renderizarGridPOS(lista) {
    const grid = document.getElementById('pos-grid');
    if (!grid) return;
    const productos = lista !== undefined
      ? lista
      : _productosCajero.filter(p => p.categoria === _categoriaPOSActiva);

    if (!productos.length) {
      grid.innerHTML = `<p style="color:var(--gris-medio);font-size:var(--text-sm);padding:var(--space-4)">Sin productos</p>`;
      return;
    }

    grid.innerHTML = productos.map(p => `
      <button class="pos-producto-btn" onclick="abrirModalAgregarPOS('${p.id}')">
        <span class="pos-producto-btn__nombre">${p.nombre}</span>
        <span class="pos-producto-btn__precio">${formatearPrecio(p.precio)}</span>
        ${p.variantes?.length ? `<span class="pos-producto-btn__vars">${p.variantes.length} variante${p.variantes.length > 1 ? 's' : ''}</span>` : ''}
      </button>`).join('');
  }

  function filtrarProductosPOS(query) {
    if (!query.trim()) { _renderizarGridPOS(); return; }
    const filtrados = _productosCajero.filter(p =>
      p.nombre.toLowerCase().includes(query.toLowerCase())
    );
    _renderizarGridPOS(filtrados);
  }

  function abrirModalAgregarPOS(productoId) {
    const p = _productosCajero.find(x => x.id === productoId);
    if (!p) return;

    abrirModal(`
      <div class="modal modal--visible">
        <div class="modal__box">
          <div class="modal__header">
            <h3 class="modal__title">${p.nombre}</h3>
            <button class="modal__close" onclick="cerrarModal()">✕</button>
          </div>
          <div class="modal__body">
            <p style="font-size:var(--text-sm);color:var(--gris-medio);margin-bottom:var(--space-3)">
              ${formatearPrecio(p.precio)}${p.descripcion ? ` — ${p.descripcion}` : ''}
            </p>
            ${p.variantes?.length ? `
              <div class="form-group">
                <label class="form-label">Variante</label>
                <div class="pos-variantes-grid" id="pos-variantes-sel">
                  <button class="pos-var-btn pos-var-btn--active" data-idx="" onclick="seleccionarVariantePOS(this)">
                    Sin variante
                  </button>
                  ${p.variantes.map((v, i) => `
                    <button class="pos-var-btn" data-idx="${i}" onclick="seleccionarVariantePOS(this)">
                      ${v.nombre}
                      ${v.extra_precio ? `<span>+${formatearPrecio(v.extra_precio)}</span>` : ''}
                    </button>`).join('')}
                </div>
              </div>` : ''}
            <div class="form-group">
              <label class="form-label">Nota para cocina <span style="font-weight:400;color:var(--gris-medio)">(opcional)</span></label>
              <input class="form-input" type="text" id="pos-item-nota"
                     placeholder="Ej: sin cebolla, bien cocido..." />
            </div>
            <div class="form-group" style="display:flex;align-items:center;gap:var(--space-3)">
              <label class="form-label" style="margin:0">Cantidad</label>
              <div style="display:flex;align-items:center;gap:var(--space-2)">
                <button class="cart-item__qty-btn" onclick="cambiarCantidadModal(-1)">−</button>
                <span id="pos-modal-qty" style="min-width:24px;text-align:center;font-weight:600">1</span>
                <button class="cart-item__qty-btn" onclick="cambiarCantidadModal(1)">+</button>
              </div>
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="cerrarModal()">Cancelar</button>
            <button class="btn btn--primary" onclick="confirmarAgregarPOS('${p.id}')">
              + Agregar al pedido
            </button>
          </div>
        </div>
      </div>`);
  }

  function seleccionarVariantePOS(btn) {
    document.querySelectorAll('#pos-variantes-sel .pos-var-btn')
      .forEach(b => b.classList.remove('pos-var-btn--active'));
    btn.classList.add('pos-var-btn--active');
  }

  function cambiarCantidadModal(delta) {
    const el  = document.getElementById('pos-modal-qty');
    const val = Math.max(1, parseInt(el.textContent) + delta);
    el.textContent = val;
  }

  function confirmarAgregarPOS(productoId) {
    const p = _productosCajero.find(x => x.id === productoId);
    if (!p) return;
    const varBtn   = document.querySelector('#pos-variantes-sel .pos-var-btn--active');
    const varIdx   = varBtn?.dataset.idx;
    const variante = (varIdx !== '' && varIdx !== undefined) ? p.variantes[parseInt(varIdx)] : null;
    const nota     = document.getElementById('pos-item-nota')?.value.trim() || '';
    const qty      = parseInt(document.getElementById('pos-modal-qty')?.textContent) || 1;
    for (let i = 0; i < qty; i++) agregarItem(p, variante, nota);
    cerrarModal();
    mostrarToast(`${p.nombre} agregado ✅`, 'success');
  }

  function _renderizarCarritoPOS(items) {
    const posItems = document.getElementById('pos-items');
    const posTotal = document.getElementById('pos-total');
    if (!posItems) return;

    if (!items.length) {
      posItems.innerHTML = `<p class="pos-items__empty">Sin items aún</p>`;
      posTotal.innerHTML = '';
      return;
    }

    posItems.innerHTML = items.map(item => `
      <div class="pos-item">
        <div class="pos-item__info">
          <span class="pos-item__nombre">${item.cantidad}× ${item.nombre}</span>
          ${item.variante ? `<span class="pos-item__variante">${item.variante}</span>` : ''}
          ${item.notas   ? `<span class="pos-item__nota">📝 ${item.notas}</span>` : ''}
        </div>
        <div class="pos-item__controls">
          <button class="cart-item__qty-btn" onclick="actualizarCantidad('${item._key}', ${item.cantidad - 1})">−</button>
          <button class="cart-item__qty-btn" onclick="actualizarCantidad('${item._key}', ${item.cantidad + 1})">+</button>
          <button class="cart-item__remove" onclick="quitarItem('${item._key}')">✕</button>
        </div>
        <span class="pos-item__precio">${formatearPrecio(item.subtotal)}</span>
      </div>`).join('');

    posTotal.innerHTML = `
      <div class="pos-total__row">
        <span>Total</span>
        <strong>${formatearPrecio(obtenerTotal())}</strong>
      </div>`;
  }

  // ── Toggle mesa selector ───────────────────────────────────
  window.onCajeroConsumoChange = () => {
    const consumo = document.getElementById('pos-consumo')?.value;
    const grupoMesa = document.getElementById('pos-mesa-group');
    if (!grupoMesa) return;
    if (consumo === 'Comer en el local') {
      grupoMesa.style.display = 'block';
      _cargarMesasSelector();
    } else {
      grupoMesa.style.display = 'none';
      const selectMesa = document.getElementById('pos-mesa');
      if (selectMesa) selectMesa.value = '';
    }
  };

  async function _cargarMesasSelector() {
    const select = document.getElementById('pos-mesa');
    if (!select) return;
    try {
      const mesas = await obtenerTodasMesas();
      const activas = mesas.filter(m => m.activa);
      select.innerHTML = `
        <option value="">Seleccionar mesa...</option>
        ${activas.map(m => `<option value="${m.numero}">Mesa ${m.numero} — ${m.zona}</option>`).join('')}
      `;
    } catch {
      select.innerHTML = `<option value="">Error cargando mesas</option>`;
    }
  }

  // ── Confirmar pedido POS ───────────────────────────────────
  async function confirmarPedidoPOS() {
    const usuario = obtenerUsuarioActual();
    const items   = obtenerCarrito();
    const nombre  = document.getElementById('pos-nombre-cliente').value.trim() || 'Cliente walk-in';
    const consumo = document.getElementById('pos-consumo').value;
    const metodo  = document.getElementById('pos-metodo').value;
    const notas   = document.getElementById('pos-notas').value.trim();
    const mesaNum = document.getElementById('pos-mesa')?.value || '';

    if (!items.length) { mostrarToast('Agregá al menos un producto', 'warning'); return; }
    if (consumo === 'Comer en el local' && !mesaNum) {
      mostrarToast('Seleccioná una mesa', 'warning');
      return;
    }

    const esMesa = consumo === 'Comer en el local';

    try {
      await crearPedido({
        // Mesa → cliente_uid "mesa:N": así el cliente que escaneó el QR puede
        // ver el pedido (las reglas de Firestore lo acotan por este campo)
        cliente_uid:    esMesa ? `mesa:${mesaNum}` : usuario.uid,
        nombre_cliente: nombre,
        tipo_consumo:   consumo,
        mesa_id:        esMesa ? String(mesaNum) : null,
        items:          items.map(({ _key, ...rest }) => rest),
        notas_cliente:  notas,
        estado_cocina:  esMesa ? 'Pendiente confirma caja' : 'Pendiente',
        estado_pago:    metodo === 'MercadoPago' ? 'Pendiente verificacion MP' : 'Pendiente',
        metodo_pago:    metodo,
        total:          obtenerTotal()
      });

      vaciarCarrito();
      document.getElementById('pos-nombre-cliente').value = '';
      document.getElementById('pos-notas').value = '';
      if (esMesa) {
        document.getElementById('pos-consumo').value = 'Retirar';
        document.getElementById('pos-mesa-group').style.display = 'none';
      }
      mostrarToast(esMesa ? `Pedido enviado — Mesa ${mesaNum} ✅` : 'Pedido enviado a cocina ✅', 'success');
      switchCajeroTab('mesas');
    } catch {
      mostrarToast('Error al crear el pedido', 'error');
    }
  }

  window.iniciarPOS              = iniciarPOS;
  window.seleccionarCategoriaPOS = seleccionarCategoriaPOS;
  window.filtrarProductosPOS     = filtrarProductosPOS;
  window.abrirModalAgregarPOS    = abrirModalAgregarPOS;
  window.seleccionarVariantePOS  = seleccionarVariantePOS;
  window.cambiarCantidadModal    = cambiarCantidadModal;
  window.confirmarAgregarPOS     = confirmarAgregarPOS;
  window.confirmarPedidoPOS      = confirmarPedidoPOS;

})();
