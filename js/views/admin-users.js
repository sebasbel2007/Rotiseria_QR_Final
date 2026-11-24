// js/views/admin-users.js
(() => {

  let _usuariosAdmin = [];

  function iniciarAdminUsuarios() {
    _cargarUsuarios();
  }

  async function _cargarUsuarios() {
    const list = document.getElementById('usuarios-list');
    if (!list) return;

    try {
      const snap = await db.collection('users').get();
      _usuariosAdmin = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      _renderizarUsuarios();
    } catch {
      list.innerHTML = '<p class="ventas-empty">Error al cargar usuarios</p>';
    }
  }

  function _renderizarUsuarios() {
    const list = document.getElementById('usuarios-list');
    if (!list) return;

    if (!_usuariosAdmin.length) {
      list.innerHTML = '<p class="ventas-empty">No hay usuarios registrados</p>';
      return;
    }

    const rolIcono = { admin: '👑', cajero: '🧾', cocina: '👨‍🍳', cliente: '👤', tv: '📺' };

    list.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${_usuariosAdmin.map(u => `
              <tr>
                <td><strong>${u.nombre || 'Sin nombre'}</strong></td>
                <td>${u.email || '-'}</td>
                <td>
                  <span class="badge badge--${u.rol === 'admin' ? 'listo' : 'pendiente'}">
                    ${rolIcono[u.rol] || '👤'} ${u.rol}
                  </span>
                </td>
                <td>
                  <span class="badge badge--${u.activo !== false ? 'listo' : 'cancelado'}">
                    ${u.activo !== false ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div style="display:flex;gap:var(--space-2)">
                    <button class="btn btn--secondary btn--sm" onclick="editarUsuarioAdmin('${u.uid}')">
                      ✏️
                    </button>
                    <button class="btn btn--secondary btn--sm" onclick="resetPasswordAdmin('${u.email}')">
                      🔑
                    </button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  window.abrirModalCrearUsuario = () => {
    abrirModal(`
      <div class="modal modal--visible">
        <div class="modal__box">
          <div class="modal__header">
            <h3 class="modal__title">👤 Crear usuario staff</h3>
            <button class="modal__close" onclick="cerrarModal()">✕</button>
          </div>
          <div class="modal__body">
            <div class="form-group">
              <label class="form-label">Nombre</label>
              <input class="form-input" id="user-nombre" type="text" placeholder="Juan Pérez" />
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="form-input" id="user-email" type="email" placeholder="juan@test.com" />
            </div>
            <div class="form-group">
              <label class="form-label">Contraseña temporal</label>
              <input class="form-input" id="user-pass" type="text" value="cambiar123" />
            </div>
            <div class="form-group">
              <label class="form-label">Rol</label>
              <select class="form-select" id="user-rol">
                <option value="cajero">🧾 Cajero</option>
                <option value="cocina">👨‍🍳 Cocina</option>
                <option value="admin">👑 Admin</option>
                <option value="tv">📺 TV</option>
                <option value="cliente">👤 Cliente</option>
              </select>
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="cerrarModal()">Cancelar</button>
            <button class="btn btn--primary" onclick="crearUsuarioAdmin()">Crear usuario</button>
          </div>
        </div>
      </div>`);
  };

  window.crearUsuarioAdmin = async () => {
    const nombre = document.getElementById('user-nombre').value.trim();
    const email  = document.getElementById('user-email').value.trim();
    const pass   = document.getElementById('user-pass').value;
    const rol    = document.getElementById('user-rol').value;

    if (!nombre || !email || !pass) {
      mostrarToast('Completá todos los campos', 'error');
      return;
    }

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
      await crearUsuario(userCredential.uid, { email, nombre, rol, activo: true });
      cerrarModal();
      mostrarToast(`Usuario ${nombre} creado ✅`, 'success');
      _cargarUsuarios();
    } catch (e) {
      mostrarToast(traducirErrorAuth(e.code) || 'Error al crear usuario', 'error');
    }
  };

  window.editarUsuarioAdmin = (uid) => {
    const u = _usuariosAdmin.find(x => x.uid === uid);
    if (!u) return;

    abrirModal(`
      <div class="modal modal--visible">
        <div class="modal__box">
          <div class="modal__header">
            <h3 class="modal__title">✏️ Editar usuario</h3>
            <button class="modal__close" onclick="cerrarModal()">✕</button>
          </div>
          <div class="modal__body">
            <div class="form-group">
              <label class="form-label">Nombre</label>
              <input class="form-input" id="edit-nombre" type="text" value="${u.nombre || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="form-input" type="email" value="${u.email || ''}" disabled />
            </div>
            <div class="form-group">
              <label class="form-label">Rol</label>
              <select class="form-select" id="edit-rol">
                <option value="cajero" ${u.rol === 'cajero' ? 'selected' : ''}>🧾 Cajero</option>
                <option value="cocina" ${u.rol === 'cocina' ? 'selected' : ''}>👨‍🍳 Cocina</option>
                <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>👑 Admin</option>
                <option value="tv" ${u.rol === 'tv' ? 'selected' : ''}>📺 TV</option>
                <option value="cliente" ${u.rol === 'cliente' ? 'selected' : ''}>👤 Cliente</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Estado</label>
              <select class="form-select" id="edit-activo">
                <option value="true" ${u.activo !== false ? 'selected' : ''}>Activo</option>
                <option value="false" ${u.activo === false ? 'selected' : ''}>Inactivo</option>
              </select>
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="cerrarModal()">Cancelar</button>
            <button class="btn btn--primary" onclick="guardarUsuarioAdmin('${uid}')">Guardar</button>
          </div>
        </div>
      </div>`);
  };

  window.guardarUsuarioAdmin = async (uid) => {
    const nombre = document.getElementById('edit-nombre').value.trim();
    const rol    = document.getElementById('edit-rol').value;
    const activo = document.getElementById('edit-activo').value === 'true';

    if (!nombre) {
      mostrarToast('El nombre es requerido', 'error');
      return;
    }

    try {
      await db.collection('users').doc(uid).update({ nombre, rol, activo });
      cerrarModal();
      mostrarToast('Usuario actualizado ✅', 'success');
      _cargarUsuarios();
    } catch {
      mostrarToast('Error al actualizar usuario', 'error');
    }
  };

  window.resetPasswordAdmin = async (email) => {
    if (!confirm(`Enviar email de reset de contraseña a ${email}?`)) return;
    try {
      await auth.sendPasswordResetEmail(email);
      mostrarToast(`Email enviado a ${email} ✅`, 'success');
    } catch (e) {
      mostrarToast(traducirErrorAuth(e.code) || 'Error al enviar email', 'error');
    }
  };

  window.iniciarAdminUsuarios = iniciarAdminUsuarios;
  window.abrirModalCrearUsuario = abrirModalCrearUsuario;

})();
