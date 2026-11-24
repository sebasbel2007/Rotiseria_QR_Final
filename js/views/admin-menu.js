// js/views/admin-menu.js
(() => {

  // Estado compartido con admin.js via window
  const _CATS_DOC = () => db.collection('config').doc('categorias');

  async function cargarCategorias() {
    const snap = await _CATS_DOC().get();
    if (snap.exists) {
      window._categoriasAdmin = snap.data().lista || [];
    } else {
      window._categoriasAdmin = [
        { nombre: 'Pollos',       visible: true },
        { nombre: 'Milanesas',    visible: true },
        { nombre: 'Guarniciones', visible: true },
        { nombre: 'Empanadas',    visible: true },
        { nombre: 'Bebidas',      visible: true },
      ];
      await _CATS_DOC().set({ lista: window._categoriasAdmin });
    }
  }

  async function _guardarCategorias() {
    await _CATS_DOC().set({ lista: window._categoriasAdmin });
  }

  function refrescarUICategorias() {
    const lista  = document.getElementById('categorias-lista');
    const filtro = document.getElementById('filtro-categoria');
    if (lista)  lista.innerHTML  = _renderizarListaCategorias();
    if (filtro) {
      const val = filtro.value;
      filtro.innerHTML = `<option value="">Todas las categorías</option>` +
        window._categoriasAdmin.map(c =>
          `<option ${val === c.nombre ? 'selected' : ''}>${c.nombre}</option>`).join('');
    }
    const mpCat = document.getElementById('mp-categoria');
    if (mpCat) {
      const cur = mpCat.value;
      mpCat.innerHTML = window._categoriasAdmin.map(c =>
        `<option ${cur === c.nombre ? 'selected' : ''}>${c.nombre}</option>`).join('');
    }
  }

  function _renderizarListaCategorias() {
    if (!window._categoriasAdmin.length) return `<p class="ventas-empty">Sin categorías</p>`;
    return window._categoriasAdmin.map((c, i) => `
      <div class="categoria-item" id="cat-item-${i}">
        <span class="categoria-item__nombre">${c.nombre}</span>
        <div class="categoria-item__acciones">
          <button class="toggle-estado-btn toggle-estado-btn--${c.visible ? 'disponible' : 'agotado'}"
                  onclick="toggleVisibilidadCategoria(${i})">
            ${c.visible ? '👁️ Visible' : '🚫 Oculta'}
          </button>
          <button class="btn btn--sm admin-btn--eliminar"
                  onclick="eliminarCategoria(${i})">✕</button>
        </div>
      </div>`).join('');
  }

  async function agregarCategoria() {
    const input = document.getElementById('nueva-categoria-input');
    const val   = input.value.trim();
    if (!val || window._categoriasAdmin.some(c => c.nombre === val)) {
      mostrarToast('Categoría inválida o ya existe', 'warning');
      return;
    }
    window._categoriasAdmin.push({ nombre: val, visible: true });
    await _guardarCategorias();
    input.value = '';
    refrescarUICategorias();
    mostrarToast(`"${val}" agregada ✅`, 'success');
  }

  async function eliminarCategoria(idx) {
    const cat   = window._categoriasAdmin[idx];
    const enUso = window._productosAdmin.some(p => p.categoria === cat.nombre && !p.archivado);
    if (enUso) {
      mostrarToast('No podés eliminar una categoría con productos activos', 'error');
      return;
    }
    window._categoriasAdmin.splice(idx, 1);
    await _guardarCategorias();
    refrescarUICategorias();
    mostrarToast('Categoría eliminada', 'success');
  }

  async function toggleVisibilidadCategoria(idx) {
    window._categoriasAdmin[idx].visible = !window._categoriasAdmin[idx].visible;
    await _guardarCategorias();
    refrescarUICategorias();
    mostrarToast(`Categoría ${window._categoriasAdmin[idx].visible ? 'visible' : 'oculta'} ✅`, 'success');
  }

  // ── Tabla de productos ────────────────────────────────────────
  function onProductosAdminUpdate(productos) {
    window._productosAdmin = productos;
    filtrarTablaAdmin();
  }

  function filtrarTablaAdmin() {
    const categoria = document.getElementById('filtro-categoria')?.value || '';
    const archivado = document.getElementById('filtro-archivado')?.value || 'activos';

    let lista = window._productosAdmin;
    if (categoria) lista = lista.filter(p => p.categoria === categoria);
    if (archivado === 'activos')    lista = lista.filter(p => !p.archivado);
    if (archivado === 'archivados') lista = lista.filter(p => p.archivado);

    _renderizarTabla(lista);
  }

  function _renderizarTabla(productos) {
    const tbody = document.getElementById('admin-tabla-body');
    if (!tbody) return;

    if (!productos.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="admin-table__empty">Sin productos</td></tr>`;
      return;
    }

    tbody.innerHTML = productos.map(p => `
      <tr class="${p.archivado ? 'admin-table__row--archivado' : p.estado === 'Agotado' ? 'admin-table__row--agotado' : ''}">
        <td>
          <div class="admin-producto-cell">
            <img class="admin-producto-cell__img"
                 src="${p.url_foto || 'https://placehold.co/48x48/ECE9E1/2C3E50?text=S'}"
                 alt="${p.nombre}"
                 onerror="this.src='https://placehold.co/48x48/ECE9E1/2C3E50?text=S'" />
            <div>
              <p class="admin-producto-cell__nombre">
                ${p.nombre}
                ${p.archivado ? '<span class="badge badge--agotado" style="margin-left:6px">Archivado</span>' : ''}
              </p>
              <p class="admin-producto-cell__desc">${p.descripcion || ''}</p>
            </div>
          </div>
        </td>
        <td><span class="badge badge--disponible">${p.categoria}</span></td>
        <td><strong>${formatearPrecio(p.precio)}</strong></td>
        <td>
          ${!p.archivado ? `
            <button class="toggle-estado-btn toggle-estado-btn--${p.estado === 'Disponible' ? 'disponible' : 'agotado'}"
                    onclick="handleToggleEstado('${p.id}', '${p.estado}')">
              ${p.estado === 'Disponible' ? '✅ Disponible' : '❌ Agotado'}
            </button>` : '<span class="text-muted" style="font-size:var(--text-xs)">—</span>'}
        </td>
        <td>
          <div class="admin-acciones">
            ${!p.archivado
              ? `<button class="btn btn--secondary btn--sm" onclick="abrirModalProducto('${p.id}')">✏️ Editar</button>`
              : ''}
            <button class="btn btn--sm ${p.archivado ? 'btn--success' : 'admin-btn--archivar'}"
                    onclick="handleArchivar('${p.id}', ${p.archivado})">
              ${p.archivado ? '📦 Desarchivar' : '🗄️ Archivar'}
            </button>
            <button class="btn btn--sm admin-btn--eliminar"
                    onclick="confirmarEliminar('${p.id}', '${p.nombre.replace(/'/g, "\\'")}')">
              🗑️
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  async function handleToggleEstado(id, estadoActual) {
    try {
      await toggleEstadoProducto(id, estadoActual);
      mostrarToast('Estado actualizado', 'success');
    } catch {
      mostrarToast('Error al actualizar estado', 'error');
    }
  }

  async function handleArchivar(id, estaArchivado) {
    try {
      await archivarProducto(id, !estaArchivado);
      mostrarToast(estaArchivado ? 'Producto desarchivado ✅' : 'Producto archivado 🗄️', 'success');
    } catch {
      mostrarToast('Error al archivar el producto', 'error');
    }
  }

  function confirmarEliminar(id, nombre) {
    abrirModal(`
      <div class="modal modal--visible">
        <div class="modal__box">
          <div class="modal__header">
            <h3 class="modal__title">🗑️ Eliminar producto</h3>
            <button class="modal__close" onclick="cerrarModal()">✕</button>
          </div>
          <div class="modal__body">
            <p>¿Seguro que querés eliminar <strong>${nombre}</strong>?</p>
            <p style="font-size:var(--text-sm);color:var(--gris-medio)">Esta acción no se puede deshacer.</p>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="cerrarModal()">Cancelar</button>
            <button class="btn btn--primary" style="background:var(--rojo-tuco)"
                    onclick="handleEliminar('${id}')">Eliminar</button>
          </div>
        </div>
      </div>`);
  }

  async function handleEliminar(id) {
    try {
      await eliminarProducto(id);
      cerrarModal();
      mostrarToast('Producto eliminado', 'success');
    } catch {
      mostrarToast('Error al eliminar', 'error');
    }
  }

  // ── Modal Nuevo / Editar producto ─────────────────────────────
  function abrirModalProducto(id = null) {
    const producto = id ? window._productosAdmin.find(p => p.id === id) : null;
    const p = producto || {
      nombre: '', descripcion: '', precio: '', categoria: 'Pollos',
      url_foto: '', tiempo_preparacion_min: '', estado: 'Disponible',
      composicion: [], variantes: []
    };

    abrirModal(`
      <div class="modal modal--visible">
        <div class="modal__box modal__box--lg">
          <div class="modal__header">
            <h3 class="modal__title">${id ? '✏️ Editar producto' : '➕ Nuevo producto'}</h3>
            <button class="modal__close" onclick="cerrarModal()">✕</button>
          </div>
          <div class="modal__body">

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Nombre *</label>
                <input class="form-input" id="mp-nombre" type="text" value="${p.nombre}" required />
              </div>
              <div class="form-group">
                <label class="form-label">Categoría *</label>
                <select class="form-select" id="mp-categoria">
                  ${window._categoriasAdmin.map(c =>
                    `<option ${p.categoria === c.nombre ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Descripción</label>
              <textarea class="form-textarea" id="mp-descripcion">${p.descripcion}</textarea>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Precio (ARS) *</label>
                <input class="form-input" id="mp-precio" type="number" min="0" value="${p.precio}" />
              </div>
              <div class="form-group">
                <label class="form-label">Tiempo prep. (min)</label>
                <input class="form-input" id="mp-tiempo" type="number" min="0" value="${p.tiempo_preparacion_min}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">URL de foto</label>
              <input class="form-input" id="mp-foto" type="url" value="${p.url_foto}" placeholder="https://..." />
            </div>

            <div class="form-group">
              <label class="form-label">Estado</label>
              <select class="form-select" id="mp-estado">
                <option ${p.estado === 'Disponible' ? 'selected' : ''}>Disponible</option>
                <option ${p.estado === 'Agotado' ? 'selected' : ''}>Agotado</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Composición</label>
              <div id="mp-composicion-list" class="tag-list">
                ${(p.composicion || []).map((c, i) => _tagComposicion(c, i)).join('')}
              </div>
              <div class="tag-input-row">
                <input class="form-input" id="mp-comp-input" type="text" placeholder="Ej: Pollo, Papas..." />
                <button class="btn btn--secondary btn--sm" onclick="agregarComposicion()">+ Agregar</button>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Variantes</label>
              <div id="mp-variantes-list" class="variantes-list">
                ${(p.variantes || []).map((v, i) => _rowVariante(v, i)).join('')}
              </div>
              <button class="btn btn--secondary btn--sm" onclick="agregarVariante()">+ Agregar variante</button>
            </div>

          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="cerrarModal()">Cancelar</button>
            <button class="btn btn--primary" onclick="guardarProducto('${id || ''}')">
              ${id ? 'Guardar cambios' : 'Crear producto'}
            </button>
          </div>
        </div>
      </div>`);
  }

  function _tagComposicion(valor, idx) {
    return `<span class="tag" id="comp-${idx}">${valor}
      <button onclick="quitarComposicion(${idx})">✕</button>
    </span>`;
  }

  function _rowVariante(v, idx) {
    return `
      <div class="variante-row" id="var-row-${idx}">
        <input class="form-input" type="text" placeholder="Nombre" value="${v.nombre}"
               id="var-nombre-${idx}" />
        <input class="form-input" type="number" placeholder="Precio extra" value="${v.extra_precio}"
               id="var-precio-${idx}" min="0" />
        <button class="btn btn--sm admin-btn--eliminar" onclick="quitarVariante(${idx})">✕</button>
      </div>`;
  }

  function agregarComposicion() {
    const input = document.getElementById('mp-comp-input');
    const val   = input.value.trim();
    if (!val) return;
    const list = document.getElementById('mp-composicion-list');
    const idx  = list.children.length;
    list.insertAdjacentHTML('beforeend', _tagComposicion(val, idx));
    input.value = '';
  }

  function quitarComposicion(idx) {
    document.getElementById(`comp-${idx}`)?.remove();
  }

  function agregarVariante() {
    const list = document.getElementById('mp-variantes-list');
    const idx  = list.children.length;
    list.insertAdjacentHTML('beforeend', _rowVariante({ nombre: '', extra_precio: 0 }, idx));
  }

  function quitarVariante(idx) {
    document.getElementById(`var-row-${idx}`)?.remove();
  }

  function _leerComposicion() {
    return Array.from(document.querySelectorAll('#mp-composicion-list .tag'))
      .map(el => el.childNodes[0].textContent.trim())
      .filter(Boolean);
  }

  function _leerVariantes() {
    return Array.from(document.querySelectorAll('#mp-variantes-list .variante-row'))
      .map(row => {
        const idx    = row.id.replace('var-row-', '');
        const nombre = document.getElementById(`var-nombre-${idx}`)?.value.trim();
        const precio = parseFloat(document.getElementById(`var-precio-${idx}`)?.value) || 0;
        return nombre ? { nombre, extra_precio: precio } : null;
      })
      .filter(Boolean);
  }

  async function guardarProducto(id) {
    const nombre = document.getElementById('mp-nombre').value.trim();
    const precio = parseFloat(document.getElementById('mp-precio').value);

    if (!nombre || isNaN(precio)) {
      mostrarToast('Nombre y precio son obligatorios', 'warning');
      return;
    }

    const datos = {
      nombre,
      descripcion:            document.getElementById('mp-descripcion').value.trim(),
      precio,
      categoria:              document.getElementById('mp-categoria').value,
      url_foto:               document.getElementById('mp-foto').value.trim(),
      tiempo_preparacion_min: parseInt(document.getElementById('mp-tiempo').value) || 0,
      estado:                 document.getElementById('mp-estado').value,
      composicion:            _leerComposicion(),
      variantes:              _leerVariantes()
    };

    try {
      if (id) {
        await actualizarProducto(id, datos);
        mostrarToast('Producto actualizado ✅', 'success');
      } else {
        await crearProducto(datos);
        mostrarToast('Producto creado ✅', 'success');
      }
      cerrarModal();
    } catch {
      mostrarToast('Error al guardar el producto', 'error');
    }
  }

  window.cargarCategorias          = cargarCategorias;
  window.refrescarUICategorias     = refrescarUICategorias;
  window.agregarCategoria          = agregarCategoria;
  window.eliminarCategoria         = eliminarCategoria;
  window.toggleVisibilidadCategoria = toggleVisibilidadCategoria;
  window.onProductosAdminUpdate    = onProductosAdminUpdate;
  window.filtrarTablaAdmin         = filtrarTablaAdmin;
  window.handleToggleEstado        = handleToggleEstado;
  window.handleArchivar            = handleArchivar;
  window.confirmarEliminar         = confirmarEliminar;
  window.handleEliminar            = handleEliminar;
  window.abrirModalProducto        = abrirModalProducto;
  window.agregarComposicion        = agregarComposicion;
  window.quitarComposicion         = quitarComposicion;
  window.agregarVariante           = agregarVariante;
  window.quitarVariante            = quitarVariante;
  window.guardarProducto           = guardarProducto;

})();
