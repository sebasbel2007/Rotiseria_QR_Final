// js/views/cocina.js
(() => {

  let _pedidosAnteriores = new Set();
  let _audioCtx = null;
  let _unsubHistorial = null;
  let _historialFiltro = 'hoy';
  let _historialBusqueda = '';

  function renderizarCocina() {
    document.getElementById('app').innerHTML = `
      <div class="kds-wrap">
        <div class="kds-topbar">
          <h1 class="kds-topbar__title">👨‍🍳 Cocina</h1>
          <div class="kds-tabs" id="kds-tabs">
            <button class="kds-tab kds-tab--active" data-tab="activos" onclick="switchCocinaTab('activos')">
              🔥 Activos <span class="badge badge--count" id="kds-badge">0</span>
            </button>
            <button class="kds-tab" data-tab="historial" onclick="switchCocinaTab('historial')">
              📋 Historial
            </button>
          </div>
        </div>

        <div class="kds-panel kds-panel--active" id="panel-activos">
          <div class="kds-grid" id="kds-grid">
            <div class="spinner-container"><div class="spinner"></div></div>
          </div>
        </div>

        <div class="kds-panel" id="panel-historial">
          <div class="kds-historial-toolbar">
            <div class="kds-historial-filtros">
              <button class="btn-tag btn-tag--active" data-filtro="hoy" onclick="filtrarHistorial('hoy')">Hoy</button>
              <button class="btn-tag" data-filtro="ayer" onclick="filtrarHistorial('ayer')">Ayer</button>
            </div>
            <input class="form-input" type="text" id="historial-buscar"
                   placeholder="🔍 Buscar por cliente o ticket..."
                   oninput="buscarHistorial(this.value)" />
          </div>
          <div class="kds-grid" id="historial-grid">
            <div class="spinner-container"><div class="spinner"></div></div>
          </div>
        </div>
      </div>`;

    escucharPedidosCocina(_onPedidosCocinaUpdate);
  }

  window.switchCocinaTab = (tab) => {
    document.querySelectorAll('#kds-tabs .kds-tab').forEach(b => b.classList.remove('kds-tab--active'));
    document.querySelectorAll('.kds-panel').forEach(p => p.classList.remove('kds-panel--active'));
    document.querySelector(`#kds-tabs [data-tab="${tab}"]`).classList.add('kds-tab--active');
    document.getElementById(`panel-${tab}`).classList.add('kds-panel--active');

    if (tab === 'historial') _cargarHistorial();
    else _limpiarHistorial();
  };

  window.filtrarHistorial = (filtro) => {
    _historialFiltro = filtro;
    document.querySelectorAll('.kds-historial-filtros .btn-tag').forEach(b => {
      b.classList.toggle('btn-tag--active', b.dataset.filtro === filtro);
    });
    _cargarHistorial();
  };

  window.buscarHistorial = (q) => {
    _historialBusqueda = q.toLowerCase();
    _renderizarHistorial(_ultimosHistorial);
  };

  let _ultimosHistorial = [];

  function _cargarHistorial() {
    if (_unsubHistorial) { _unsubHistorial(); _unsubHistorial = null; }

    const ahora = new Date();
    let inicio;
    if (_historialFiltro === 'hoy') {
      inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    } else {
      inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1);
    }

    const inicioTs = firebase.firestore.Timestamp.fromDate(inicio);

    _unsubHistorial = db.collection('pedidos')
      .where('fecha_hora_creacion', '>=', inicioTs)
      .orderBy('fecha_hora_creacion', 'desc')
      .limit(50)
      .onSnapshot(snap => {
        const pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _ultimosHistorial = pedidos;
        _renderizarHistorial(pedidos);
      });
  }

  function _renderizarHistorial(pedidos) {
    const grid = document.getElementById('historial-grid');
    if (!grid) { _limpiarHistorial(); return; }

    let filtrados = pedidos;
    if (_historialBusqueda) {
      filtrados = pedidos.filter(p =>
        (p.nombre_cliente || '').toLowerCase().includes(_historialBusqueda) ||
        p.id.slice(-6).toUpperCase().includes(_historialBusqueda.toUpperCase())
      );
    }

    if (!filtrados.length) {
      grid.innerHTML = `
        <div class="kds-empty">
          <span class="kds-empty__icon">📋</span>
          <p>Sin pedidos en este período</p>
        </div>`;
      return;
    }

    grid.innerHTML = filtrados.map(p => _cardHistorial(p)).join('');
  }

  function _cardHistorial(pedido) {
    const creacion = pedido.fecha_hora_creacion?.toDate?.() || new Date();
    const hora = creacion.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const esListo = pedido.estado_cocina === 'Listo para Retirar/Comer';
    const cancelado = pedido.estado_cocina === 'Cancelado';
    const entregado = pedido.entregado_mozo === true;

    const mostrarEntregar = esListo && !cancelado && !entregado;

    return `
      <div class="kds-card ${cancelado ? 'kds-card--cancelado' : ''} ${entregado ? 'kds-card--entregado' : ''}">
        <div class="kds-card__header">
          <div>
            <p class="kds-card__ticket">#${pedido.id.slice(-6).toUpperCase()}</p>
            <p class="kds-card__cliente">${pedido.nombre_cliente}</p>
          </div>
          <div class="kds-card__meta">
            <span class="kds-card__tiempo">${hora}</span>
            <span class="badge badge--${claseEstado(pedido.estado_cocina)}">${pedido.estado_cocina}</span>
          </div>
        </div>
        <ul class="kds-card__items">
          ${pedido.items.map(i => `
            <li class="kds-card__item">
              <span class="kds-card__item-qty">${i.cantidad}×</span>
              <span class="kds-card__item-nombre">${i.nombre}${i.variante ? ` <em>(${i.variante})</em>` : ''}</span>
            </li>`).join('')}
        </ul>
        ${cancelado && pedido.motivo_cancelacion ? `
          <div class="kds-card__nota">❌ ${pedido.motivo_cancelacion}</div>` : ''}
        ${mostrarEntregar ? `
          <div class="kds-card__actions">
            <button class="kds-btn kds-btn--listo" onclick="marcarEntregadoMozo('${pedido.id}')">
              📦 Entregado
            </button>
          </div>` : ''}
        ${entregado ? `
          <div class="kds-card__nota" style="color:var(--verde-listo)">✅ Entregado por mozo</div>` : ''}
      </div>`;
  }

  window.marcarEntregadoMozo = async (pedidoId) => {
    try {
      await db.collection('pedidos').doc(pedidoId).update({
        entregado_mozo: true
      });
      mostrarToast('Pedido marcado como entregado', 'success');
    } catch {
      mostrarToast('Error al marcar entregado', 'error');
    }
  };

  function _limpiarHistorial() {
    if (_unsubHistorial) { _unsubHistorial(); _unsubHistorial = null; }
    _ultimosHistorial = [];
  }

  // ── Activos ───────────────────────────────────────────────────
  function _onPedidosCocinaUpdate(pedidos) {
    const grid  = document.getElementById('kds-grid');
    const badge = document.getElementById('kds-badge');
    if (!grid) { dejarDeEscucharPedidos(); return; }

    badge.textContent = pedidos.length;

    pedidos.forEach(p => {
      if (!_pedidosAnteriores.has(p.id)) _emitirSonido();
    });
    _pedidosAnteriores = new Set(pedidos.map(p => p.id));

    if (!pedidos.length) {
      grid.innerHTML = `
        <div class="kds-empty">
          <span class="kds-empty__icon">✅</span>
          <p>Sin comandas pendientes</p>
        </div>`;
      return;
    }

    grid.innerHTML = pedidos.map(p => _cardComanda(p)).join('');
  }

  function _cardComanda(pedido) {
    const creacion = pedido.fecha_hora_creacion?.toDate?.() || new Date();
    const minutos  = Math.floor((Date.now() - creacion.getTime()) / 60000);
    const enPrep   = pedido.estado_cocina === 'En Preparación';
    const urgente  = minutos >= 15;
    const mesaNum  = pedido.mesa_id || '';

    return `
      <div class="kds-card ${enPrep ? 'kds-card--preparacion' : ''} ${urgente ? 'kds-card--urgente' : ''}">
        <div class="kds-card__header">
          <div>
            <p class="kds-card__ticket">#${pedido.id.slice(-6).toUpperCase()}</p>
            <p class="kds-card__cliente">
              ${pedido.nombre_cliente}
              ${mesaNum ? `<span class="kds-card__mesa">🪑 ${mesaNum}</span>` : ''}
            </p>
          </div>
          <div class="kds-card__meta">
            <span class="kds-card__tiempo ${urgente ? 'kds-card__tiempo--urgente' : ''}">
              ⏱ ${minutos}min
            </span>
            <span class="badge badge--${claseEstado(pedido.estado_cocina)}">
              ${pedido.estado_cocina}
            </span>
          </div>
        </div>

        <div class="kds-card__consumo">
          ${pedido.tipo_consumo === 'Comer en el local' ? '🍽️' : '🥡'} ${pedido.tipo_consumo}
        </div>

        <ul class="kds-card__items">
          ${pedido.items.map(i => `
            <li class="kds-card__item">
              <span class="kds-card__item-qty">${i.cantidad}×</span>
              <span class="kds-card__item-nombre">${i.nombre}${i.variante ? ` <em>(${i.variante})</em>` : ''}</span>
            </li>
            ${i.notas ? `<li class="kds-card__nota">📝 ${i.notas}</li>` : ''}`
          ).join('')}
        </ul>

        ${pedido.notas_cliente ? `
          <div class="kds-card__notas-cliente">📝 ${pedido.notas_cliente}</div>` : ''}

        <div class="kds-card__actions">
          ${pedido.estado_cocina === 'Pendiente'
            ? `<button class="kds-btn kds-btn--iniciar" onclick="avanzarEstadoCocina('${pedido.id}', 'En Preparación')">▶ Iniciar</button>`
            : pedido.estado_cocina === 'En Preparación'
              ? `<button class="kds-btn kds-btn--listo" onclick="avanzarEstadoCocina('${pedido.id}', 'Listo para Retirar/Comer')">✓ Listo</button>`
              : `<span class="kds-btn" style="opacity:.3;cursor:default">✓ Listo</span>`
          }
          ${pedido.estado_cocina === 'Demorado'
            ? `<button class="kds-btn kds-btn--iniciar" onclick="avanzarEstadoCocina('${pedido.id}', 'En Preparación')">▶ Retomar</button>`
            : `<button class="kds-btn kds-btn--demorar" onclick="avanzarEstadoCocina('${pedido.id}', 'Demorado')">⏳ Demorar</button>`
          }
          ${pedido.tipo_consumo === 'Domicilio' && pedido.estado_cocina === 'Listo para Retirar/Comer'
            ? `<button class="kds-btn kds-btn--enviar" onclick="marcarEnviado('${pedido.id}')">🛵 Enviar</button>`
            : ''
          }
          <button class="kds-btn kds-btn--cancelar" onclick="abrirModalCancelarPedido('${pedido.id}', '${pedido.tipo_consumo}')">✕</button>
        </div>
      </div>`;
  }

  async function avanzarEstadoCocina(pedidoId, nuevoEstado) {
    try {
      await actualizarEstadoCocina(pedidoId, nuevoEstado);
      if (nuevoEstado === 'Listo para Retirar/Comer') {
        const snap = await db.collection('pedidos').doc(pedidoId).get();
        const data = snap.data();
        if (data.tipo_consumo === 'Comer en el local' && data.estado_pago === 'Pagado') {
          await marcarEntregado(pedidoId);
        }
      }
      mostrarToast(`Pedido actualizado: ${nuevoEstado}`, 'success');
    } catch {
      mostrarToast('Error al actualizar el pedido', 'error');
    }
  }

  function abrirModalCancelarPedido(pedidoId, tipoConsumo) {
    const esLocal = tipoConsumo === 'Comer en el local';
    abrirModal(`
      <div class="modal modal--visible">
        <div class="modal__box">
          <div class="modal__header">
            <h3 class="modal__title">❌ Cancelar pedido</h3>
            <button class="modal__close" onclick="cerrarModal()">✕</button>
          </div>
          <div class="modal__body">
            <p style="font-size:var(--text-sm);color:var(--gris-medio);margin-bottom:var(--space-2)">
              El cliente verá este mensaje en su pantalla de seguimiento.
            </p>
            <div class="form-group">
              <label class="form-label">Motivo de cancelación</label>
              <select class="form-select" id="motivo-cancelacion">
                <option value="Producto agotado">Producto agotado</option>
                <option value="Error en el pedido">Error en el pedido</option>
                <option value="Problema en cocina">Problema en cocina</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Detalle adicional (opcional)</label>
              <textarea class="form-textarea" id="detalle-cancelacion"
                        placeholder="Ej: Se agotó el pollo entero..."></textarea>
            </div>
            <div class="cancelar-aviso ${esLocal ? 'cancelar-aviso--local' : 'cancelar-aviso--delivery'}">
              ${esLocal
                ? '🍽️ El cliente está en el local. Se le indicará que <strong>se acerque a caja</strong>.'
                : '📦 El cliente pidió para retirar. Se le indicará que <strong>contacte al local por teléfono</strong>.'}
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="cerrarModal()">Volver</button>
            <button class="btn btn--primary" style="background:var(--rojo-tuco)"
                    onclick="confirmarCancelacion('${pedidoId}', '${tipoConsumo}')">
              Confirmar cancelación
            </button>
          </div>
        </div>
      </div>`);
  }

  async function confirmarCancelacion(pedidoId, tipoConsumo) {
    const motivo  = document.getElementById('motivo-cancelacion').value;
    const detalle = document.getElementById('detalle-cancelacion').value.trim();
    const motivoCompleto = detalle ? `${motivo}: ${detalle}` : motivo;

    try {
      await cancelarPedido(pedidoId, motivoCompleto);
      cerrarModal();
      mostrarToast('Pedido cancelado', 'warning');
    } catch {
      mostrarToast('Error al cancelar el pedido', 'error');
    }
  }

  function _emitirSonido() {
    try {
      if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.connect(gain);
      gain.connect(_audioCtx.destination);
      osc.type            = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, _audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.4);
      osc.start(_audioCtx.currentTime);
      osc.stop(_audioCtx.currentTime + 0.4);
    } catch { /* silencioso si el navegador bloquea */ }
  }

  window.marcarEnviado = async (pedidoId) => {
    try {
      await db.collection('pedidos').doc(pedidoId).update({
        estado_cocina: 'Enviado',
        entregado: true
      });
      mostrarToast('Pedido enviado 🛵', 'success');
    } catch {
      mostrarToast('Error al marcar como enviado', 'error');
    }
  };

  window.renderizarCocina         = renderizarCocina;
  window.avanzarEstadoCocina      = avanzarEstadoCocina;
  window.abrirModalCancelarPedido = abrirModalCancelarPedido;
  window.confirmarCancelacion     = confirmarCancelacion;

})();
