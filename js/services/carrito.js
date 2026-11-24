// js/services/carrito.js
(() => {

  let _carrito = [];
  let _onChangeCallback = null;
  let _esMesa = false;

  function onCarritoChange(fn) {
    _onChangeCallback = fn;
  }

  function setModoMesa(esMesa) {
    _esMesa = esMesa;
    if (esMesa) _cargarDesdeStorage();
  }

  function _cargarDesdeStorage() {
    const key = localStorage.getItem('mesa_actual');
    if (!key) return;
    const guardado = localStorage.getItem(`mesa:${key}:cart`);
    if (guardado) {
      try { _carrito = JSON.parse(guardado); } catch { _carrito = []; }
    }
  }

  function _guardarEnStorage() {
    if (!_esMesa) return;
    const key = localStorage.getItem('mesa_actual');
    if (key) localStorage.setItem(`mesa:${key}:cart`, JSON.stringify(_carrito));
  }

  function _notificar() {
    _guardarEnStorage();
    if (_onChangeCallback) _onChangeCallback([..._carrito]);
  }

  function agregarItem(producto, variante = null, notas = '') {
    const key = `${producto.id}_${variante ? variante.nombre : 'base'}_${notas || ''}`;
    const existente = _carrito.find(i => i._key === key);

    if (existente) {
      existente.cantidad += 1;
      existente.subtotal = existente.precio_unitario * existente.cantidad;
    } else {
      const precioBase = producto.precio + (variante ? variante.extra_precio : 0);
      _carrito.push({
        _key: key,
        producto_id: producto.id,
        nombre: producto.nombre,
        variante: variante ? variante.nombre : null,
        precio_unitario: precioBase,
        cantidad: 1,
        subtotal: precioBase,
        notas
      });
    }
    _notificar();
  }

  function quitarItem(key) {
    _carrito = _carrito.filter(i => i._key !== key);
    _notificar();
  }

  function actualizarCantidad(key, cantidad) {
    const item = _carrito.find(i => i._key === key);
    if (!item) return;
    if (cantidad <= 0) { quitarItem(key); return; }
    item.cantidad = cantidad;
    item.subtotal = item.precio_unitario * cantidad;
    _notificar();
  }

  function vaciarCarrito() {
    _carrito = [];
    _notificar();
  }

  function obtenerCarrito() {
    return [..._carrito];
  }

  function obtenerTotal() {
    return _carrito.reduce((acc, i) => acc + i.subtotal, 0);
  }

  function obtenerCantidadTotal() {
    return _carrito.reduce((acc, i) => acc + i.cantidad, 0);
  }

  window.onCarritoChange      = onCarritoChange;
  window.setModoMesa          = setModoMesa;
  window.agregarItem          = agregarItem;
  window.quitarItem           = quitarItem;
  window.actualizarCantidad   = actualizarCantidad;
  window.vaciarCarrito        = vaciarCarrito;
  window.obtenerCarrito       = obtenerCarrito;
  window.obtenerTotal         = obtenerTotal;
  window.obtenerCantidadTotal = obtenerCantidadTotal;

})();
