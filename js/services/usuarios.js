// js/services/usuarios.js
(() => {

  async function obtenerUsuario(uid) {
    const snap = await db.collection('users').doc(uid).get();
    return snap.exists ? snap.data() : null;
  }

  async function crearUsuario(uid, datos) {
    await db.collection('users').doc(uid).set(datos);
  }

  window.obtenerUsuario = obtenerUsuario;
  window.crearUsuario   = crearUsuario;

})();
