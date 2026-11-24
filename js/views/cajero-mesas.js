// js/views/cajero-mesas.js — Grid mesas + Side panel + Cobros + Check-in + Timeouts
(() => {

  let _mesas = [];
  let _mesaSeleccionada = null;
  let _zonaActiva = '';
  let _unsubCheckin = null;
  let _unsubPedidosMesa = null;
  let _unsubCobros = null;
  let _unsubHistorial = null;
  let _gridRenderSeq = 0;

  // ── Iniciar listeners ──────────────────────────────────────
  function iniciarMesasCajero() {
    escucharMesas(_onMesasUpdate);
    _escucharPedidosCheckin();
  }

  function iniciarCobros() {
    _unsubCobros = escucharPedidosPendientesPago(_onCobrosUpdate);
    _unsubHistorial = escucharPedidosActivos(_onHistorialUpdate);
  }

  // ── Cleanup ────────────────────────────────────────────────
  function _cleanupMesas() {
    if (_unsubCheckin) { _unsubCheckin(); _unsubCheckin = null; }
    if (_unsubPedidosMesa) { _unsubPedidosMesa(); _unsubPedidosMesa = null; }
    if (_unsubCobros) { _unsubCobros(); _unsubCobros = null; }
    if (_unsubHistorial) { _unsubHistorial(); _unsubHistorial = null; }
    if (typeof detenerTimeouts === 'function') detenerTimeouts();
    _mesaSeleccionada = null;
    _prevCheckinCount = 0;
  }

  window._cerrarSidePanel = function() {
    const panel = document.getElementById('mesas-side-panel');
    if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
    if (_unsubPedidosMesa) { _unsubPedidosMesa(); _unsubPedidosMesa = null; }
    document.querySelectorAll('.admin-mesa--selected').forEach(c => c.classList.remove('admin-mesa--selected'));
  };

  // ── Grid mesas en tiempo real (layout físico del restaurante) ──
  const COLORES = {
    'Libre':            '#27AE60',
    'Pendiente caja':   '#F5B041',
    'Ocupada armando':  '#6B7280',
    'En cocina':        '#E67E22',
    'Comiendo/Listo':   '#D32F2F',
    'Inactiva':         '#374151',
  };

  const CLASES = {
    'Libre':            'admin-mesa--libre',
    'Pendiente caja':   'admin-mesa--pendiente',
    'Ocupada armando':  'admin-mesa--ocupada',
    'En cocina':        'admin-mesa--cocina',
    'Comiendo/Listo':   'admin-mesa--listo',
    'Inactiva':         'admin-mesa--inactiva',
  };

  function _onMesasUpdate(mesas) {
    _mesas = mesas;
    _renderZonaTabs();
    _renderGridMesas();
  }

  function _renderZonaTabs() {
    const el = document.getElementById('mesas-zona-tabs');
    if (!el) return;
    const zonas = obtenerZonas(_mesas);
    if (!zonas.length) { el.innerHTML = ''; return; }
    if (!_zonaActiva || !zonas.includes(_zonaActiva)) _zonaActiva = zonas[0];
    el.innerHTML = zonas.map(z => `
      <button class="btn-tag ${z === _zonaActiva ? 'btn-tag--active' : ''}"
              onclick="seleccionarZonaCajero('${z}')">${z}</button>
    `).join('');
  }

  function seleccionarZonaCajero(zona) {
    _zonaActiva = zona;
    _mesaSeleccionada = null;
    _renderZonaTabs();
    _renderGridMesas();
    window._cerrarSidePanel();
  }

  async function _renderGridMesas() {
    const seq = ++_gridRenderSeq;
    const grid = document.getElementById('mesas-grid');
    if (!grid) return;

    const mesasZona = _mesas.filter(m => m.zona === _zonaActiva);
    if (!mesasZona.length) {
      grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--gris-medio);padding:var(--space-6)">Sin mesas en esta zona</p>`;
      return;
    }

    const [pedidosActivos, checkins, cobrosMap] = await Promise.all([
      _obtenerPedidosActivos(),
      _obtenerCheckins(),
      _obtenerCobrosPendientes()
    ]);

    if (seq !== _gridRenderSeq) return;

    grid.innerHTML = mesasZona.map(mesa => {
      const estado = _calcularEstadoMesa(mesa, pedidosActivos, checkins, cobrosMap);
      const estadoNombre = estado.nombre;
      const color = COLORES[estadoNombre] || COLORES['Libre'];
      const clase = CLASES[estadoNombre] || '';
      const tam = mesa.tamaño || '1x1';

      const col = (mesa.pos_x || 0) + 1;
      const row = (mesa.pos_y || 0) + 1;
      let colSpan = 1, rowSpan = 1;
      if (tam === '1x2') colSpan = 2;
      else if (tam === '2x1') rowSpan = 2;
      else if (tam === '2x2') { colSpan = 2; rowSpan = 2; }

      const gridStyle = `grid-column:${col}/span ${colSpan};grid-row:${row}/span ${rowSpan};`;

      return `
        <div class="admin-mesa ${clase} admin-mesa--${tam}"
             data-id="${mesa.id}" data-numero="${mesa.numero}"
             style="${gridStyle};cursor:pointer"
             onclick="seleccionarMesaCajero('${mesa.id}')">
          <span class="admin-mesa-num">${mesa.numero}</span>
          <span class="admin-mesa-estado" style="color:${color}">${estadoNombre}</span>
          ${estado.badge ? `<div class="cajero-mesa-badge">${estado.badge}</div>` : ''}
          ${estado.tiempo ? `<span class="admin-mesa-tiempo">${estado.tiempo}min</span>` : ''}
        </div>`;
    }).join('');
  }

  function _calcularEstadoMesa(mesa, pedidosActivos, checkins, cobrosMap) {
    const mesaNum = String(mesa.numero);

    if (!mesa.activa) {
      return { nombre: 'Inactiva', icono: '⚫', label: 'Inactiva', badge: '', tiempo: '' };
    }

    const checkinPendiente = checkins.find(p => String(p.mesa_id) === mesaNum);
    if (checkinPendiente) {
      const mins = _minutosDesde(checkinPendiente.fecha_hora_creacion);
      return { nombre: 'Pendiente caja', icono: '🟡', label: 'Por confirmar', badge: '🔔', tiempo: mins };
    }

    const activos = pedidosActivos.filter(p => String(p.mesa_id) === mesaNum);
    const conCobro = cobrosMap[mesaNum];

    // Si hay cobros pendientes en la mesa (pedidos Pagado sin entregar o sin pagar)
    if (conCobro) {
      if (!activos.length) {
        const tieneMP = conCobro.ids?.some(id => {
          const cobros = conCobro.mpIds || [];
          return cobros.includes(id);
        });
        return { nombre: 'Comiendo/Listo', icono: '💰', label: 'Para cobrar', badge: conCobro.count + '', tiempo: '' };
      }
      const tieneMP = activos.some(p => p.estado_pago === 'Pendiente verificacion MP');
      if (tieneMP) {
        return { nombre: 'Comiendo/Listo', icono: '📱', label: 'MP verificando', badge: conCobro.count + '', tiempo: '' };
      }
      return { nombre: 'Comiendo/Listo', icono: '💰', label: 'Para cobrar', badge: conCobro.count + '', tiempo: '' };
    }

    if (!activos.length) {
      return { nombre: 'Libre', icono: '🟢', label: 'Libre', badge: '', tiempo: '' };
    }

    const tieneListo = activos.some(p => p.estado_cocina === 'Listo para Retirar/Comer');
    if (tieneListo) {
      const listo = activos.find(p => p.estado_cocina === 'Listo para Retirar/Comer');
      const mins = listo ? _minutosDesde(listo.fecha_listo || listo.fecha_hora_creacion) : '';
      return { nombre: 'Comiendo/Listo', icono: '🔴', label: 'Comiendo', badge: '', tiempo: mins };
    }

    const tieneEnCocina = activos.some(p =>
      ['Pendiente', 'En Preparación', 'Demorado'].includes(p.estado_cocina)
    );
    if (tieneEnCocina) {
      const masViejo = activos.reduce((min, p) => {
        const f = p.fecha_hora_creacion?.toMillis?.() || 0;
        return f < min ? f : min;
      }, Infinity);
      const mins = masViejo < Infinity ? Math.floor((Date.now() - masViejo) / 60000) : '';
      const urgentes = activos.filter(p => p.estado_cocina === 'Demorado').length;
      return { nombre: 'En cocina', icono: '🟠', label: 'En cocina', badge: urgentes ? '⚠️' : '', tiempo: mins };
    }

    return { nombre: 'Ocupada armando', icono: '🔵', label: 'Ocupada', badge: '', tiempo: '' };
  }

  function _minutosDesde(fecha) {
    if (!fecha?.toMillis) return '';
    return Math.floor((Date.now() - fecha.toMillis()) / 60000);
  }

  async function _obtenerPedidosActivos() {
    try {
      const snap = await db.collection('pedidos')
        .where('estado_cocina', 'in', ['Pendiente', 'En Preparación', 'Demorado', 'Listo para Retirar/Comer'])
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch { return []; }
  }

  async function _obtenerCheckins() {
    try {
      const snap = await db.collection('pedidos')
        .where('estado_cocina', '==', 'Pendiente confirma caja')
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch { return []; }
  }

  async function _obtenerCobrosPendientes() {
    try {
      const snap = await db.collection('pedidos')
        .where('estado_pago', 'in', ['Pendiente', 'Pendiente verificacion MP'])
        .get();
      const map = {};
      snap.docs.forEach(doc => {
        const p = doc.data();
        if (p.mesa_id && p.estado_cocina !== 'Cancelado') {
          const key = String(p.mesa_id);
          if (!map[key]) map[key] = { count: 0, total: 0, ids: [] };
          map[key].count++;
          map[key].total += p.total || 0;
          map[key].ids.push(doc.id);
        }
      });
      return map;
    } catch { return {}; }
  }

  // ── Seleccionar mesa → side panel ──────────────────────────
  async function seleccionarMesaCajero(mesaId) {
    _mesaSeleccionada = _mesas.find(m => m.id === mesaId);
    if (!_mesaSeleccionada) return;

    const panel = document.getElementById('mesas-side-panel');
    if (!panel) return;
    panel.style.display = 'flex';

    if (_unsubPedidosMesa) _unsubPedidosMesa();
    _unsubPedidosMesa = escucharPedidosMesa(_mesaSeleccionada.numero, (pedidos) => {
      _renderSidePanel(pedidos);
    });

    document.querySelectorAll('.admin-mesa').forEach(c => c.classList.remove('admin-mesa--selected'));
    document.querySelector(`.admin-mesa[data-id="${mesaId}"]`)?.classList.add('admin-mesa--selected');
  }

  function _renderSidePanel(pedidos) {
    const panel = document.getElementById('mesas-side-panel');
    const mesa = _mesaSeleccionada;
    if (!panel || !mesa) return;

    const checkin = pedidos.find(p => p.estado_cocina === 'Pendiente confirma caja');
    const activos = pedidos.filter(p => p.estado_cocina !== 'Pendiente confirma caja' && p.estado_cocina !== 'Cancelado');
    const noPagados = activos.filter(p => p.estado_pago !== 'Pagado');
    const totalNoPagados = noPagados.reduce((s, p) => s + (p.total || 0), 0);
    const totalGeneral = activos.reduce((s, p) => s + (p.total || 0), 0);

    let estadoLabel = 'Libre';
    let estadoClase = 'libre';
    if (checkin) { estadoLabel = 'Por confirmar'; estadoClase = 'checkin'; }
    else if (activos.some(p => p.estado_cocina === 'Listo para Retirar/Comer')) { estadoLabel = 'Comiendo'; estadoClase = 'listo'; }
    else if (activos.some(p => ['Pendiente','En Preparación','Demorado'].includes(p.estado_cocina))) { estadoLabel = 'En cocina'; estadoClase = 'cocina'; }
    else if (activos.length) { estadoLabel = 'Ocupada'; estadoClase = 'ocupada'; }

    panel.innerHTML = `
      <div class="side-panel-header">
        <div>
          <h3 class="side-panel-mesa">Mesa ${mesa.numero}</h3>
          <p class="side-panel-zona">${mesa.zona} · ${mesa.capacidad || '?'} personas</p>
        </div>
        <button class="side-panel-close" onclick="_cerrarSidePanel()">✕</button>
      </div>

      <div class="side-panel-status side-panel-status--${estadoClase}">
        ${estadoLabel}
      </div>

      ${checkin ? _renderCheckinPanel(checkin) : ''}

      ${activos.length ? `
        <div class="side-panel-section">
          <h4 class="side-panel-section__title">Pedidos activos (${activos.length})</h4>
          <div class="side-panel-pedidos">
            ${activos.map(p => _renderPedidoSidePanel(p)).join('')}
          </div>
        </div>
      ` : ''}

      ${noPagados.length ? `
        <div class="side-panel-section side-panel-section--cobro">
          <div class="side-panel-cobro-resumen">
            <span>${noPagados.length} pedido(s) sin pagar</span>
            <strong>${formatearPrecio(totalNoPagados)}</strong>
          </div>
          <div class="side-panel-cobro-acciones">
            <button class="btn btn--success btn--full" onclick="abrirModalCobroGrupo('${mesa.numero}', ${totalNoPagados})">
              💰 Cobrar todo
            </button>
            ${noPagados.some(p => p.estado_pago === 'Pendiente verificacion MP') ? `
              <button class="btn btn--primary btn--full" onclick="confirmarPagoMPGrupo('${mesa.numero}')">
                ✅ Confirmar MP
              </button>
            ` : `
              <button class="btn btn--secondary btn--full" onclick="generarQRMPMesa('${mesa.numero}')">
                📱 QR MercadoPago
              </button>
            `}
          </div>
        </div>
      ` : ''}

      ${activos.length && activos.every(p => p.estado_pago === 'Pagado') ? `
        <div class="side-panel-paid">✅ Todos los pedidos pagados</div>
      ` : ''}

      <div class="side-panel-actions">
        <button class="btn btn--secondary btn--full" onclick="nuevoPedidoParaMesa('${mesa.numero}')">
          ➕ Nuevo pedido para esta mesa
        </button>
        ${activos.length ? `
          <button class="btn btn--ghost btn--full btn--sm" onclick="imprimirCuentaMesa('${mesa.numero}')">
            🖨️ Imprimir cuenta
          </button>
          <button class="btn btn--danger btn--full btn--sm" onclick="abrirModalCancelarMesa('${mesa.numero}')">
            ✕ Cancelar pedido
          </button>
        ` : ''}
        <button class="btn btn--ghost btn--full btn--sm" onclick="limpiarMesa('${mesa.numero}')" style="color:var(--naranja-alerta)">
          🧹 Limpiar mesa (marcar todo como entregado)
        </button>
      </div>
    `;
  }

  function _renderCheckinPanel(checkin) {
    const mins = _minutosDesde(checkin.fecha_hora_creacion);
    return `
      <div class="side-panel-checkin">
        <div class="side-panel-checkin__header">
          <span>🔔 Esperando confirmación</span>
          <span class="side-panel-checkin__tiempo ${(mins || 0) > 4 ? 'side-panel-checkin__tiempo--urgente' : ''}">${mins || 0}min</span>
        </div>
        <div class="side-panel-checkin__items">
          ${(checkin.items || []).map(i => `${i.cantidad}× ${i.nombre}`).join(', ')}
        </div>
        <p class="side-panel-checkin__total">${formatearPrecio(checkin.total)}</p>
        <div class="side-panel-checkin__acciones">
          <button class="btn btn--success" onclick="confirmarCheckin('${checkin.id}')">✅ Confirmar</button>
          <button class="btn btn--danger" onclick="rechazarCheckin('${checkin.id}')">✕ Rechazar</button>
        </div>
      </div>`;
  }

  function _renderPedidoSidePanel(pedido) {
    const ticket = pedido.id.slice(-6).toUpperCase();
    const mins = _minutosDesde(pedido.fecha_hora_creacion);
    const pagado = pedido.estado_pago === 'Pagado';
    const esListo = pedido.estado_cocina === 'Listo para Retirar/Comer';
    const esMP = pedido.estado_pago === 'Pendiente verificacion MP';

    return `
      <div class="side-panel-pedido ${esListo ? 'side-panel-pedido--listo' : ''}">
        <div class="side-panel-pedido__header">
          <span class="side-panel-pedido__ticket">#${ticket}</span>
          <span class="badge badge--${claseEstado(pedido.estado_cocina)}">${pedido.estado_cocina}</span>
          ${pagado ? '<span class="badge badge--listo">✅ Pagado</span>' : ''}
          ${esMP ? '<span class="badge badge--mp-pendiente">📱 MP</span>' : ''}
        </div>
        <div class="side-panel-pedido__items">
          ${(pedido.items || []).map(i => `
            <p>${i.cantidad}× ${i.nombre}${i.variante ? ` (${i.variante})` : ''}${i.notas ? ` <em class="side-panel-nota">— ${i.notas}</em>` : ''}</p>
          `).join('')}
        </div>
        <div class="side-panel-pedido__footer">
          <span class="side-panel-pedido__total">${formatearPrecio(pedido.total)}</span>
          <span class="side-panel-pedido__tiempo">${mins || 0}min</span>
        </div>
      </div>`;
  }

  // ── Limpiar mesa (marcar todo como entregado) ─────────────
  window.limpiarMesa = async (mesaNum) => {
    if (!confirm(`¿Limpiar Mesa ${mesaNum}?\nSe marcarán todos los pedidos como entregados y la mesa se liberará.`)) return;
    try {
      const snap = await db.collection('pedidos')
        .where('mesa_id', '==', String(mesaNum))
        .where('entregado', '==', false)
        .get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach(doc => {
          batch.update(doc.ref, {
            entregado: true,
            estado_cocina: 'Entregado',
            fecha_cobro: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        await batch.commit();
      }
      const mesa = _mesas.find(m => String(m.numero) === String(mesaNum));
      if (mesa) await liberarMesa(mesa.id);
      mostrarToast(`Mesa ${mesaNum} limpiada ✅ (${snap.size} pedidos)`, 'success');
    } catch (err) {
      console.error('Error limpiar mesa:', err);
      mostrarToast('Error al limpiar mesa', 'error');
    }
  };

  // ── Check-in ───────────────────────────────────────────────
  let _prevCheckinCount = 0;

  function _escucharPedidosCheckin() {
    if (_unsubCheckin) _unsubCheckin();
    _unsubCheckin = db.collection('pedidos')
      .where('estado_cocina', '==', 'Pendiente confirma caja')
      .onSnapshot(snap => {
        const checkins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _renderizarCheckins(checkins);
        // Alerta sonora si hay nuevos checkins
        if (checkins.length > _prevCheckinCount) {
          _reproducirAlerta();
        }
        _prevCheckinCount = checkins.length;
      });
  }

  function _reproducirAlerta() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }

  function _renderizarCheckins(pedidos) {
    const el = document.getElementById('checkins-list');
    if (!el) return;
    if (!pedidos.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = 'block';
    el.innerHTML = `
      <div class="checkins-header">
        <h3 class="checkins-title">🔔 Esperando confirmación (${pedidos.length})</h3>
      </div>
      <div class="checkins-grid">${pedidos.map(p => _cardCheckin(p)).join('')}</div>`;
  }

  function _cardCheckin(pedido) {
    const mins = _minutosDesde(pedido.fecha_hora_creacion);
    return `
      <div class="checkin-card ${(mins || 0) > 4 ? 'checkin-card--urgente' : ''}">
        <div class="checkin-card__header">
          <span class="checkin-card__mesa">🪑 Mesa ${pedido.mesa_id || '?'}</span>
          <span class="checkin-card__tiempo ${(mins || 0) > 4 ? 'checkin-card__tiempo--urgente' : ''}">${mins || 0}min</span>
        </div>
        <div class="checkin-card__items">
          ${(pedido.items || []).map(i => `${i.cantidad}× ${i.nombre}`).join(', ')}
        </div>
        <div class="checkin-card__total">${formatearPrecio(pedido.total)}</div>
        <div class="checkin-card__acciones">
          <button class="btn btn--success btn--sm" onclick="confirmarCheckin('${pedido.id}')">✅ Confirmar</button>
          <button class="btn btn--danger btn--sm" onclick="rechazarCheckin('${pedido.id}')">✕ Rechazar</button>
        </div>
      </div>`;
  }

  window.confirmarCheckin = async (pedidoId) => {
    try {
      await db.collection('pedidos').doc(pedidoId).update({ estado_cocina: 'Pendiente' });
      mostrarToast('Pedido confirmado ✅', 'success');
    } catch { mostrarToast('Error al confirmar', 'error'); }
  };

  window.rechazarCheckin = async (pedidoId) => {
    try {
      await cancelarPedido(pedidoId, 'Rechazado por caja');
      mostrarToast('Pedido rechazado', 'warning');
    } catch { mostrarToast('Error al rechazar', 'error'); }
  };

  // ── Acciones desde side panel ──────────────────────────────
  window.nuevoPedidoParaMesa = (mesaNum) => {
    switchCajeroTab('pos');
    requestAnimationFrame(() => {
      const selectConsumo = document.getElementById('pos-consumo');
      const selectMesa = document.getElementById('pos-mesa');
      const grupoMesa = document.getElementById('pos-mesa-group');
      if (selectConsumo) selectConsumo.value = 'Comer en el local';
      if (grupoMesa) {
        grupoMesa.style.display = 'block';
        onCajeroConsumoChange();
      }
      if (selectMesa) selectMesa.value = String(mesaNum);
    });
  };

  // ── Cancelar con supervisor ────────────────────────────────
  window.abrirModalCancelarMesa = (mesaNum) => {
    const motivos = ['Cliente se fue', 'Error de pedido', 'Mesa liberada', 'Otro'];
    abrirModal(`
      <div class="modal modal--visible">
        <div class="modal__box">
          <div class="modal__header">
            <h3 class="modal__title">⚠️ Cancelar pedido — Mesa ${mesaNum}</h3>
            <button class="modal__close" onclick="cerrarModal()">✕</button>
          </div>
          <div class="modal__body">
            <div class="form-group">
              <label class="form-label">Motivo</label>
              <select class="form-select" id="modal-motivo-cancel">
                ${motivos.map(m => `<option value="${m}">${m}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Clave supervisor</label>
              <input class="form-input" type="password" id="modal-clave-supervisor"
                     placeholder="Ingresá la clave de supervisor" />
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="cerrarModal()">Cancelar</button>
            <button class="btn btn--danger" onclick="procesarCancelarMesa('${mesaNum}')">
              ✕ Cancelar pedido
            </button>
          </div>
        </div>
      </div>
    `);
  };

  window.procesarCancelarMesa = async (mesaNum) => {
    const motivo = document.getElementById('modal-motivo-cancel')?.value || 'Otro';
    const clave = document.getElementById('modal-clave-supervisor')?.value || '';
    if (!clave) { mostrarToast('Ingresá la clave de supervisor', 'warning'); return; }

    const hashIngresado = await hashSHA256(clave);
    const hashEsperado = window.APP_CONFIG?.supervisor_hash || '';

    if (hashIngresado !== hashEsperado) {
      mostrarToast('Clave de supervisor incorrecta', 'error');
      return;
    }

    try {
      const snap = await db.collection('pedidos')
        .where('mesa_id', '==', String(mesaNum))
        .where('estado_cocina', 'in', ['Pendiente', 'En Preparación', 'Demorado', 'Listo para Retirar/Comer', 'Pendiente confirma caja'])
        .where('entregado', '==', false)
        .get();
      const batch = db.batch();
      snap.docs.forEach(doc => {
        batch.update(doc.ref, {
          estado_cocina: 'Cancelado',
          motivo_cancelacion: motivo,
          cancelado_por: obtenerUsuarioActual()?.uid || null,
          clave_usada_hash: hashIngresado
        });
      });
      await batch.commit();
      cerrarModal();
      mostrarToast(`${snap.docs.length} pedido(s) cancelados`, 'warning');
    } catch (err) {
      console.error('Error cancelar:', err);
      mostrarToast('Error al cancelar', 'error');
    }
  };

  // ── Imprimir cuenta ────────────────────────────────────────
  window.imprimirCuentaMesa = async (mesaNum) => {
    try {
      const snap = await db.collection('pedidos')
        .where('mesa_id', '==', String(mesaNum))
        .where('entregado', '==', false)
        .where('estado_cocina', '!=', 'Cancelado')
        .get();
      const pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (!pedidos.length) { mostrarToast('No hay pedidos para imprimir', 'info'); return; }

      const totalGeneral = pedidos.reduce((s, p) => s + (p.total || 0), 0);
      const ahora = new Date();
      const fechaStr = ahora.toLocaleDateString('es-AR');
      const horaStr = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

      let itemsHTML = '';
      pedidos.forEach(p => {
        (p.items || []).forEach(i => {
          itemsHTML += `
            <div class="factura-item">
              <span>${i.cantidad}× ${i.nombre}${i.variante ? ` (${i.variante})` : ''}</span>
              <span>${formatearPrecio(i.subtotal)}</span>
            </div>`;
          if (i.notas) {
            itemsHTML += `<div class="factura-item-nota">  ${i.notas}</div>`;
          }
        });
      });

      const ticket = pedidos.map(p => '#' + p.id.slice(-6).toUpperCase()).join(', ');
      const metodo = pedidos[0]?.metodo_pago || 'Efectivo';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Cuenta Mesa ${mesaNum}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; padding: 16px; color: #222; }
            .factura { max-width: 320px; margin: 0 auto; }
            .factura-header { text-align: center; margin-bottom: 12px; border-bottom: 1px dashed #999; padding-bottom: 8px; }
            .factura-header h2 { font-size: 14px; font-weight: 700; }
            .factura-header p { font-size: 10px; color: #666; }
            .factura-legal { text-align: center; font-size: 9px; color: #888; margin-bottom: 8px; line-height: 1.4; }
            .factura-mesa { text-align: center; font-size: 18px; font-weight: 700; margin: 8px 0; }
            .factura-ticket { text-align: center; font-size: 10px; color: #999; margin-bottom: 8px; }
            .factura-fecha { text-align: right; font-size: 10px; color: #666; margin-bottom: 8px; }
            .factura-items { border-top: 1px dashed #999; padding-top: 8px; }
            .factura-item { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
            .factura-item-nota { font-size: 10px; color: #888; font-style: italic; }
            .factura-subtotales { border-top: 1px dashed #999; margin-top: 8px; padding-top: 8px; }
            .factura-subtotal-row { display: flex; justify-content: space-between; font-size: 11px; color: #555; padding: 1px 0; }
            .factura-total { border-top: 2px solid #222; margin-top: 4px; padding-top: 8px; display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; }
            .factura-footer { text-align: center; margin-top: 12px; font-size: 10px; color: #999; border-top: 1px dashed #999; padding-top: 8px; }
            .factura-metodo { margin: 4px 0; font-size: 11px; }
            @media print {
              body { margin: 0; padding: 8px; }
              .no-print { display: none; }
              .factura { max-width: 80mm; }
            }
          </style>
        </head>
        <body>
          <div class="factura">
            <div class="factura-header">
              <h2>🍽️ Rotisería SYM</h2>
              <p>Comprobante no válido como factura</p>
            </div>
            <div class="factura-legal">
              <p>CUIT: XX-XXXXXXXX-X</p>
              <p>Razón Social: Rotisería SYM S.R.L.</p>
              <p>Domicilio fiscal: [Domicilio registrado]</p>
              <p>Condición frente al IVA: Responsable Inscripto</p>
              <p>Actividad: Servicios de restaurantes y expendio de comidas preparadas</p>
            </div>
            <div class="factura-mesa">Mesa ${mesaNum}</div>
            <div class="factura-ticket">${ticket}</div>
            <div class="factura-fecha">${fechaStr} ${horaStr}</div>
            <div class="factura-items">
              ${itemsHTML}
            </div>
            <div class="factura-subtotales">
              <div class="factura-subtotal-row">
                <span>Subtotal</span>
                <span>${formatearPrecio(totalGeneral)}</span>
              </div>
            </div>
            <div class="factura-total">
              <span>TOTAL</span>
              <span>${formatearPrecio(totalGeneral)}</span>
            </div>
            <div class="factura-footer">
              <p class="factura-metodo">Método de pago: ${metodo}</p>
              <p>¡Gracias por su visita!</p>
            </div>
          </div>
          <script>window.onload = () => { window.print(); }</script>
        </body>
        </html>`;

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      } else {
        mostrarToast('Permití popups para imprimir', 'warning');
      }
    } catch (err) {
      console.error('Error imprimir:', err);
      mostrarToast('Error al generar cuenta', 'error');
    }
  };

  // ── Imprimir comprobante de cobro ────────────────────────
  function _imprimirComprobanteCobro(pedidoDocs, mesaId, total, montoRecibido, vuelto) {
    const ahora = new Date();
    const fechaStr = ahora.toLocaleDateString('es-AR');
    const horaStr = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const tickets = pedidoDocs.map(d => '#' + d.id.slice(-6).toUpperCase()).join(', ');
    const cajero = obtenerUsuarioActual()?.email || '';

    let itemsHTML = '';
    pedidoDocs.forEach(d => {
      const p = d.data();
      (p.items || []).forEach(i => {
        itemsHTML += `
          <div class="factura-item">
            <span>${i.cantidad}× ${i.nombre}${i.variante ? ` (${i.variante})` : ''}</span>
            <span>${formatearPrecio(i.subtotal)}</span>
          </div>`;
      });
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Comprobante de Cobro</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; padding: 16px; color: #222; }
          .factura { max-width: 320px; margin: 0 auto; }
          .factura-header { text-align: center; margin-bottom: 12px; border-bottom: 1px dashed #999; padding-bottom: 8px; }
          .factura-header h2 { font-size: 14px; font-weight: 700; }
          .factura-legal { text-align: center; font-size: 9px; color: #888; margin-bottom: 8px; line-height: 1.4; }
          .factura-mesa { text-align: center; font-size: 16px; font-weight: 700; margin: 8px 0; }
          .factura-fecha { text-align: right; font-size: 10px; color: #666; margin-bottom: 8px; }
          .factura-items { border-top: 1px dashed #999; padding-top: 8px; }
          .factura-item { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
          .factura-totals { border-top: 1px dashed #999; margin-top: 8px; padding-top: 8px; }
          .factura-total-row { display: flex; justify-content: space-between; font-size: 12px; padding: 1px 0; }
          .factura-total-row--main { font-size: 14px; font-weight: 700; border-top: 2px solid #222; margin-top: 4px; padding-top: 4px; }
          .factura-footer { text-align: center; margin-top: 12px; font-size: 10px; color: #999; border-top: 1px dashed #999; padding-top: 8px; }
          @media print {
            body { margin: 0; padding: 8px; }
            .factura { max-width: 80mm; }
          }
        </style>
      </head>
      <body>
        <div class="factura">
          <div class="factura-header">
            <h2>🍽️ Rotisería SYM</h2>
            <p style="font-size:9px;color:#888">Comprobante de cobro</p>
          </div>
          <div class="factura-legal">
            <p>CUIT: XX-XXXXXXXX-X</p>
            <p>Razón Social: Rotisería SYM S.R.L.</p>
          </div>
          <div class="factura-mesa">Mesa ${mesaId}</div>
          <div class="factura-fecha">${fechaStr} ${horaStr}</div>
          <div class="factura-items">${itemsHTML}</div>
          <div class="factura-totals">
            <div class="factura-total-row"><span>Total</span><span>${formatearPrecio(total)}</span></div>
            <div class="factura-total-row"><span>Efectivo</span><span>${formatearPrecio(montoRecibido || total)}</span></div>
            ${vuelto > 0 ? `<div class="factura-total-row"><span>Vuelto</span><span>${formatearPrecio(vuelto)}</span></div>` : ''}
            <div class="factura-total-row factura-total-row--main"><span>PAGADO</span><span>${formatearPrecio(total)}</span></div>
          </div>
          <div class="factura-footer">
            <p>Cajero: ${cajero}</p>
            <p>Tickets: ${tickets}</p>
            <p>Método: Efectivo</p>
          </div>
        </div>
        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  // ── Cobros agrupados ───────────────────────────────────────
  function _onCobrosUpdate(pedidos) {
    const list = document.getElementById('cobros-list');
    if (!list) return;

    const mesaPedidos = {};
    const directos = [];
    pedidos.forEach(p => {
      if (p.mesa_id && p.tipo_consumo === 'Comer en el local') {
        const key = String(p.mesa_id);
        if (!mesaPedidos[key]) mesaPedidos[key] = [];
        mesaPedidos[key].push(p);
      } else {
        directos.push(p);
      }
    });

    let html = '';

    Object.entries(mesaPedidos).forEach(([mesaId, grupo]) => {
      const total = grupo.reduce((s, p) => s + (p.total || 0), 0);
      const tieneMP = grupo.some(p => p.estado_pago === 'Pendiente verificacion MP');
      const todosPagados = grupo.every(p => p.estado_pago === 'Pagado');
      html += _cardGrupoMesa(mesaId, grupo, total, tieneMP, todosPagados);
    });

    directos.forEach(p => { html += _cardCobroDirecto(p); });

    if (!html) {
      list.innerHTML = `<div class="cajero-empty"><span>✅</span><p>Sin cobros pendientes</p></div>`;
      return;
    }

    list.innerHTML = `<div class="cobros-grid">${html}</div>`;
  }

  function _cardGrupoMesa(mesaId, pedidos, total, tieneMP, todosPagados) {
    const tickets = pedidos.map(p => `#${p.id.slice(-6).toUpperCase()}`).join(', ');
    const items = pedidos.flatMap(p => (p.items || []).map(i =>
      `${i.cantidad}× ${i.nombre}${i.variante ? ` (${i.variante})` : ''}${i.notas ? ` [${i.notas}]` : ''}`
    ));

    let accionHTML = '';
    if (todosPagados) {
      accionHTML = `<span class="badge badge--listo">✅ Pagado</span>`;
    } else if (tieneMP) {
      accionHTML = `
        <button class="btn btn--success btn--sm" onclick="confirmarPagoMPGrupo('${mesaId}')">✅ Confirmar MP</button>
        <button class="btn btn--secondary btn--sm" onclick="generarQRMPMesa('${mesaId}')">📱 QR</button>`;
    } else {
      accionHTML = `
        <button class="btn btn--success btn--sm" onclick="abrirModalCobroGrupo('${mesaId}', ${total})">💰 Cobrar</button>
        <button class="btn btn--secondary btn--sm" onclick="generarQRMPMesa('${mesaId}')">📱 QR MP</button>`;
    }

    return `
      <div class="cobro-grupo-card ${tieneMP ? 'cobro-grupo-card--mp' : ''}">
        <div class="cobro-grupo-header">
          <div>
            <h3 class="cobro-grupo-mesa">🪑 Mesa ${mesaId}</h3>
            <p class="cobro-grupo-tickets">${tickets}</p>
          </div>
          <div class="cobro-grupo-actions">${accionHTML}</div>
        </div>
        <div class="cobro-grupo-items">
          ${items.slice(0, 8).map(i => `<p class="cobro-grupo-item">• ${i}</p>`).join('')}
          ${items.length > 8 ? `<p class="cobro-grupo-item cobro-grupo-item--more">+${items.length - 8} más</p>` : ''}
        </div>
        <div class="cobro-grupo-footer">
          <span class="cobro-grupo-total">${formatearPrecio(total)}</span>
          <span class="cobro-grupo-count">${pedidos.length} pedido(s)</span>
        </div>
      </div>`;
  }

  function _cardCobroDirecto(pedido) {
    const ticket = pedido.id.slice(-6).toUpperCase();
    const creacion = pedido.fecha_hora_creacion?.toDate?.() || new Date();
    const hora = creacion.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const tieneMP = pedido.estado_pago === 'Pendiente verificacion MP';

    let accionHTML = '';
    if (pedido.estado_pago === 'Pagado') {
      accionHTML = `<span class="badge badge--listo">✅ Pagado</span>`;
    } else if (tieneMP) {
      accionHTML = `<button class="btn btn--success btn--sm" onclick="confirmarPagoMPDirecto('${pedido.id}')">✅ Confirmar MP</button>`;
    } else {
      accionHTML = `<button class="btn btn--success btn--sm" onclick="abrirModalCobro('${pedido.id}', ${pedido.total}, '')">💰 Cobrar</button>`;
    }

    return `
      <div class="cobro-card">
        <div class="cobro-card__header">
          <div>
            <p class="cobro-card__ticket">#${ticket}</p>
            <p class="cobro-card__cliente">${pedido.nombre_cliente}</p>
          </div>
          <span class="cobro-card__hora">${hora}</span>
        </div>
        <ul class="cobro-card__items">
          ${(pedido.items || []).map(i => `<li>${i.cantidad}× ${i.nombre}${i.variante ? ` (${i.variante})` : ''}</li>`).join('')}
        </ul>
        <div class="cobro-card__footer">
          <div>
            <p class="cobro-card__total">${formatearPrecio(pedido.total)}</p>
            <span class="badge badge--${pedido.estado_pago === 'Pagado' ? 'listo' : 'pendiente'}">${pedido.estado_pago}</span>
          </div>
          ${accionHTML}
        </div>
      </div>`;
  }

  // ── Modal cobro grupo ──────────────────────────────────────
  window.abrirModalCobroGrupo = async (mesaId, totalSugerido) => {
    const pedidos = await obtenerPedidosNoPagadosMesa(mesaId);
    if (!pedidos.length) { mostrarToast('No hay pedidos pendientes', 'info'); return; }
    const total = totalSugerido || pedidos.reduce((s, p) => s + (p.total || 0), 0);

    abrirModal(`
      <div class="modal modal--visible">
        <div class="modal__box">
          <div class="modal__header">
            <h3 class="modal__title">💰 Cobrar Mesa ${mesaId}</h3>
            <button class="modal__close" onclick="cerrarModal()">✕</button>
          </div>
          <div class="modal__body">
            <p class="modal-total">${pedidos.length} pedido(s) — Total: <strong>${formatearPrecio(total)}</strong></p>
            <div class="form-group">
              <label class="form-label">Método de pago</label>
              <select class="form-select" id="modal-metodo-pago" onchange="_toggleEfectivoFields()">
                <option value="Efectivo">💵 Efectivo</option>
              </select>
            </div>
            <div id="efectivo-fields">
              <div class="form-group">
                <label class="form-label">Monto recibido</label>
                <input class="form-input" type="number" id="modal-monto-recibido"
                       min="0" step="0.01" value="${total}"
                       oninput="_calcularVuelto(${total})" />
              </div>
              <div class="modal-vuelto" id="modal-vuelto">
                <span>Vuelto:</span><strong>${formatearPrecio(0)}</strong>
              </div>
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="cerrarModal()">Cancelar</button>
            <button class="btn btn--success" onclick="procesarCobroGrupo('${mesaId}', ${total})">
              ✅ Confirmar cobro
            </button>
          </div>
        </div>
      </div>
    `);
  };

  window._toggleEfectivoFields = () => {
    const metodo = document.getElementById('modal-metodo-pago')?.value;
    const el = document.getElementById('efectivo-fields');
    if (el) el.style.display = metodo === 'Efectivo' ? 'block' : 'none';
  };

  window._calcularVuelto = (total) => {
    const recibido = parseFloat(document.getElementById('modal-monto-recibido')?.value) || 0;
    const vuelto = Math.max(0, recibido - total);
    const el = document.getElementById('modal-vuelto');
    if (el) el.innerHTML = `<span>Vuelto:</span><strong>${formatearPrecio(vuelto)}</strong>`;
  };

  window.procesarCobroGrupo = async (mesaId, total) => {
    const metodo = document.getElementById('modal-metodo-pago')?.value || 'Efectivo';
    let montoRecibido = null;
    let vuelto = null;

    if (metodo === 'Efectivo') {
      montoRecibido = parseFloat(document.getElementById('modal-monto-recibido')?.value) || 0;
      vuelto = Math.max(0, montoRecibido - total);
      if (montoRecibido < total) {
        mostrarToast('El monto recibido es menor al total', 'error');
        return;
      }
    }

    try {
      const count = await marcarMesaPagado(mesaId, metodo);
      const pedidos = await db.collection('pedidos')
        .where('mesa_id', '==', String(mesaId))
        .where('estado_pago', '==', 'Pagado')
        .where('entregado', '==', false)
        .get();
      const batch = db.batch();
      pedidos.docs.forEach(doc => {
        batch.update(doc.ref, {
          monto_recibido: montoRecibido,
          vuelto,
          cobrado_por: obtenerUsuarioActual()?.uid || null,
          fecha_cobro: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
      // Liberar mesa después del cobro
      const mesa = _mesas.find(m => String(m.numero) === String(mesaId));
      if (mesa) {
        await liberarMesa(mesa.id);
      }
      cerrarModal();
      mostrarToast(`Cobro registrado ✅ (${count} pedidos)`, 'success');
      // Ofrecer imprimir comprobante
      if (metodo === 'Efectivo') {
        setTimeout(() => {
          if (confirm('¿Imprimir comprobante de cobro?')) {
            _imprimirComprobanteCobro(pedidos.docs, mesaId, total, montoRecibido, vuelto);
          }
        }, 500);
      }
    } catch (err) {
      console.error('Error cobro grupo:', err);
      mostrarToast('Error al registrar el cobro', 'error');
    }
  };

  // ── Modal cobro individual ─────────────────────────────────
  window.abrirModalCobro = (pedidoId, total, mesaNum) => {
    abrirModal(`
      <div class="modal modal--visible">
        <div class="modal__box">
          <div class="modal__header">
            <h3 class="modal__title">💰 Registrar cobro ${mesaNum ? `— Mesa ${mesaNum}` : ''}</h3>
            <button class="modal__close" onclick="cerrarModal()">✕</button>
          </div>
          <div class="modal__body">
            <p class="modal-total">Total: <strong>${formatearPrecio(total)}</strong></p>
            <div class="form-group">
              <label class="form-label">Método de pago</label>
              <select class="form-select" id="modal-metodo-pago" onchange="_toggleEfectivoFields()">
                <option value="Efectivo">💵 Efectivo</option>
              </select>
            </div>
            <div id="efectivo-fields">
              <div class="form-group">
                <label class="form-label">Monto recibido</label>
                <input class="form-input" type="number" id="modal-monto-recibido"
                       min="0" step="0.01" value="${total}"
                       oninput="_calcularVuelto(${total})" />
              </div>
              <div class="modal-vuelto" id="modal-vuelto">
                <span>Vuelto:</span><strong>${formatearPrecio(0)}</strong>
              </div>
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="cerrarModal()">Cancelar</button>
            <button class="btn btn--success" onclick="procesarCobroIndividual('${pedidoId}', ${total})">
              ✅ Confirmar cobro
            </button>
          </div>
        </div>
      </div>
    `);
  };

  window.procesarCobroIndividual = async (pedidoId, total) => {
    const metodo = document.getElementById('modal-metodo-pago')?.value || 'Efectivo';
    let montoRecibido = null;
    let vuelto = null;

    if (metodo === 'Efectivo') {
      montoRecibido = parseFloat(document.getElementById('modal-monto-recibido')?.value) || 0;
      vuelto = Math.max(0, montoRecibido - total);
      if (montoRecibido < total) {
        mostrarToast('El monto recibido es menor al total', 'error');
        return;
      }
    }

    try {
      await marcarComoPagado(pedidoId, metodo);
      await db.collection('pedidos').doc(pedidoId).update({
        monto_recibido: montoRecibido,
        vuelto,
        cobrado_por: obtenerUsuarioActual()?.uid || null,
        fecha_cobro: firebase.firestore.FieldValue.serverTimestamp()
      });
      // Liberar mesa si es pedido de mesa
      const pedidoDoc = await db.collection('pedidos').doc(pedidoId).get();
      const pedidoData = pedidoDoc.data();
      if (pedidoData?.mesa_id) {
        const mesa = _mesas.find(m => String(m.numero) === String(pedidoData.mesa_id));
        if (mesa) await liberarMesa(mesa.id);
      }
      cerrarModal();
      mostrarToast('Cobro registrado ✅', 'success');
      // Ofrecer imprimir comprobante
      if (metodo === 'Efectivo') {
        setTimeout(() => {
          if (confirm('¿Imprimir comprobante de cobro?')) {
            _imprimirComprobanteCobro([pedidoDoc], pedidoData?.mesa_id || '', total, montoRecibido, vuelto);
          }
        }, 500);
      }
    } catch (err) {
      console.error('Error cobro:', err);
      mostrarToast('Error al registrar el cobro', 'error');
    }
  };

  // ── Confirmar MP ───────────────────────────────────────────
  window.confirmarPagoMPGrupo = async (mesaId) => {
    try {
      const count = await marcarMesaPagado(mesaId, 'MercadoPago');
      mostrarToast(`Pago MP confirmado ✅ (${count} pedidos)`, 'success');
    } catch (err) {
      console.error('Error confirmar MP:', err);
      mostrarToast('Error al confirmar', 'error');
    }
  };

  window.confirmarPagoMPDirecto = async (pedidoId) => {
    try {
      await marcarComoPagado(pedidoId, 'MercadoPago');
      mostrarToast('Pago MP confirmado ✅', 'success');
    } catch (err) {
      console.error('Error confirmar MP:', err);
      mostrarToast('Error al confirmar', 'error');
    }
  };

  // ── QR MP desde cajero ─────────────────────────────────────
  window.generarQRMPMesa = async (mesaId) => {
    try {
      const res = await fetch('/api/mp-preference-for-mesa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesa_id: mesaId })
      });
      if (!res.ok) {
        const err = await res.json();
        mostrarToast(err.error || 'No hay pedidos pendientes', 'error');
        return;
      }
      const data = await res.json();

      abrirModal(`
        <div class="modal modal--visible">
          <div class="modal__box">
            <div class="modal__header">
              <h3 class="modal__title">📱 QR de pago — Mesa ${mesaId}</h3>
              <button class="modal__close" onclick="cerrarModal()">✕</button>
            </div>
            <div class="modal__body" style="text-align:center">
              <img src="/qr-mp-redirect?mesa=${mesaId}&pref_id=${data.id}"
                   class="mp-qr-large" alt="QR MercadoPago" />
              <p style="margin-top:var(--space-3)"><strong>Total: ${formatearPrecio(data.total)}</strong></p>
              <p style="font-size:var(--text-xs);color:var(--gris-medio)">
                ${data.pedidos_count} pedido(s) — Escaneá con MercadoPago
              </p>
              <a href="${data.init_point}" target="_blank" class="btn btn--secondary btn--full" style="margin-top:var(--space-3)">
                🔗 Abrir en navegador
              </a>
            </div>
          </div>
        </div>
      `);
    } catch (err) {
      console.error('Error QR MP:', err);
      mostrarToast('Error al generar QR', 'error');
    }
  };

  // ── Historial pedidos activos ──────────────────────────────
  function _onHistorialUpdate(pedidos) {
    const list = document.getElementById('historial-list');
    if (!list) return;
    if (!pedidos.length) {
      list.innerHTML = `<div class="cajero-empty"><span>📋</span><p>Sin pedidos activos</p></div>`;
      return;
    }
    list.innerHTML = `<div class="cobros-grid">${pedidos.map(p => _cardHistorial(p)).join('')}</div>`;
  }

  function _cardHistorial(pedido) {
    const creacion = pedido.fecha_hora_creacion?.toDate?.() || new Date();
    const hora = creacion.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const mins = _minutosDesde(pedido.fecha_hora_creacion);
    const esListo = pedido.estado_cocina === 'Listo para Retirar/Comer';
    const esRetirar = pedido.tipo_consumo === 'Retirar';
    const pagado = pedido.estado_pago === 'Pagado';
    const mesaNum = pedido.mesa_id || '';

    let accionHTML = '';
    if (esRetirar && esListo) {
      accionHTML = pagado
        ? `<button class="btn btn--success" onclick="handleEntregar('${pedido.id}')">📦 Entregar</button>`
        : `<button class="btn btn--success" onclick="abrirModalCobro('${pedido.id}', ${pedido.total}, '${mesaNum}')">💰 Cobrar</button>`;
    } else if (!esRetirar) {
      accionHTML = pagado
        ? `<span class="badge badge--listo">✅ Pagado</span>`
        : `<button class="btn btn--success" onclick="abrirModalCobro('${pedido.id}', ${pedido.total}, '${mesaNum}')">💰 Cobrar</button>`;
    }

    return `
      <div class="cobro-card ${esListo ? 'cobro-card--listo' : ''}">
        <div class="cobro-card__header">
          <div>
            <p class="cobro-card__ticket">#${pedido.id.slice(-6).toUpperCase()}</p>
            <p class="cobro-card__cliente">
              ${pedido.nombre_cliente}
              ${mesaNum ? `<span class="cobro-card__mesa">🪑 ${mesaNum}</span>` : ''}
            </p>
          </div>
          <div class="cobro-card__meta">
            <span class="badge badge--${claseEstado(pedido.estado_cocina)}">${pedido.estado_cocina}</span>
            <span class="cobro-card__hora">${hora} · ${mins || 0}min</span>
          </div>
        </div>
        <ul class="cobro-card__items">
          ${(pedido.items || []).map(i => `
            <li>${i.cantidad}× ${i.nombre}${i.variante ? ` (${i.variante})` : ''}${i.notas ? ` — <em>${i.notas}</em>` : ''}</li>`).join('')}
        </ul>
        <div class="cobro-card__footer">
          <div>
            <p class="cobro-card__consumo">${pedido.tipo_consumo === 'Comer en el local' ? '🍽️' : '🥡'} ${pedido.tipo_consumo}</p>
            <p class="cobro-card__total">${formatearPrecio(pedido.total)}</p>
          </div>
          ${accionHTML}
        </div>
      </div>`;
  }

  async function handleEntregar(pedidoId) {
    try {
      await marcarEntregado(pedidoId);
      mostrarToast('Pedido entregado 📦', 'success');
    } catch { mostrarToast('Error al entregar', 'error'); }
  }

  // ── Timeouts ───────────────────────────────────────────────
  let _timeoutInterval = null;

  function iniciarTimeouts() {
    if (_timeoutInterval) return;
    _timeoutInterval = setInterval(_verificarTimeouts, 60000);
    _verificarTimeouts();
  }

  function detenerTimeouts() {
    if (_timeoutInterval) { clearInterval(_timeoutInterval); _timeoutInterval = null; }
  }

  async function _verificarTimeouts() {
    try {
      const snap = await db.collection('pedidos')
        .where('estado_cocina', 'in', ['Pendiente', 'Pendiente confirma caja'])
        .get();
      const ahora = Date.now();
      for (const doc of snap.docs) {
        const p = { id: doc.id, ...doc.data() };
        const creacion = p.fecha_hora_creacion?.toMillis?.() || 0;
        const elapsed = ahora - creacion;
        if (p.estado_cocina === 'Pendiente' && elapsed > 5 * 60000) {
          await db.collection('pedidos').doc(p.id).update({ estado_cocina: 'Demorado' });
        }
      }
    } catch (err) {
      console.warn('Timeout check error:', err);
    }
  }

  // ── Expose ─────────────────────────────────────────────────
  window.iniciarMesasCajero = iniciarMesasCajero;
  window.iniciarCobros = iniciarCobros;
  window._cleanupMesas = _cleanupMesas;
  window.seleccionarZonaCajero = seleccionarZonaCajero;
  window.seleccionarMesaCajero = seleccionarMesaCajero;
  window.handleEntregar = handleEntregar;
  window.iniciarTimeouts = iniciarTimeouts;
  window.detenerTimeouts = detenerTimeouts;

})();
