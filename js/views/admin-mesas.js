// js/views/admin-mesas.js — Grid editor con palette drag-drop
(() => {

  let _mesasAdmin     = [];
  let _zonasAdmin     = [];
  let _zonaActiva     = null;
  let _gridCentrado   = false;
  let _dragMesa       = null;
  let _dragTamaño     = null;

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

  const TAMAÑOS = [
    { value: '1x1', label: '1×1', icon: '🪑', cap: '2-4 pers' },
    { value: '1x2', label: '1×2', icon: '🛋️', cap: '6 pers (horizontal)' },
    { value: '2x1', label: '2×1', icon: '🪑', cap: '6 pers (vertical)' },
    { value: '2x2', label: '2×2', icon: '⬜', cap: '8 pers' },
  ];

  function iniciarAdminMesas() {
    escucharMesasAdmin(_onMesasUpdate);
    setTimeout(_setupScrollListener, 200);
  }

  function _onMesasUpdate(mesas) {
    _mesasAdmin = mesas;
    _zonasAdmin = [...new Set(mesas.map(m => m.zona))].sort();
    if (!_zonaActiva && _zonasAdmin.length) _zonaActiva = _zonasAdmin[0];
    _renderPalette();
    _renderGrid();
    _renderSidebar();
    if (!_gridCentrado) {
      _gridCentrado = true;
      setTimeout(() => centrarGridMesas(), 100);
    }
  }

  // ── Palette (izquierda) ──────────────────────────────────────
  function _renderPalette() {
    const pal = document.getElementById('admin-palette');
    if (!pal) return;

    pal.innerHTML = `
      <p class="admin-palette__title">Arrastrar al grid</p>
      ${TAMAÑOS.map(t => `
        <div class="admin-palette__item"
             draggable="true"
             ondragstart="_onPaletteDragStart(event,'${t.value}')"
             ondragend="_onPaletteDragEnd(event)">
          <span class="admin-palette__icon">${t.icon}</span>
          <span class="admin-palette__label">Mesa ${t.label}</span>
          <span class="admin-palette__cap">${t.cap}</span>
        </div>
      `).join('')}
      <p class="admin-palette__hint">Arrastrá al grid para crear. Arrastrá mesas para mover.</p>
    `;
  }

  // ── Grid visual ──────────────────────────────────────────────
  function _renderGrid() {
    const grid = document.getElementById('admin-mesas-grid');
    if (!grid) return;

    const mesasZona = _mesasAdmin.filter(m => m.zona === _zonaActiva);

    if (!mesasZona.length) {
      grid.innerHTML = `<p class="tv-empty" style="grid-column:1/-1">No hay mesas en esta zona. Arrastrá desde la palette.</p>`;
      return;
    }

    grid.innerHTML = mesasZona.map(m => {
      const estado = m.activa ? (m.estado || 'Libre') : 'Inactiva';
      const color = COLORES[estado] || COLORES['Libre'];
      const clase = CLASES[estado] || '';
      const tam = m.tamaño || '1x1';

      // Posición explícita en grid
      const col = (m.pos_x || 0) + 1;
      const row = (m.pos_y || 0) + 1;
      let colSpan = 1, rowSpan = 1;
      if (tam === '1x2') colSpan = 2;
      else if (tam === '2x1') rowSpan = 2;
      else if (tam === '2x2') { colSpan = 2; rowSpan = 2; }

      const gridStyle = `grid-column:${col}/span ${colSpan};grid-row:${row}/span ${rowSpan};`;

      return `
        <div class="admin-mesa ${clase} admin-mesa--${tam}"
             data-id="${m.id}" data-numero="${m.numero}"
             draggable="true"
             style="${gridStyle}"
             ondragstart="_onMesaDragStart(event,'${m.id}')"
             ondragend="_onMesaDragEnd(event)"
             onclick="editarMesaAdmin('${m.id}')">
          <span class="admin-mesa-num">${m.numero}</span>
          <span class="admin-mesa-estado" style="color:${color}">${estado}</span>
          <div class="admin-mesa-acciones">
            <button class="btn-icon btn-icon--qr" onclick="event.stopPropagation();descargarQRMesa('${m.numero}')" title="Descargar QR">📱</button>
            <button class="btn-icon" onclick="event.stopPropagation();eliminarMesaAdmin('${m.id}',${m.numero})" title="Eliminar mesa">🗑️</button>
          </div>
        </div>`;
    }).join('');
  }

  // ── Sidebar (derecha) ────────────────────────────────────────
  function _renderSidebar() {
    const sidebar = document.getElementById('admin-mesas-lista');
    if (!sidebar) return;

    const zonasHTML = _zonasAdmin.map(z => `
      <button class="btn-tag ${z === _zonaActiva ? 'btn-tag--active' : ''}"
              onclick="seleccionarZonaAdmin('${z}')">${z}</button>
    `).join('');

    const mesasZona = _mesasAdmin.filter(m => m.zona === _zonaActiva);
    const activas = mesasZona.filter(m => m.activa).length;
    const inactivas = mesasZona.length - activas;

    sidebar.innerHTML = `
      <div class="admin-mesas-header">
        <div class="btn-tags">
          ${zonasHTML}
          <button class="btn-tag" onclick="agregarZonaAdmin()">+ Zona</button>
        </div>
      </div>

      <div class="admin-mesas-stats">
        <span>${mesasZona.length} total</span>
        <span style="color:#27AE60">${activas} activas</span>
        ${inactivas ? `<span style="color:#6B7280">${inactivas} inactivas</span>` : ''}
      </div>

      <div class="admin-mesas-qr">
        <p class="admin-palette__title" style="margin-bottom:4px">Descargar QR</p>
        <div style="display:flex;gap:var(--space-2);align-items:center">
          <select class="form-select" id="admin-qr-select" style="flex:1;font-size:var(--text-xs)">
            <option value="">Seleccionar mesa...</option>
            ${mesasZona.filter(m => m.activa).map(m =>
              `<option value="${m.numero}">Mesa ${m.numero}</option>`
            ).join('')}
          </select>
          <button class="btn btn--secondary btn--sm" onclick="descargarQRSeleccion()" title="Descargar QR">📱</button>
        </div>
        <button class="btn btn--secondary btn--sm" onclick="descargarTodosQRAdmin()" style="margin-top:var(--space-2)">
          📦 Descargar todos los QR
        </button>
      </div>

      <div style="margin-top:auto;padding-top:var(--space-3);border-top:1px solid rgba(0,0,0,0.06)">
        <p style="font-size:10px;color:var(--gris-medio);line-height:1.4">
          💡 Click en mesa = editar<br>
          🗑️ = eliminar permanentemente<br>
          📱 = descargar QR individual
        </p>
      </div>
    `;
  }

  // ── Palette Drag ─────────────────────────────────────────────
  window._onPaletteDragStart = (e, tamaño) => {
    _dragTamaño = tamaño;
    _dragMesa = null;
    e.target.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', tamaño);
  };

  window._onPaletteDragEnd = (e) => {
    e.target.style.opacity = '1';
    _dragTamaño = null;
    const grid = document.getElementById('admin-mesas-grid');
    if (grid) grid.classList.remove('admin-mesas-grid--dragover');
  };

  // ── Mesa Drag (reubicar) ────────────────────────────────────
  window._onMesaDragStart = (e, mesaId) => {
    _dragMesa = mesaId;
    _dragTamaño = null;
    e.target.classList.add('admin-mesa--dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', mesaId);
    e.stopPropagation();
  };

  window._onMesaDragEnd = (e) => {
    e.target.classList.remove('admin-mesa--dragging');
    _dragMesa = null;
    const grid = document.getElementById('admin-mesas-grid');
    if (grid) grid.classList.remove('admin-mesas-grid--dragover');
  };

  // ── Grid Drop ────────────────────────────────────────────────
  window._onGridDrop = async (e) => {
    e.preventDefault();
    const grid = document.getElementById('admin-mesas-grid');
    grid.classList.remove('admin-mesas-grid--dragover');

    const rect = grid.getBoundingClientRect();
    const cellW = 82; // 80px + 2px gap
    const cellH = 82;
    const x = Math.max(0, Math.floor((e.clientX - rect.left) / cellW));
    const y = Math.max(0, Math.floor((e.clientY - rect.top) / cellH));

    // Crear nueva mesa desde palette
    if (_dragTamaño) {
      const numero = obtenerSiguienteNumero(_mesasAdmin);
      const zona = _zonaActiva || _zonasAdmin[0] || 'Salón';
      try {
        await crearMesa({
          numero,
          zona,
          tamaño: _dragTamaño,
          pos_x: x,
          pos_y: y,
        });
        mostrarToast(`Mesa ${numero} creada ✅`, 'success');
      } catch (err) {
        mostrarToast(err.message || 'Error al crear mesa', 'error');
      }
      _dragTamaño = null;
      return;
    }

    // Reubicar mesa existente
    if (_dragMesa) {
      await actualizarPosicionMesa(_dragMesa, x, y);
      _dragMesa = null;
    }
  };

  window._onGridDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = _dragTamaño ? 'copy' : 'move';
    const grid = document.getElementById('admin-mesas-grid');
    if (grid) grid.classList.add('admin-mesas-grid--dragover');
  };

  window._onGridDragLeave = (e) => {
    const grid = document.getElementById('admin-mesas-grid');
    if (grid && !grid.contains(e.relatedTarget)) {
      grid.classList.remove('admin-mesas-grid--dragover');
    }
  };

  // ── Acciones ─────────────────────────────────────────────────
  window.seleccionarZonaAdmin = (zona) => {
    _zonaActiva = zona;
    _renderGrid();
    _renderSidebar();
  };

  window.agregarZonaAdmin = () => {
    const nombre = prompt('Nombre de la nueva zona:');
    if (!nombre || !nombre.trim()) return;
    _zonasAdmin.push(nombre.trim());
    _zonaActiva = nombre.trim();
    _renderSidebar();
    _renderGrid();
  };

  // ── Editar mesa (click) ─────────────────────────────────────
  window.editarMesaAdmin = (mesaId) => {
    const m = _mesasAdmin.find(x => x.id === mesaId);
    if (!m) return;

    const zonas = _zonasAdmin.map(z =>
      `<option value="${z}" ${z === m.zona ? 'selected' : ''}>${z}</option>`
    ).join('');

    const tamOptions = TAMAÑOS.map(t =>
      `<option value="${t.value}" ${t.value === m.tamaño ? 'selected' : ''}>${t.label} (${t.cap})</option>`
    ).join('');

    abrirModal(`
      <div class="modal modal--visible">
        <div class="modal__box">
          <div class="modal__header">
            <h3 class="modal__title">Mesa ${m.numero}</h3>
            <button class="modal__close" onclick="cerrarModal()">✕</button>
          </div>
          <div class="modal__body">
            <div class="form-group">
              <label class="form-label">Número</label>
              <input class="form-input" id="modal-mesa-num-edit" type="number" min="1" max="99" value="${m.numero}" />
            </div>
            <div class="form-group">
              <label class="form-label">Zona</label>
              <select class="form-select" id="modal-mesa-zona-edit">${zonas}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Tamaño</label>
              <select class="form-select" id="modal-mesa-tam-edit">${tamOptions}</select>
            </div>
            <div class="form-group" style="display:flex;align-items:center;gap:var(--space-2)">
              <input type="checkbox" id="modal-mesa-activa-edit" ${m.activa ? 'checked' : ''} />
              <label for="modal-mesa-activa-edit" class="form-label" style="margin:0">Activa</label>
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="cerrarModal()">Cancelar</button>
            <button class="btn btn--danger" onclick="eliminarMesaAdmin('${m.id}',${m.numero})">🗑️ Eliminar</button>
            <button class="btn btn--primary" onclick="guardarEditarMesaAdmin('${m.id}')">Guardar</button>
          </div>
        </div>
      </div>`);
  };

  window.guardarEditarMesaAdmin = async (mesaId) => {
    const numero = parseInt(document.getElementById('modal-mesa-num-edit').value, 10);
    const zona   = document.getElementById('modal-mesa-zona-edit').value;
    const tamaño = document.getElementById('modal-mesa-tam-edit').value;
    const activa = document.getElementById('modal-mesa-activa-edit').checked;

    if (!numero || !zona) {
      mostrarToast('Completá número y zona', 'error');
      return;
    }

    try {
      const mesaActual = _mesasAdmin.find(m => m.id === mesaId);
      const eraActiva = mesaActual ? mesaActual.activa !== false : true;

      // Validamos ANTES de escribir: desactivar corta si la mesa tiene pedidos activos
      if (!activa && eraActiva) await desactivarMesa(mesaId);

      await actualizarMesa(mesaId, { numero, zona, tamaño });

      // Reactivar además libera el candado de escaneo (scan_session_id)
      if (activa && !eraActiva) await activarMesa(mesaId);

      cerrarModal();
      mostrarToast('Mesa actualizada ✅', 'success');
    } catch (e) {
      mostrarToast(e.message || 'Error al actualizar', 'error');
    }
  };

  window.eliminarMesaAdmin = async (mesaId, numero) => {
    if (!confirm(`¿Eliminar mesa ${numero} permanentemente?\n\nSi tiene pedidos registrados, solo podés desactivarla.`)) return;
    try {
      await eliminarMesa(mesaId);
      cerrarModal();
      mostrarToast(`Mesa ${numero} eliminada`, 'success');
    } catch (e) {
      mostrarToast(e.message || 'Error al eliminar', 'error');
    }
  };

  // ── QR Download ──────────────────────────────────────────────
  window.descargarQRMesa = (numero) => {
    const a = document.createElement('a');
    a.href = `/qr/${numero}.png`;
    a.download = `mesa-${numero}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    mostrarToast(`Descargando QR mesa ${numero}`, 'success');
  };

  window.descargarQRSeleccion = () => {
    const sel = document.getElementById('admin-qr-select');
    if (!sel || !sel.value) {
      mostrarToast('Elegí una mesa primero', 'error');
      return;
    }
    descargarQRMesa(parseInt(sel.value, 10));
  };

  window.descargarTodosQRAdmin = () => {
    const activas = _mesasAdmin.filter(m => m.activa);
    if (!activas.length) {
      mostrarToast('No hay mesas activas', 'error');
      return;
    }
    activas.forEach((m, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = `/qr/${m.numero}.png`;
        a.download = `mesa-${m.numero}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, i * 200);
    });
    mostrarToast(`Descargando ${activas.length} QR...`, 'success');
  };

  // ── Centrar grid en mesas ───────────────────────────────────
  window.centrarGridMesas = () => {
    const wrap = document.getElementById('admin-mesas-grid-wrap');
    if (!wrap) return;

    const mesasZona = _mesasAdmin.filter(m => m.zona === _zonaActiva && m.activa);
    if (!mesasZona.length) {
      wrap.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      return;
    }

    // Calcular centro del bounding box de las mesas
    const minX = Math.min(...mesasZona.map(m => m.pos_x || 0));
    const maxX = Math.max(...mesasZona.map(m => (m.pos_x || 0) + (m.tamaño === '1x2' || m.tamaño === '2x2' ? 2 : 1)));
    const minY = Math.min(...mesasZona.map(m => m.pos_y || 0));
    const maxY = Math.max(...mesasZona.map(m => (m.pos_y || 0) + (m.tamaño === '2x1' || m.tamaño === '2x2' ? 2 : 1)));

    const cellSize = 82; // 80px + 2px gap
    const centerX = ((minX + maxX) / 2) * cellSize;
    const centerY = ((minY + maxY) / 2) * cellSize;

    wrap.scrollTo({
      left: Math.max(0, centerX - wrap.clientWidth / 2),
      top:  Math.max(0, centerY - wrap.clientHeight / 2),
      behavior: 'smooth'
    });
  };

  // Mostrar btn centrar al hacer scroll
  function _setupScrollListener() {
    const wrap = document.getElementById('admin-mesas-grid-wrap');
    const btn = document.getElementById('admin-grid-center');
    if (!wrap || !btn) return;
    wrap.addEventListener('scroll', () => {
      btn.style.display = (wrap.scrollLeft > 50 || wrap.scrollTop > 50) ? 'flex' : 'none';
    });
  }

  // ── Cleanup ──────────────────────────────────────────────────
  function _cleanupAdminMesas() {
    dejarDeEscucharMesasAdmin();
  }

  window.iniciarAdminMesas    = iniciarAdminMesas;
  window._cleanupAdminMesas   = _cleanupAdminMesas;

})();
