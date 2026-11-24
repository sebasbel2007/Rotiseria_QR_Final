// js/auth.js
(() => {

  // ── Migración de persistencia LOCAL → SESSION (una sola regla) ──
  // Antes se usaba Persistence.LOCAL: UNA sesión para todas las pestañas
  // (al loguear un rol en una, todas cambiaban). Ahora cada pestaña tiene
  // SU sesión (SESSION).
  // Firebase restaura la sesión VIEJA desde localStorage ANTES de cualquier
  // setPersistence (eso sólo corre al hacer login), así que sin este paso
  // las pestañas nuevas seguirían auto-logueándose con lo viejo.
  // Regla: si esta pestaña no tiene sesión propia (sessionStorage) pero
  // quedó una en localStorage → la borramos. Se loguea una vez por equipo
  // y a partir de ahí queda en sessionStorage (una sesión por pestaña).
  function _migrarPersistenciaVieja() {
    try {
      const propia = Object.keys(sessionStorage).some(k => k.startsWith('firebase:authUser:'));
      if (propia) return;
      const viejas = Object.keys(localStorage).filter(k => k.startsWith('firebase:authUser:'));
      viejas.forEach(k => localStorage.removeItem(k));
    } catch (e) {
      // Sin storage (modo privado/restringido): no hay nada que migrar
    }
  }
  _migrarPersistenciaVieja();

  async function loginEmail(email, password) {
    // Persistencia SESSION: cada pestaña mantiene SU sesión (rol).
    // Cerrar la pestaña = cerrar sesión de ese rol. Así 4 pestañas
    // (cajero / cocina / admin / tv) no se pisan entre sí.
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    return auth.signInWithEmailAndPassword(email, password);
  }

  async function registrarEmail(email, password, nombre) {
    // Persistencia SESSION: cada pestaña mantiene SU sesión (rol).
    // Cerrar la pestaña = cerrar sesión de ese rol. Así 4 pestañas
    // (cajero / cocina / admin / tv) no se pisan entre sí.
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await crearUsuario(cred.user.uid, { email, nombre, rol: 'cliente' });
    return cred;
  }

  async function loginGoogle() {
    // Persistencia SESSION: cada pestaña mantiene SU sesión (rol).
    // Cerrar la pestaña = cerrar sesión de ese rol. Así 4 pestañas
    // (cajero / cocina / admin / tv) no se pisan entre sí.
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    const provider = new firebase.auth.GoogleAuthProvider();
    const cred = await auth.signInWithPopup(provider);
    const existente = await obtenerUsuario(cred.user.uid);
    if (!existente) {
      await crearUsuario(cred.user.uid, {
        email: cred.user.email,
        nombre: cred.user.displayName || 'Cliente',
        rol: 'cliente'
      });
    }
    return cred;
  }

  async function logout() {
    dejarDeEscucharProductos();
    dejarDeEscucharPedidos();
    if (typeof dejarDeEscucharMesas === 'function') dejarDeEscucharMesas();
    if (typeof dejarDeEscucharMesasAdmin === 'function') dejarDeEscucharMesasAdmin();
    if (typeof detenerTimeouts === 'function') detenerTimeouts();
    await auth.signOut();
  }

  window.loginEmail     = loginEmail;
  window.registrarEmail = registrarEmail;
  window.loginGoogle    = loginGoogle;
  window.logout         = logout;

})();
