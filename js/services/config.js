// js/services/config.js
(() => {

  const DEFAULTS = {
    supervisor_hash:         'a58249660ce82f26af6adda40da361e155f053800331714b4bddb9bb23ab0fce', // SHA-256("supervisor666")
    timeout_caja_min:        5,
    timeout_sin_pedido_min:  15,
    tv_historial_max:        10,
    recargo_delivery_pct:    15,
  };

  async function cargarConfig() {
    try {
      const snap = await db.collection('config').doc('sistema').get();
      if (snap.exists) {
        window.APP_CONFIG = { ...DEFAULTS, ...snap.data() };
      } else {
        // Primera vez: crear el documento con los defaults
        await db.collection('config').doc('sistema').set(DEFAULTS);
        window.APP_CONFIG = { ...DEFAULTS };
        console.log('✅ config/sistema creado con valores default');
      }
    } catch (e) {
      // Sin conexión o sin permisos: usar defaults en memoria
      window.APP_CONFIG = { ...DEFAULTS };
      console.warn('⚠️ config/sistema no disponible, usando defaults:', e.message);
    }
  }

  window.cargarConfig = cargarConfig;

})();
