// js/utils.js
(() => {

  // ── Mapeo estado cocina → clase CSS ──────────────────────────
  // Unifica: _claseEstadoCocina (cajero), _claseEstadoCocina2 (admin),
  //          _claseEstadoKds (cocina), _claseEstado (tracker)
  function claseEstado(estado) {
    const mapa = {
      'Pendiente':                'pendiente',
      'En Preparación':           'preparacion',
      'Demorado':                 'demorado',
      'Listo para Retirar/Comer': 'listo',
      'Cancelado':                'cancelado',
      'Entregado':                'entregado',
    };
    return mapa[estado] || 'pendiente';
  }

  // ── Formateo moneda ARS ───────────────────────────────────────
  function formatearPrecio(numero) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(numero);
  }

  // ── SHA-256 (para clave supervisor) ──────────────────────────
  async function hashSHA256(texto) {
    const encoder = new TextEncoder();
    const data    = encoder.encode(texto);
    const buffer  = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ── Traducción errores Firebase Auth → español ───────────────
  function traducirErrorAuth(code) {
    const errores = {
      'auth/user-not-found':        'No existe una cuenta con ese email.',
      'auth/wrong-password':        'Contraseña incorrecta.',
      'auth/email-already-in-use':  'Ese email ya está registrado.',
      'auth/weak-password':         'La contraseña debe tener al menos 6 caracteres.',
      'auth/invalid-email':         'El email no es válido.',
      'auth/popup-closed-by-user':  'Cerraste la ventana de Google antes de completar.',
      'auth/network-request-failed':'Error de red. Verificá tu conexión.',
      'auth/too-many-requests':     'Demasiados intentos. Esperá unos minutos.',
      'auth/invalid-credential':    'Email o contraseña incorrectos.',
    };
    return errores[code] || 'Ocurrió un error. Intentá de nuevo.';
  }

  // ── Helpers de fecha ─────────────────────────────────────────
  function mismoDia(fecha, ref) {
    if (!fecha) return false;
    return fecha.toDateString() === ref.toDateString();
  }

  function mismaSemanana(fecha, ref) {
    if (!fecha) return false;
    const diff = (ref - fecha) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff < 7;
  }

  function mismoMes(fecha, ref) {
    if (!fecha) return false;
    return fecha.getMonth() === ref.getMonth() &&
           fecha.getFullYear() === ref.getFullYear();
  }

  // ── Exponer globales ──────────────────────────────────────────
  window.claseEstado      = claseEstado;
  window.formatearPrecio  = formatearPrecio;
  window.hashSHA256       = hashSHA256;
  window.traducirErrorAuth = traducirErrorAuth;
  window.mismoDia         = mismoDia;
  window.mismaSemanana    = mismaSemanana;
  window.mismoMes         = mismoMes;

})();
