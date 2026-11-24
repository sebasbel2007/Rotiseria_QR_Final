// js/views/admin.js — Orchestrator
(() => {

  // Estado compartido accesible por admin-menu.js y admin-ventas.js
  window._productosAdmin  = [];
  window._categoriasAdmin = [];

  function renderizarAdmin(seccion = 'menu') {
    document.getElementById('app').innerHTML = `
      <div class="admin-wrap">
        <h1 class="admin-title">⚙️ Panel de Administración</h1>

        <div class="tabs" id="admin-tabs">
          <button class="tab-btn ${seccion === 'menu'       ? 'tab-btn--active' : ''}" data-tab="menu"       onclick="switchAdminTab('menu')">🍽️ Menú</button>
          <button class="tab-btn ${seccion === 'categorias' ? 'tab-btn--active' : ''}" data-tab="categorias" onclick="switchAdminTab('categorias')">🗂️ Categorías</button>
          <button class="tab-btn ${seccion === 'mesas'     ? 'tab-btn--active' : ''}" data-tab="mesas"      onclick="switchAdminTab('mesas')">🪑 Mesas</button>
          <button class="tab-btn ${seccion === 'usuarios'  ? 'tab-btn--active' : ''}" data-tab="usuarios"   onclick="switchAdminTab('usuarios')">👥 Usuarios</button>
          <button class="tab-btn ${seccion === 'ventas'    ? 'tab-btn--active' : ''}" data-tab="ventas"     onclick="switchAdminTab('ventas')">📊 Ventas</button>
          <button class="tab-btn ${seccion === 'herramientas' ? 'tab-btn--active' : ''}" data-tab="herramientas" onclick="switchAdminTab('herramientas')">🛠️ Herramientas</button>
        </div>

        <!-- Tab: Menú -->
        <div class="tab-panel ${seccion === 'menu' ? 'tab-panel--active' : ''}" id="tab-menu">
          <div class="admin-toolbar">
            <div class="admin-toolbar__filtros">
              <select class="form-select admin-toolbar__filtro" id="filtro-categoria"
                      onchange="filtrarTablaAdmin(this.value)">
                <option value="">Todas las categorías</option>
                ${window._categoriasAdmin.map(c => `<option>${c.nombre}</option>`).join('')}
              </select>
              <select class="form-select admin-toolbar__filtro" id="filtro-archivado"
                      onchange="filtrarTablaAdmin()">
                <option value="activos">Solo activos</option>
                <option value="archivados">Solo archivados</option>
                <option value="todos">Todos</option>
              </select>
            </div>
            <button class="btn btn--primary" onclick="abrirModalProducto()">+ Nuevo producto</button>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-table" id="admin-tabla">
              <thead>
                <tr>
                  <th>Producto</th><th>Categoría</th><th>Precio</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody id="admin-tabla-body">
                <tr><td colspan="5" class="admin-table__loading">Cargando...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab: Categorías -->
        <div class="tab-panel ${seccion === 'categorias' ? 'tab-panel--active' : ''}" id="tab-categorias">
          <div class="categorias-wrap">
            <div class="categorias-lista" id="categorias-lista">
              ${_renderizarListaCategoriasFallback()}
            </div>
            <div class="categorias-nueva">
              <div class="form-group">
                <label class="form-label">Nueva categoría</label>
                <div class="tag-input-row">
                  <input class="form-input" id="nueva-categoria-input"
                         type="text" placeholder="Ej: Pastas, Postres..." />
                  <button class="btn btn--primary" onclick="agregarCategoria()">+ Agregar</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab: Mesas -->
        <div class="tab-panel ${seccion === 'mesas' ? 'tab-panel--active' : ''}" id="tab-mesas">
          <div class="admin-mesas-layout">
            <div class="admin-palette" id="admin-palette"></div>
            <div class="admin-mesas-grid-wrap" id="admin-mesas-grid-wrap">
              <div class="admin-mesas-grid" id="admin-mesas-grid"
                   ondrop="_onGridDrop(event)"
                   ondragover="_onGridDragOver(event)"
                   ondragleave="_onGridDragLeave(event)">
                <div class="spinner-container" style="grid-column:1/-1"><div class="spinner"></div></div>
              </div>
              <div class="admin-grid-center" id="admin-grid-center" style="display:none">
                <button onclick="centrarGridMesas()" title="Centrar en mesas">📍 Centrar mesas</button>
              </div>
            </div>
            <div class="admin-mesas-sidebar" id="admin-mesas-lista"></div>
          </div>
        </div>

        <!-- Tab: Usuarios -->
        <div class="tab-panel ${seccion === 'usuarios' ? 'tab-panel--active' : ''}" id="tab-usuarios">
          <div class="admin-toolbar">
            <div></div>
            <button class="btn btn--primary" onclick="abrirModalCrearUsuario()">+ Nuevo usuario</button>
          </div>
          <div id="usuarios-list">
            <div class="spinner-container"><div class="spinner"></div></div>
          </div>
        </div>

        <!-- Tab: Ventas -->
        <div class="tab-panel ${seccion === 'ventas' ? 'tab-panel--active' : ''}" id="tab-ventas">
          <div id="ventas-container">
            <div class="spinner-container"><div class="spinner"></div></div>
          </div>
        </div>

        <!-- Tab: Herramientas -->
        <div class="tab-panel ${seccion === 'herramientas' ? 'tab-panel--active' : ''}" id="tab-herramientas">
          <div class="admin-wrap" style="max-width:600px">
            <div class="ventas-card">
              <h3 class="ventas-card__title">🛠️ Parche de datos</h3>
              <p style="font-size:var(--text-sm);color:var(--gris-medio);margin-bottom:var(--space-3)">
                Agrega el campo <code>archivado:false</code> a productos que no lo tiene.
                Ejecutar solo una vez si hay productos viejos.
              </p>
              <div style="display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap">
                <button class="btn btn--secondary" onclick="ejecutarPatchArchivado()">Ejecutar parche archivado</button>
                <span id="parche-resultado" style="font-size:var(--text-xs);color:var(--verde-listo)"></span>
              </div>
            </div>
          </div>
        </div>

      </div>`;

    escucharTodosProductos(onProductosAdminUpdate);
    cargarCategorias().then(() => refrescarUICategorias());
    if (seccion === 'ventas') cargarResumenVentas();
    if (seccion === 'mesas') iniciarAdminMesas();
    if (seccion === 'usuarios') iniciarAdminUsuarios();
  }

  function switchAdminTab(tab) {
    document.querySelectorAll('#admin-tabs .tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('tab-panel--active'));
    document.querySelector(`#admin-tabs [data-tab="${tab}"]`).classList.add('tab-btn--active');
    document.getElementById(`tab-${tab}`).classList.add('tab-panel--active');
    if (tab === 'ventas') cargarResumenVentas();
    if (tab === 'mesas') iniciarAdminMesas();
    if (tab === 'usuarios') iniciarAdminUsuarios();
  }

  // Fallback mientras cargan las categorías reales
  function _renderizarListaCategoriasFallback() {
    if (!window._categoriasAdmin.length) return `<p class="ventas-empty">Cargando categorías...</p>`;
    return window._categoriasAdmin.map((c, i) => `
      <div class="categoria-item">
        <span class="categoria-item__nombre">${c.nombre}</span>
      </div>`).join('');
  }

  // patchArchivado como acción manual (no automática)
  async function ejecutarPatchArchivado() {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Procesando...';
    try {
      const snap  = await db.collection('productos').get();
      const batch = db.batch();
      let count   = 0;
      snap.docs.forEach(d => {
        if (d.data().archivado === undefined) {
          batch.update(d.ref, { archivado: false });
          count++;
        }
      });
      if (count > 0) await batch.commit();
      document.getElementById('parche-resultado').textContent =
        `✅ ${count} producto${count !== 1 ? 's' : ''} actualizado${count !== 1 ? 's' : ''}.`;
    } catch {
      mostrarToast('Error al ejecutar el parche', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ejecutar parche archivado';
    }
  }

  window.renderizarAdmin       = renderizarAdmin;
  window.switchAdminTab        = switchAdminTab;
  window.ejecutarPatchArchivado = ejecutarPatchArchivado;

})();
