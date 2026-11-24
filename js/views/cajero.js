// js/views/cajero.js — Orchestrator
(() => {

  function renderizarCajero() {
    _cleanupCajero();

    document.getElementById('app').innerHTML = `
      <div class="cajero-wrap">
        <div class="cajero-header">
          <h1 class="cajero-title">🧾 Punto de Venta</h1>
        </div>

        <div class="tabs" id="cajero-tabs">
          <button class="tab-btn tab-btn--active" data-tab="mesas" onclick="switchCajeroTab('mesas')">
            🪑 Mesas
          </button>
          <button class="tab-btn" data-tab="pos" onclick="switchCajeroTab('pos')">
            ➕ Nuevo pedido
          </button>
          <button class="tab-btn" data-tab="cobros" onclick="switchCajeroTab('cobros')">
            💰 Cobros
          </button>
          <button class="tab-btn" data-tab="historial" onclick="switchCajeroTab('historial')">
            📋 Historial
          </button>
        </div>

        <!-- Tab: Mesas Dashboard -->
        <div class="tab-panel tab-panel--active" id="tab-mesas">
          <div class="mesas-layout" id="mesas-layout">
            <div class="admin-mesas-grid-wrap" style="flex:1">
              <div class="mesas-zona-tabs" id="mesas-zona-tabs"></div>
              <div class="admin-mesas-grid" id="mesas-grid">
                <div class="spinner-container" style="grid-column:1/-1"><div class="spinner"></div></div>
              </div>
            </div>
            <div class="mesas-side-panel" id="mesas-side-panel" style="display:none"></div>
          </div>
        </div>

        <!-- Tab: POS Nuevo pedido -->
        <div class="tab-panel" id="tab-pos">
          <div class="pos-wrap">
            <div class="pos-productos">
              <div class="pos-buscador-wrap">
                <input class="form-input" type="text" id="pos-buscador"
                       placeholder="🔍 Buscar producto..."
                       oninput="filtrarProductosPOS(this.value)" />
              </div>
              <div class="pos-cats" id="pos-cats"></div>
              <div class="pos-grid" id="pos-grid">
                <div class="spinner-container"><div class="spinner"></div></div>
              </div>
            </div>
            <div class="pos-carrito">
              <h3 class="pos-carrito__title">Pedido</h3>
              <div class="form-group">
                <input class="form-input" type="text" id="pos-nombre-cliente"
                       placeholder="👤 Nombre del cliente (opcional)" />
              </div>
              <div id="pos-items" class="pos-items"></div>
              <div class="pos-total" id="pos-total"></div>
              <div class="form-group">
                <label class="form-label">Tipo de consumo</label>
                <select class="form-select" id="pos-consumo" onchange="onCajeroConsumoChange()">
                  <option value="Retirar">🥡 Retirar</option>
                  <option value="Comer en el local">🍽️ Comer en el local</option>
                </select>
              </div>
              <div class="form-group" id="pos-mesa-group" style="display:none">
                <label class="form-label">Mesa</label>
                <select class="form-select" id="pos-mesa">
                  <option value="">Seleccionar mesa...</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Método de pago</label>
                <select class="form-select" id="pos-metodo">
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="MercadoPago">📱 MercadoPago</option>
                </select>
              </div>
              <div class="form-group">
                <textarea class="form-textarea" id="pos-notas"
                          placeholder="📝 Notas generales del pedido (opcional)"
                          rows="2"></textarea>
              </div>
              <button class="btn btn--primary btn--full" onclick="confirmarPedidoPOS()">
                ✅ Confirmar pedido
              </button>
              <button class="btn btn--ghost btn--full btn--sm" onclick="vaciarCarrito()">
                Vaciar
              </button>
            </div>
          </div>
        </div>

        <!-- Tab: Cobros agrupados -->
        <div class="tab-panel" id="tab-cobros">
          <div id="checkins-list" style="display:none"></div>
          <div id="cobros-list">
            <div class="cajero-empty"><span>💰</span><p>Sin cobros pendientes</p></div>
          </div>
        </div>

        <!-- Tab: Historial pedidos activos -->
        <div class="tab-panel" id="tab-historial">
          <div id="historial-list">
            <div class="spinner-container"><div class="spinner"></div></div>
          </div>
        </div>
      </div>`;

    iniciarMesasCajero();
    iniciarPOS();
    iniciarCobros();
    iniciarTimeouts();
  }

  function _cleanupCajero() {
    if (typeof detenerTimeouts === 'function') detenerTimeouts();
    if (typeof _cerrarSidePanel === 'function') _cerrarSidePanel();
    if (typeof dejarDeEscucharMesas === 'function') dejarDeEscucharMesas();
    if (typeof _cleanupMesas === 'function') _cleanupMesas();
    if (typeof dejarDeEscucharPedidos === 'function') dejarDeEscucharPedidos();
    if (typeof dejarDeEscucharProductos === 'function') dejarDeEscucharProductos();
  }

  function switchCajeroTab(tab) {
    document.querySelectorAll('#cajero-tabs .tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('tab-panel--active'));
    document.querySelector(`#cajero-tabs [data-tab="${tab}"]`).classList.add('tab-btn--active');
    document.getElementById(`tab-${tab}`).classList.add('tab-panel--active');
  }

  window.renderizarCajero = renderizarCajero;
  window.switchCajeroTab  = switchCajeroTab;

})();
