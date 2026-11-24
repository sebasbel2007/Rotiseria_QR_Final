// js/services/pedidos.js
(() => {

  let _unsubPedidos   = null;
  let _unsubCocina    = null;
  let _unsubHistorial = null;

  async function crearPedido(datos) {
    const ref = await db.collection('pedidos').add({
      ...datos,
      entregado: false,
      fecha_hora_creacion: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  }

  function escucharPedido(pedidoId, callback) {
    return db.collection('pedidos').doc(pedidoId).onSnapshot(snap => {
      if (snap.exists) callback({ id: snap.id, ...snap.data() });
    });
  }

  function escucharPedidosCocina(callback) {
    if (_unsubCocina) _unsubCocina();
    _unsubCocina = db.collection('pedidos')
      .where('estado_cocina', 'in', ['Pendiente', 'En Preparación', 'Demorado'])
      .onSnapshot(snap => {
        const pedidos = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.fecha_hora_creacion?.toMillis?.() || 0) - (b.fecha_hora_creacion?.toMillis?.() || 0));
        callback(pedidos);
      });
  }

  // IMPORTANTE: las dos funciones de abajo DEVUELVEN el unsubscribe.
  // Sin eso, quien las llama guarda `undefined` y no puede apagar el listener
  // (se duplicaban listeners y alertas sonoras en caja).
  function escucharPedidosPendientesPago(callback) {
    if (_unsubPedidos) _unsubPedidos();
    _unsubPedidos = db.collection('pedidos')
      .where('estado_pago', 'in', ['Pendiente', 'Pendiente verificacion MP'])
      .onSnapshot(snap => {
        const pedidos = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.estado_cocina !== 'Cancelado' && p.estado_cocina !== 'Entregado')
          .sort((a, b) => (a.fecha_hora_creacion?.toMillis?.() || 0) - (b.fecha_hora_creacion?.toMillis?.() || 0));
        callback(pedidos);
      });
    return _unsubPedidos;
  }

  function escucharPedidosActivos(callback) {
    if (_unsubHistorial) _unsubHistorial();
    _unsubHistorial = db.collection('pedidos')
      .where('estado_cocina', 'in', ['Pendiente', 'En Preparación', 'Demorado', 'Listo para Retirar/Comer'])
      .onSnapshot(snap => {
        const pedidos = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.entregado !== true)
          .sort((a, b) => (b.fecha_hora_creacion?.toMillis?.() || 0) - (a.fecha_hora_creacion?.toMillis?.() || 0));
        callback(pedidos);
      });
    return _unsubHistorial;
  }

  async function actualizarEstadoCocina(pedidoId, nuevoEstado) {
    await db.collection('pedidos').doc(pedidoId).update({ estado_cocina: nuevoEstado });
  }

  async function cancelarPedido(pedidoId, motivo) {
    await db.collection('pedidos').doc(pedidoId).update({
      estado_cocina: 'Cancelado',
      motivo_cancelacion: motivo
    });
  }

  async function marcarComoPagado(pedidoId, metodoPago) {
    await db.collection('pedidos').doc(pedidoId).update({
      estado_pago: 'Pagado',
      metodo_pago: metodoPago
    });
  }

  async function marcarEntregado(pedidoId) {
    await db.collection('pedidos').doc(pedidoId).update({
      entregado: true,
      estado_cocina: 'Entregado'
    });
  }

  function dejarDeEscucharPedidos() {
    if (_unsubPedidos)   { _unsubPedidos();   _unsubPedidos   = null; }
    if (_unsubCocina)    { _unsubCocina();    _unsubCocina    = null; }
    if (_unsubHistorial) { _unsubHistorial(); _unsubHistorial = null; }
  }

  function dejarDeEscucharPedidosPago() {
    if (_unsubPedidos) { _unsubPedidos(); _unsubPedidos = null; }
  }

  function dejarDeEscucharPedidosActivos() {
    if (_unsubHistorial) { _unsubHistorial(); _unsubHistorial = null; }
  }

  // ── Multi-pedido por mesa ─────────────────────────────────
  // Filtra por `cliente_uid == 'mesa:N'` (y no por `mesa_id`): es la única
  // forma de que Firestore demuestre el acotamiento y las reglas dejen
  // leer a un cliente de mesa sin sesión. El orden se hace en memoria para
  // no depender de un índice compuesto.
  function escucharPedidosMesa(mesaId, callback) {
    return db.collection('pedidos')
      .where('cliente_uid', '==', `mesa:${mesaId}`)
      .onSnapshot(snap => {
        const pedidos = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.estado_cocina !== 'Cancelado' && p.entregado !== true)
          .sort((a, b) => (a.fecha_hora_creacion?.toMillis?.() || 0) - (b.fecha_hora_creacion?.toMillis?.() || 0));
        callback(pedidos);
      });
  }

  async function obtenerPedidosNoPagadosMesa(mesaId) {
    // Mismo criterio que escucharPedidosMesa (ver arriba): filtro por
    // cliente_uid y `estado_pago` se evalúa en memoria.
    const snap = await db.collection('pedidos')
      .where('cliente_uid', '==', `mesa:${mesaId}`)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(p => ['Pendiente', 'Pendiente verificacion MP'].includes(p.estado_pago));
  }

  async function actualizarMetodoPago(pedidoId, nuevoMetodo) {
    await db.collection('pedidos').doc(pedidoId).update({
      metodo_pago: nuevoMetodo,
      estado_pago: nuevoMetodo === 'MercadoPago' ? 'Pendiente verificacion MP' : 'Pendiente'
    });
  }

  async function marcarMesaPagado(mesaId, metodoPago) {
    const snap = await db.collection('pedidos')
      .where('mesa_id', '==', String(mesaId))
      .where('estado_pago', 'in', ['Pendiente', 'Pendiente verificacion MP'])
      .get();
    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, {
        estado_pago: 'Pagado',
        metodo_pago: metodoPago,
        fecha_cobro: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
    return snap.docs.length;
  }

  async function obtenerTodosPedidos() {
    const snap = await db.collection('pedidos').orderBy('fecha_hora_creacion', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  window.crearPedido                  = crearPedido;
  window.escucharPedido               = escucharPedido;
  window.escucharPedidosCocina        = escucharPedidosCocina;
  window.escucharPedidosPendientesPago = escucharPedidosPendientesPago;
  window.escucharPedidosActivos       = escucharPedidosActivos;
  window.escucharPedidosMesa          = escucharPedidosMesa;
  window.obtenerPedidosNoPagadosMesa  = obtenerPedidosNoPagadosMesa;
  window.marcarMesaPagado             = marcarMesaPagado;
  window.actualizarMetodoPago         = actualizarMetodoPago;
  window.actualizarEstadoCocina       = actualizarEstadoCocina;
  window.cancelarPedido               = cancelarPedido;
  window.marcarComoPagado             = marcarComoPagado;
  window.marcarEntregado              = marcarEntregado;
  window.dejarDeEscucharPedidos       = dejarDeEscucharPedidos;
  window.dejarDeEscucharPedidosPago   = dejarDeEscucharPedidosPago;
  window.dejarDeEscucharPedidosActivos = dejarDeEscucharPedidosActivos;
  window.obtenerTodosPedidos          = obtenerTodosPedidos;

})();
