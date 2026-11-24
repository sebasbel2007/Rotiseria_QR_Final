// js/services/mesas.js
(() => {

  let _unsubMesas = null;
  let _unsubMesasAdmin = null;

  // ── Listeners ─────────────────────────────────────────────────

  // Para cajero/TV/cliente: solo mesas activas
  function escucharMesas(callback) {
    if (_unsubMesas) _unsubMesas();
    _unsubMesas = db.collection('mesas')
      .where('activa', '==', true)
      .onSnapshot(snap => {
        const mesas = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            if (a.zona !== b.zona) return a.zona.localeCompare(b.zona);
            return parseInt(a.numero) - parseInt(b.numero);
          });
        callback(mesas);
      });
  }

  function dejarDeEscucharMesas() {
    if (_unsubMesas) { _unsubMesas(); _unsubMesas = null; }
  }

  // Para admin: TODAS las mesas (activas + inactivas)
  function escucharMesasAdmin(callback) {
    if (_unsubMesasAdmin) _unsubMesasAdmin();
    _unsubMesasAdmin = db.collection('mesas')
      .onSnapshot(snap => {
        const mesas = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            if (a.zona !== b.zona) return a.zona.localeCompare(b.zona);
            return parseInt(a.numero) - parseInt(b.numero);
          });
        callback(mesas);
      });
  }

  function dejarDeEscucharMesasAdmin() {
    if (_unsubMesasAdmin) { _unsubMesasAdmin(); _unsubMesasAdmin = null; }
  }

  // ── Lectura ───────────────────────────────────────────────────

  async function obtenerMesa(mesaId) {
    const snap = await db.collection('mesas').doc(mesaId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  async function obtenerTodasMesas() {
    const snap = await db.collection('mesas').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // ── Escritura ─────────────────────────────────────────────────

  async function crearMesa(datos) {
    const capacidad = _calcularCapacidad(datos.tamaño);
    const ref = await db.collection('mesas').add({
      numero:     datos.numero,
      zona:       datos.zona,
      tamaño:     datos.tamaño || '1x1',
      capacidad,
      pos_x:      datos.pos_x ?? 0,
      pos_y:      datos.pos_y ?? 0,
      activa:     true,
      merge_con:  null,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  async function actualizarMesa(mesaId, datos) {
    const update = { ...datos, updated_at: firebase.firestore.FieldValue.serverTimestamp() };
    // Recalcular capacidad si cambió el tamaño
    if (datos.tamaño) update.capacidad = _calcularCapacidad(datos.tamaño);
    await db.collection('mesas').doc(mesaId).update(update);
  }

  async function actualizarPosicionMesa(mesaId, pos_x, pos_y) {
    await db.collection('mesas').doc(mesaId).update({
      pos_x,
      pos_y,
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Número de mesa real (las guardas comparaban por ID de documento y nunca
  // matcheaban, porque en `pedidos.mesa_id` se guarda el NÚMERO).
  async function _numeroDeMesa(mesaId) {
    const snap = await db.collection('mesas').doc(mesaId).get();
    if (!snap.exists) throw new Error('La mesa no existe.');
    return String(snap.data().numero);
  }

  // Estados que significan "la mesa está siendo usada ahora mismo"
  const ESTADOS_ACTIVOS = [
    'Pendiente confirma caja', 'Pendiente', 'En Preparación', 'Demorado', 'Listo para Retirar/Comer'
  ];

  // Soft-delete: verifica que no haya pedidos activos antes de desactivar
  async function desactivarMesa(mesaId) {
    const numero = await _numeroDeMesa(mesaId);
    // Filtramos por mesa_id (número) y evaluamos el estado en memoria:
    // así no dependemos de un índice compuesto ni de comparar por ID de doc.
    const snap = await db.collection('pedidos')
      .where('mesa_id', '==', numero)
      .get();

    const pedidosActivos = snap.docs
      .map(d => d.data())
      .filter(p => ESTADOS_ACTIVOS.includes(p.estado_cocina) && p.entregado !== true);

    if (pedidosActivos.length) {
      throw new Error('La mesa tiene pedidos activos. Cerrá los pedidos antes de desactivarla.');
    }

    await db.collection('mesas').doc(mesaId).update({
      activa:           false,
      scan_session_id:  null,
      scan_at:          null,
      updated_at:       firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  function activarMesa(mesaId) {
    return db.collection('mesas').doc(mesaId).update({
      activa:           true,
      scan_session_id:  null,
      scan_at:          null,
      updated_at:       firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Liberar sesión de escaneo (llamar al cobrar/entregar)
  async function liberarMesa(mesaId) {
    await db.collection('mesas').doc(mesaId).update({
      scan_session_id:  null,
      scan_at:          null,
      updated_at:       firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Eliminar permanente: solo si no tiene pedidos (ninguno, histórico incluido)
  async function eliminarMesa(mesaId) {
    const numero = await _numeroDeMesa(mesaId);
    const pedidos = await db.collection('pedidos')
      .where('mesa_id', '==', numero)
      .limit(1)
      .get();

    if (!pedidos.empty) {
      throw new Error('La mesa tiene pedidos registrados. Solo podés desactivarla.');
    }

    await db.collection('mesas').doc(mesaId).delete();
  }

  // ── Helpers ───────────────────────────────────────────────────

  function _calcularCapacidad(tamaño) {
    const mapa = { '1x1': 4, '1x2': 6, '2x1': 6, '2x2': 8 };
    return mapa[tamaño] || 4;
  }

  // Devuelve las zonas únicas de un array de mesas
  function obtenerZonas(mesas) {
    return [...new Set(mesas.map(m => m.zona))].sort();
  }

  // Siguiente número auto-incremental (max actual + 1)
  function obtenerSiguienteNumero(mesas) {
    const nums = mesas.map(m => parseInt(m.numero, 10)).filter(n => !isNaN(n));
    return nums.length ? Math.max(...nums) + 1 : 1;
  }

  window.escucharMesas          = escucharMesas;
  window.dejarDeEscucharMesas   = dejarDeEscucharMesas;
  window.escucharMesasAdmin     = escucharMesasAdmin;
  window.dejarDeEscucharMesasAdmin = dejarDeEscucharMesasAdmin;
  window.obtenerMesa            = obtenerMesa;
  window.obtenerTodasMesas      = obtenerTodasMesas;
  window.crearMesa              = crearMesa;
  window.actualizarMesa         = actualizarMesa;
  window.actualizarPosicionMesa = actualizarPosicionMesa;
  window.desactivarMesa         = desactivarMesa;
  window.activarMesa            = activarMesa;
  window.eliminarMesa           = eliminarMesa;
  window.liberarMesa            = liberarMesa;
  window.obtenerZonas           = obtenerZonas;
  window.obtenerSiguienteNumero = obtenerSiguienteNumero;

})();
