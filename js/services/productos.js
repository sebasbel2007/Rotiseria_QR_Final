// js/services/productos.js
(() => {

  let _unsubProductos = null;

  function escucharProductos(callback) {
    if (_unsubProductos) _unsubProductos();
    _unsubProductos = db.collection('productos')
      .onSnapshot(snap => {
        const productos = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.archivado !== true);
        callback(productos);
      });
  }

  function escucharTodosProductos(callback) {
    if (_unsubProductos) _unsubProductos();
    _unsubProductos = db.collection('productos')
      .onSnapshot(snap => {
        const productos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(productos);
      });
  }

  // Fix cross-layer leak: ya no toca _unsubCategorias de cliente.js
  // El cleanup de ese listener es responsabilidad de cliente.js
  function dejarDeEscucharProductos() {
    if (_unsubProductos) { _unsubProductos(); _unsubProductos = null; }
  }

  async function crearProducto(datos) {
    return await db.collection('productos').add({ ...datos, archivado: false });
  }

  async function actualizarProducto(id, datos) {
    await db.collection('productos').doc(id).update(datos);
  }

  async function eliminarProducto(id) {
    await db.collection('productos').doc(id).delete();
  }

  async function toggleEstadoProducto(id, estadoActual) {
    const nuevo = estadoActual === 'Disponible' ? 'Agotado' : 'Disponible';
    await db.collection('productos').doc(id).update({ estado: nuevo });
  }

  async function archivarProducto(id, archivado) {
    await db.collection('productos').doc(id).update({ archivado });
  }

  window.escucharProductos      = escucharProductos;
  window.escucharTodosProductos = escucharTodosProductos;
  window.dejarDeEscucharProductos = dejarDeEscucharProductos;
  window.crearProducto          = crearProducto;
  window.actualizarProducto     = actualizarProducto;
  window.eliminarProducto       = eliminarProducto;
  window.toggleEstadoProducto   = toggleEstadoProducto;
  window.archivarProducto       = archivarProducto;

})();
