// js/views/cliente.js
(() => {

  const CATEGORIAS = [
    { nombre: 'Pollos',       icono: '🍗' },
    { nombre: 'Milanesas',    icono: '🥩' },
    { nombre: 'Guarniciones', icono: '🍟' },
    { nombre: 'Empanadas',    icono: '🥟' },
    { nombre: 'Bebidas',      icono: '🥤' },
  ];

  const PASOS_ESTADO = [
    { key: 'Pendiente confirma caja', label: '🕐 Confirmando tu pedido...', icono: '⏳' },
    { key: 'Pendiente', label: '📋 Pedido enviado a cocina', icono: '📋' },
    { key: 'En Preparación', label: '👨‍🍳 Cocinando con cariño', icono: '👨‍🍳' },
    { key: 'Demorado', label: '⏳ Un poquito más de paciencia...', icono: '⚠️' },
    { key: 'Listo para Retirar/Comer', label: '🎉 ¡Tu pedido está listo!', icono: '✅' },
    { key: 'Entregado', label: '🍽️ En tu mesa', icono: '📦' },
  ];

  let _unsubCategorias   = null;
  let _unsubProductos    = null;
  let _unsubPedidoMesa   = null;
  let _categoriasVisibles = [];
  let _esMesa = false;
  let _numeroMesa = null;
  let _pedidoEsperando = false;
  let _metodoPagoSeleccionado = 'Efectivo';
  let _nombreCliente = '';
  let _notasGenerales = '';
  let _dashboardActivo = false;
  let _mesaConfirmada = false;
  let _productosMap = new Map();

  // ── Máquina de estados de la vista de mesa (Fase 1 + 4) ──────
  // ''             → catálogo (menú)
  // 'dashboard'    → progreso del pedido / botones de pago (en vivo)
  // 'cierre'       → pantalla "✅ Pago confirmado"
  // 'cierre-pregunta' → cierre + "¿Querés hacer otro pedido?"
  // 'despedida'    → el cliente dijo "no, sigo" (mesa liberada)
  let _faseActual = '';
  let _resumenVisible = true;   // estado del toggle 👁️ del dashboard
  let _ultimosPedidos = [];     // último snapshot con datos (para el cierre)
  const _VENTANA_PAGO_MS = 45 * 60 * 1000;   // 45 min de "ventana de pago"

  function _esPWAStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  function _mostrarSelectorMesaPWA() {
    const app = document.getElementById('app');
    if (!app) return;

    // Obtener mesas activas de Firestore
    db.collection('mesas')
      .where('activa', '==', true)
      .get()
      .then(snap => {
        if (snap.empty) {
          app.innerHTML = `
            <div class="cliente-mesa-wrap" style="display:flex;align-items:center;justify-content:center;min-height:60vh">
              <div style="text-align:center;padding:var(--space-6)">
                <div style="font-size:64px;margin-bottom:var(--space-4)">🚫</div>
                <h2 style="color:var(--gris-carbon);margin-bottom:var(--space-2)">Sin mesas disponibles</h2>
                <p style="color:var(--gris-medio);margin-bottom:var(--space-4)">No hay mesas activas en este momento</p>
              </div>`;
          return;
        }

        const mesas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => parseInt(a.numero) - parseInt(b.numero));

        app.innerHTML = `
          <div class="cliente-mesa-wrap">
            <div class="pwa-mesa-selector">
              <div class="pwa-mesa-header">
                <h2>🍽️ Seleccioná tu mesa</h2>
                <p class="pwa-mesa-subtitle">Tocá el número de mesa donde estás sentado</p>
              </div>
              <div class="pwa-mesa-grid" id="pwa-mesa-grid">
                ${mesas.map(m => `
                  <button class="pwa-mesa-btn" data-mesa="${m.numero}" onclick="_seleccionarMesaPWA(${m.numero})">
                    <span class="pwa-mesa-num">Mesa ${m.numero}</span>
                    <span class="pwa-mesa-zona">${m.zona || ''}</span>
                  </button>
                `).join('')}
              </div>
            </div>`;
      })
      .catch(err => {
        console.error('Error cargando mesas:', err);
        const app = document.getElementById('app');
        if (app) {
          app.innerHTML = `
            <div class="cliente-mesa-wrap" style="display:flex;align-items:center;justify-content:center;min-height:60vh">
              <div style="text-align:center;padding:var(--space-6)">
                <div style="font-size:64px;margin-bottom:var(--space-4)">⚠️</div>
                <h2 style="color:var(--gris-carbon);margin-bottom:var(--space-2)">Error al cargar mesas</h2>
                <button class="btn btn--primary" onclick="renderizarCliente()">Reintentar</button>
              </div>`;
        }
      });
  }

  window._seleccionarMesaPWA = (mesaNum) => {
    _mesaConfirmada = true;
    _esMesa = true;
    _numeroMesa = mesaNum;
    localStorage.setItem('mesa_actual', mesaNum);
    renderizarCliente();
  };

  function renderizarCliente() {
    // Siempre obtener params de la URL (necesario para calcular _numeroMesa)
    const params = new URLSearchParams(location.search);

    // Volvemos al catálogo: reseteamos la fase para que el próximo snapshot
    // del listener pueda volver a pintar dashboard / cierre si corresponde.
    _faseActual = '';

    // Si ya confirmó mesa en PWA, no volver a preguntar
    if (_mesaConfirmada) {
      _esMesa = true;
    } else {
      _esMesa = params.has('mesa');
    }

    if (_esMesa) {
      const paramMesa = params.get('mesa');
      if (paramMesa !== null) {
        _numeroMesa = parseInt(paramMesa, 10);
      } else if (_numeroMesa === null || isNaN(_numeroMesa)) {
        // PWA standalone sin ?mesa= en la URL (selector de mesa):
        // usamos la mesa elegida o la guardada, si no quedaba en NaN
        // y el listener de pedidos ni siquiera se suscribía.
        const guardada = localStorage.getItem('mesa_actual');
        _numeroMesa = guardada ? parseInt(guardada, 10) : null;
      }
    } else {
      _numeroMesa = null;
    }

    // PWA standalone sin parámetro mesa → mostrar selector
    if (_esMesa && !_mesaConfirmada && _esPWAStandalone() && !params.has('mesa')) {
      _mostrarSelectorMesaPWA();
      return;
    }

    if (_esMesa) {
      setModoMesa(true);
      document.getElementById('app').innerHTML = `
        <div class="cliente-mesa-wrap">
          <div class="cliente-mesa-header">
            <span class="cliente-mesa-num">🍽️ Mesa ${_numeroMesa}</span>
          </div>
          <div id="mesa-pedido-status"></div>
          <div id="menu-container"></div>
          <div class="bottom-sheet" id="bottom-sheet">
            <div class="bottom-sheet__backdrop" onclick="cerrarBottomSheet()"></div>
            <div class="bottom-sheet__content">
              <div class="bottom-sheet__handle"></div>
              <div class="bottom-sheet__header">
                <h3>Tu Pedido</h3>
                <button class="bottom-sheet__close" onclick="cerrarBottomSheet()">✕</button>
              </div>
              <div class="bottom-sheet__body" id="mesa-cart-items"></div>
              <div class="bottom-sheet__footer" id="mesa-cart-footer"></div>
            </div>
          </div>
        </div>`;
      _escucharPedidoMesa();
    } else {
      document.getElementById('app').innerHTML = `
        <div class="cliente-wrap">
          <div class="cliente-hero">
            <h1 class="cliente-hero__title">🍗 Nuestro Menú</h1>
            <p class="cliente-hero__sub">Pedí desde acá y retirá en caja o comé en el local</p>
          </div>
          <div id="menu-container"></div>
        </div>`;
    }

    if (_unsubCategorias) _unsubCategorias();
    _unsubCategorias = db.collection('config').doc('categorias')
      .onSnapshot(snap => {
        if (snap.exists) {
          const lista = (snap.data().lista || []).filter(c => c.visible).map(c => c.nombre);
          _categoriasVisibles = lista.length ? lista : CATEGORIAS.map(c => c.nombre);
        } else {
          _categoriasVisibles = CATEGORIAS.map(c => c.nombre);
        }
        escucharProductos(_onProductosUpdate);
      }, () => {
        _categoriasVisibles = CATEGORIAS.map(c => c.nombre);
        escucharProductos(_onProductosUpdate);
      });

    onCarritoChange(_renderizarCarrito);
    _renderizarCarrito(obtenerCarrito());
  }

  // Sólo los listeners del CATÁLOGO. Se usa al mostrar el dashboard:
  // NO hay que matar el listener del pedido, si no la pantalla se congela
  // (era el bug principal: el callback se desuscribía a sí mismo).
  function _detenerCatalogo() {
    if (_unsubCategorias) { _unsubCategorias(); _unsubCategorias = null; }
    if (_unsubProductos) { _unsubProductos(); _unsubProductos = null; }
  }

  function _cleanupCliente() {
    _detenerCatalogo();
    if (_unsubPedidoMesa) { _unsubPedidoMesa(); _unsubPedidoMesa = null; }
    _dashboardActivo = false;
    _faseActual = '';
  }

  // ── "Pago reciente" ───────────────────────────────────────────
  // Se activa cuando vemos un pedido pagado hace < 45 min y se limpia
  // cuando el cliente arranca otro pedido o dice "no, sigo". Decide
  // entre: pantalla de cierre / pregunta de ronda 2 / catálogo.
  function _clavePago() {
    return _numeroMesa ? `mesa:${_numeroMesa}:pagado_hasta` : null;
  }
  function _activarPagoReciente() {
    const k = _clavePago();
    if (k) localStorage.setItem(k, String(Date.now() + _VENTANA_PAGO_MS));
  }
  function _hayPagoReciente() {
    const k = _clavePago();
    if (!k) return false;
    const v = parseInt(localStorage.getItem(k) || '0', 10);
    return v > 0 && Date.now() < v;
  }
  function _limpiarPagoReciente() {
    const k = _clavePago();
    if (k) localStorage.removeItem(k);
  }
  function _tsPedido(p) {
    return p.fecha_cobro?.toMillis?.() || p.fecha_hora_creacion?.toMillis?.() || 0;
  }
  function _pagoReciente(p) {
    const ts = _tsPedido(p);
    return ts > 0 && (Date.now() - ts) < _VENTANA_PAGO_MS;
  }

  function _escucharPedidoMesa() {
    if (!_numeroMesa) return;
    if (_unsubPedidoMesa) _unsubPedidoMesa();

    _unsubPedidoMesa = escucharPedidosMesa(_numeroMesa, (pedidos) => {
      // Guardamos el último snapshot con datos: cuando caja "limpia" la mesa
      // los pedidos desaparecen del listener y lo necesitamos para el resumen
      // de la pantalla de cierre.
      if (pedidos.length) _ultimosPedidos = pedidos;

      const pendientes = pedidos.filter(p => p.estado_pago !== 'Pagado');
      const pagados    = pedidos.filter(p => p.estado_pago === 'Pagado');

      // ¿Se registró un pago reciente en esta mesa? → abrimos la ventana de cierre
      if (pagados.some(_pagoReciente)) _activarPagoReciente();

      // ── 1 y 2) Hay algo pendiente → DASHBOARD EN VIVO ──────────
      //   • sin entregar al mozo   → progreso de cocina
      //   • entregado y sin pagar  → botones de pago
      if (pendientes.length) {
        // Sólo bloquea el botón "Enviar" si hay algo aún en cocina.
        // Entregado y sin pagar → el cliente puede pedir de nuevo (como antes).
        _pedidoEsperando = pendientes.some(p => !p.entregado_mozo);
        _detenerCatalogo();          // NO toca _unsubPedidoMesa
        _dashboardActivo = true;
        _faseActual = 'dashboard';
        _renderDashboardEspera(pedidos);
        return;
      }

      // ── 3) Todo pagado → PANTALLA DE CIERRE ────────────────────
      // Se queda ahí hasta que caja libere (limpie) la mesa. Si la mesa ya
      // quedó sin pedidos, además preguntamos si quiere otro pedido.
      if (_hayPagoReciente()) {
        _pedidoEsperando = false;
        _detenerCatalogo();
        _dashboardActivo = true;
        _renderCierrePago(_ultimosPedidos, pedidos.length === 0);
        return;
      }

      // ── 4/5) Nada activo ni por cobrar → CATÁLOGO ──────────────
      _pedidoEsperando = false;
      if (_faseActual === 'despedida') return;   // el cliente dijo "no, gracias"
      if (_dashboardActivo) {
        _cleanupCliente();
        _ultimosPedidos = [];
        setTimeout(() => { renderizarCliente(); }, 100);
      } else {
        const statusEl = document.getElementById('mesa-pedido-status');
        if (statusEl) statusEl.innerHTML = '';
      }
    });
  }

  // Entrada desde el router: hay un pedido activo para esta mesa.
  // Inicializa el contexto (si no, salía "Mesa null"), engancha el listener
  // ANTES de pintar y recién ahí renderiza el dashboard.
  function _abrirDashboardMesa(numeroMesa, pedidos) {
    _esMesa = true;
    _numeroMesa = numeroMesa;
    _mesaConfirmada = true;
    _dashboardActivo = true;
    _faseActual = 'dashboard';
    _detenerCatalogo();
    if (pedidos && pedidos.length) _ultimosPedidos = pedidos;
    _escucharPedidoMesa();                       // se suscribe primero

    const todosPagados = !!(pedidos && pedidos.length) &&
      pedidos.every(p => p.estado_pago === 'Pagado');

    if (pedidos && pedidos.length && !todosPagados) {
      _renderDashboardEspera(pedidos);           // pinta con los datos traídos
    } else if (!pedidos || !pedidos.length) {
      renderizarCliente();
    }
    // Si todo está pagado NO pintamos nada acá: el primer snapshot del
    // listener decide (pantalla de cierre / catálogo) con la fecha de cobro.
  }

  function _renderDashboardEspera(pedidos) {
    _dashboardActivo = true;
    _faseActual = 'dashboard';
    const app = document.getElementById('app');
    if (!app) return;

    // El progreso y los botones de pago los mandan SÓLO los pedidos pendientes
    const pendientes = pedidos.filter(p => p.estado_pago !== 'Pagado');
    const base = pendientes.length ? pendientes : pedidos;

    // Tomar el pedido más reciente (último creado)
    const pedido = base[base.length - 1];
    if (!pedido) return;

    const estadoActual = pedido.estado_cocina;
    let idxActual = PASOS_ESTADO.findIndex(p => p.key === estadoActual);
    let pasosVisibles;
    if (idxActual >= 0) {
      pasosVisibles = PASOS_ESTADO.slice(0, idxActual + 1);
    } else {
      // Estado no contemplado (p. ej. 'Enviado' de delivery): sin este guard
      // findIndex devolvía -1 y los pasos salían vacíos.
      pasosVisibles = [{ key: estadoActual, label: estadoActual, icono: '📋' }];
      idxActual = 0;
    }

    // Entregado al mozo y todavía sin pagar → botones de pago
    const entregados = base.filter(p => p.entregado_mozo === true && p.estado_pago !== 'Pagado');
    const entregado = entregados.length ? entregados[entregados.length - 1] : null;

    let botonesPagoHTML = '';
    if (entregado) {
      if (entregado.metodo_pago === 'MercadoPago') {
        botonesPagoHTML = `
          <div class="dashboard-pago-botones">
            <button class="btn btn--primary btn--full btn--lg" onclick="pagarPedidoMP('${entregado.id}', ${entregado.total})">
              💳 Pagar con MercadoPago
            </button>
            <button class="btn btn--secondary btn--full" onclick="_confirmarFallbackEfectivo('${entregado.id}')">
              💵 Pagar en caja
            </button>
            <p class="dashboard-pago__ayuda">Si hubo error con MP, usá "Pagar en caja" y acercate a pagar personalmente</p>
          </div>`;
      } else {
        botonesPagoHTML = `
          <div class="dashboard-pago-efectivo">
            <div class="dashboard-pago__icon">🍽️</div>
            <h3>¡Tu pedido está listo!</h3>
            <p class="dashboard-pago__mensaje">La comida ya va para tu mesa. ¡Buen provecho! 🍗</p>
            <p class="dashboard-pago__recordatorio">Recuerda pagar en caja después de comer.</p>
            <div class="dashboard-resumen">
              ${_renderResumenPedido(entregado)}
            </div>
          </div>`;
      }
    }

    const resumenDisplay = _resumenVisible ? 'block' : 'none';
    const toggleIcono = _resumenVisible ? '👁️' : '🙈';

    app.innerHTML = `
      <div class="cliente-mesa-wrap">
        <div class="cliente-mesa-header">
          <span class="cliente-mesa-num">🍽️ Mesa ${_numeroMesa}</span>
        </div>
        <div class="dashboard-espera">
          <div class="dashboard-header">
            <div class="dashboard-estado">
              <span class="dashboard-estado__badge badge badge--${_claseEstado(estadoActual)}">${estadoActual}</span>
              <span class="dashboard-estado__mesa">Mesa ${_numeroMesa}</span>
            </div>
            <button class="dashboard-toggle" onclick="_toggleResumenPedido(this)" aria-label="Mostrar/ocultar pedido">
              <span>${toggleIcono}</span>
            </button>
          </div>
          <div class="dashboard-progreso">
            ${pasosVisibles.map((paso, i) => `
              <div class="dashboard-paso ${i === idxActual ? 'dashboard-paso--actual' : ''} ${i < idxActual ? 'dashboard-paso--completado' : ''}">
                <div class="dashboard-paso__icono">${paso.icono}</div>
                <div class="dashboard-paso__label">${paso.label}</div>
                <div class="dashboard-paso__barra" style="${i < pasosVisibles.length - 1 ? 'width:100%' : 'display:none'}"></div>
              </div>
            `).join('')}
          </div>
          <div class="dashboard-pedido" id="dashboard-pedido-resumen" style="display:${resumenDisplay}">
            ${_renderResumenPedido(pedido)}
          </div>
          <div class="dashboard-pago" id="dashboard-pago-botones">
            ${botonesPagoHTML}
          </div>
          <div class="dashboard-footer">
            ${entregado
              ? '<p>🍽️ ¡Disfrutá tu comida! Paga en caja cuando termines.</p>'
              : '<p>Tu pedido está en proceso... Te avisamos cuando esté listo 🍗</p>'
            }
          </div>
        </div>
      </div>`;

    // Expone función global para toggle (recuerda el estado entre re-renders)
    window._toggleResumenPedido = (btn) => {
      const resumen = document.getElementById('dashboard-pedido-resumen');
      if (!resumen) return;
      _resumenVisible = resumen.style.display === 'none';
      resumen.style.display = _resumenVisible ? 'block' : 'none';
      if (btn) btn.innerHTML = _resumenVisible ? '<span>👁️</span>' : '<span>🙈</span>';
    };
  }

  // ── Pantalla de cierre post-pago (+ pregunta de ronda 2) ─────
  // conPregunta = caja ya liberó/limpió la mesa → toca preguntar si sigue.
  function _renderCierrePago(listaPedidos, conPregunta) {
    const fase = conPregunta ? 'cierre-pregunta' : 'cierre';
    if (_faseActual === fase) return;   // ya está en pantalla: no re-renderizar
    _faseActual = fase;

    const app = document.getElementById('app');
    if (!app) return;

    const pagados = (listaPedidos || []).filter(p => p.estado_pago === 'Pagado');
    const ultimo = pagados[pagados.length - 1] || null;
    const totalPagado = pagados.reduce((s, p) => s + (p.total || 0), 0);

    const resumenHTML = ultimo ? `
      <div class="pago-cierre__resumen">
        <div class="pago-cierre__linea">
          <span>Pedido #${ultimo.id.slice(-6).toUpperCase()}</span>
          <strong>${formatearPrecio(ultimo.total)}</strong>
        </div>
        <div class="dashboard-items">
          ${(ultimo.items || []).map(i => `
            <div class="dashboard-item">
              <span>${i.cantidad}× ${i.nombre}${i.variante ? ` (${i.variante})` : ''}</span>
              <span>${formatearPrecio(i.subtotal)}</span>
            </div>`).join('')}
        </div>
        ${pagados.length > 1 ? `
          <div class="pago-cierre__linea pago-cierre__linea--total">
            <span>${pagados.length} pedidos pagados</span>
            <strong>${formatearPrecio(totalPagado)}</strong>
          </div>` : ''}
      </div>` : '';

    app.innerHTML = `
      <div class="cliente-mesa-wrap">
        <div class="cliente-mesa-header">
          <span class="cliente-mesa-num">🍽️ Mesa ${_numeroMesa}</span>
        </div>
        <div class="pago-cierre ${conPregunta ? 'pago-cierre--pregunta' : ''}">
          <div class="pago-cierre__icon">✅</div>
          <h2 class="pago-cierre__titulo">Pago confirmado</h2>
          <p class="pago-cierre__sub">Gracias por tu visita 🙌<br>Quedó registrado en caja.</p>
          ${resumenHTML}
          ${conPregunta ? `
            <div class="pago-cierre__pregunta">
              <h3>¿Querés hacer otro pedido?</h3>
              <p>Seguís en la Mesa ${_numeroMesa}: armás uno nuevo y lo mandás igual que antes.</p>
              <button class="btn btn--primary btn--full btn--lg" onclick="hacerOtroPedido()">🍽️ Sí, pedir de nuevo</button>
              <button class="btn btn--ghost btn--full" onclick="_noSeguirMesa()">No, gracias — libero la mesa</button>
            </div>`
            : `
            <p class="pago-cierre__espera">La mesa sigue tuya hasta que el personal la libere.</p>
            <button class="btn btn--ghost btn--full btn--sm" onclick="hacerOtroPedido()">🍽️ Hacer otro pedido</button>`}
        </div>
      </div>`;
  }

  // ── Ronda 2: mismo mesa, flujo desde cero ───────────────────
  function _otroPedidoMesa() {
    if (typeof window._limpiarTracker === 'function') window._limpiarTracker();
    _limpiarPagoReciente();
    _ultimosPedidos = [];
    _dashboardActivo = false;
    _faseActual = '';
    _pedidoEsperando = false;
    vaciarCarrito();
    if (_numeroMesa) localStorage.removeItem(`mesa:${_numeroMesa}:cart`);
    // Caja liberó el candado de escaneo al cobrar/limpiar → lo volvemos a tomar
    if (typeof window._reclamarMesa === 'function') window._reclamarMesa(_numeroMesa);
    renderizarCliente();
  }

  // ── "No, gracias": la mesa no queda ocupada ──────────────────
  async function _noSeguirMesa() {
    if (typeof window._limpiarTracker === 'function') window._limpiarTracker();
    _limpiarPagoReciente();
    _ultimosPedidos = [];
    _dashboardActivo = false;
    _faseActual = 'despedida';
    _pedidoEsperando = false;
    if (_numeroMesa) localStorage.removeItem(`mesa:${_numeroMesa}:cart`);
    if (_unsubPedidoMesa) { _unsubPedidoMesa(); _unsubPedidoMesa = null; }
    if (typeof window._liberarMesaCliente === 'function') await window._liberarMesaCliente(_numeroMesa);

    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = `
      <div class="cliente-mesa-wrap">
        <div class="cliente-mesa-header">
          <span class="cliente-mesa-num">🍽️ Mesa ${_numeroMesa}</span>
        </div>
        <div class="pago-cierre">
          <div class="pago-cierre__icon">👋</div>
          <h2 class="pago-cierre__titulo">¡Gracias por tu visita!</h2>
          <p class="pago-cierre__sub">La mesa queda libre.<br>Cuando vuelvas, escaneá el QR de nuevo.</p>
          <button class="btn btn--primary btn--full" onclick="location.reload()">🔄 Escanear de nuevo</button>
        </div>
      </div>`;
  }

  function _claseEstado(estado) {
    const mapa = {
      'Pendiente confirma caja': 'pendiente',
      'Pendiente': 'pendiente',
      'En Preparación': 'preparacion',
      'Demorado': 'demorado',
      'Listo para Retirar/Comer': 'listo',
      'Entregado': 'listo',
      'Cancelado': 'cancelado',
    };
    return mapa[estado] || 'pendiente';
  }

  function _renderResumenPedido(pedido) {
    if (!pedido) return '';
    const itemsHTML = (pedido.items || []).map(i => `
      <div class="dashboard-item">
        <span>${i.cantidad}× ${i.nombre}${i.variante ? ` (${i.variante})` : ''}${i.notas ? ` <em>— ${i.notas}</em>` : ''}</span>
        <span>${formatearPrecio(i.subtotal)}</span>
      </div>`).join('');
    return `
      <div class="dashboard-resumen-header">
        <span>Pedido #${pedido.id.slice(-6).toUpperCase()}</span>
        ${pedido.notas_cliente ? `<p class="dashboard-notas">📝 ${pedido.notas_cliente}</p>` : ''}
      </div>
      <div class="dashboard-items">${itemsHTML}</div>
      <div class="dashboard-total">
        <span>Total</span>
        <strong>${formatearPrecio(pedido.total)}</strong>
      </div>`;
  }

  function _confirmarFallbackEfectivo(pedidoId) {
    abrirModal(`
      <div class="modal modal--visible">
        <div class="modal__box">
          <div class="modal__header">
            <h3 class="modal__title">¿Confirmás pagar en efectivo en caja?</h3>
            <button class="modal__close" onclick="cerrarModal()">✕</button>
          </div>
          <div class="modal__body">
            <p>Se deshabilitará el pago con MercadoPago para este pedido.</p>
            <p>Deberás abonar en caja personalmente.</p>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" onclick="cerrarModal()">No, usar MercadoPago</button>
            <button class="btn btn--primary" onclick="_ejecutarFallbackEfectivo('${pedidoId}')">Sí, pagar en caja</button>
          </div>
        </div>
      </div>
    `);
  }

  window._ejecutarFallbackEfectivo = async (pedidoId) => {
    try {
      await actualizarMetodoPago(pedidoId, 'Efectivo');
      cerrarModal();
      // El listener de la mesa (que ya queda vivo, Fase 1) re-renderiza solo
      // con el nuevo método de pago → se muestra el mensaje "pagá en caja".
      mostrarToast('Cambiado a efectivo 💵 Acercate a caja cuando termines', 'success');
    } catch (e) {
      console.error('Error fallback:', e);
      mostrarToast('Error al cambiar método de pago', 'error');
    }
  };

  window.pagarPedidoMP = async (pedidoId, total) => {
    try {
      const res = await fetch('/api/mp-preference-for-pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido_id: pedidoId })
      });
      if (!res.ok) throw new Error('Error creando preferencia');
      const data = await res.json();
      mostrarToast('Redirigiendo a MercadoPago...', 'success');
      window.location.href = data.init_point;
    } catch (err) {
      console.error('Error MP:', err);
      mostrarToast('Error al conectar con MercadoPago', 'error');
    }
  };

  function _onProductosUpdate(productos) {
    // Poblar Map para lookup rápido por ID en event delegation
    _productosMap.clear();
    productos.forEach(p => _productosMap.set(p.id, p));

    const container = document.getElementById('menu-container');
    if (!container) {
      dejarDeEscucharProductos();
      if (_unsubCategorias) { _unsubCategorias(); _unsubCategorias = null; }
      return;
    }

    const catsConIcono = _categoriasVisibles.map(nombre => {
      const conocida = CATEGORIAS.find(c => c.nombre === nombre);
      return { nombre, icono: conocida ? conocida.icono : '🍽️' };
    });

    const porCategoria = {};
    catsConIcono.forEach(c => { porCategoria[c.nombre] = []; });
    productos.forEach(p => {
      if (porCategoria[p.categoria] !== undefined) porCategoria[p.categoria].push(p);
    });

    container.innerHTML = catsConIcono.map(cat => {
      const items = porCategoria[cat.nombre];
      if (!items.length) return '';
      return `
        <div class="accordion" id="acc-${cat.nombre}">
          <div class="accordion__header" onclick="toggleAcordeon('acc-${cat.nombre}')">
            <span class="accordion__title">
              <span class="accordion__icon">${cat.icono}</span>
              ${cat.nombre}
              <span class="badge badge--count">${items.length}</span>
            </span>
            <span class="accordion__arrow">▼</span>
          </div>
          <div class="accordion__body">
            <div class="accordion__grid">
              ${items.map(p => _cardProducto(p)).join('')}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function _cardProducto(p) {
    const agotado = p.estado === 'Agotado';
    const variantesHTML = p.variantes && p.variantes.length
      ? `<select class="form-select form-select--sm" id="var-${p.id}">
           <option value="">Sin variante</option>
           ${p.variantes.map((v, i) => `<option value="${i}">${v.nombre} (+${formatearPrecio(v.extra_precio)})</option>`).join('')}
         </select>`
      : '';

    return `
      <div class="product-card ${agotado ? 'product-card--agotado' : ''}">
        <div class="product-card__img-wrap">
          <img class="product-card__img"
               src="${p.url_foto || 'https://placehold.co/400x300/ECE9E1/2C3E50?text=SYM'}"
               alt="${p.nombre}"
               onerror="this.src='https://placehold.co/400x300/ECE9E1/2C3E50?text=SYM'" />
          ${agotado ? `<span class="badge badge--agotado product-card__badge">Agotado</span>` : ''}
        </div>
        <div class="product-card__body">
          <p class="product-card__name">${p.nombre}</p>
          <p class="product-card__desc">${p.descripcion || ''}</p>
          ${variantesHTML}
          <input class="form-input form-input--sm product-card__notas" type="text"
                 id="notas-${p.id}" placeholder="Notas (ej: sin cebolla)"
                 style="font-size:var(--text-xs);padding:4px 8px;margin-top:4px" />
          <div class="product-card__footer">
            <span class="product-card__price">${formatearPrecio(p.precio)}</span>
            <button class="btn btn--primary btn--sm agregar-item"
                    data-producto-id="${p.id}"
                    ${agotado ? 'disabled' : ''}>
              + Agregar
            </button>
          </div>
        </div>
      </div>`;
  }

  function handleAgregarItem(event) {
    const btn = event.currentTarget;
    const productoId = btn.dataset.productoId;
    const producto = _productosMap.get(productoId);
    if (!producto) {
      console.warn('Producto no encontrado:', productoId);
      return;
    }
    const selectEl = document.getElementById(`var-${producto.id}`);
    let variante = null;
    if (selectEl && selectEl.value !== '') {
      variante = producto.variantes[parseInt(selectEl.value)];
    }
    const notasEl = document.getElementById(`notas-${producto.id}`);
    const notas = notasEl ? notasEl.value.trim() : '';
    agregarItem(producto, variante, notas);
    mostrarToast(`${producto.nombre} agregado al carrito 🛒`, 'success');
    if (notasEl) notasEl.value = '';
    if (_esMesa) {
      const badge = document.getElementById('mesa-cart-badge');
      if (badge) badge.textContent = obtenerCantidadTotal();
    }
  }

  function toggleAcordeon(id) {
    document.getElementById(id).classList.toggle('accordion--open');
  }

  // ── Bottom Sheet (modo mesa) ──────────────────────────────────
  window.abrirBottomSheet = () => {
    const sheet = document.getElementById('bottom-sheet');
    if (sheet) sheet.classList.add('bottom-sheet--open');
  };

  window.cerrarBottomSheet = () => {
    const sheet = document.getElementById('bottom-sheet');
    if (sheet) sheet.classList.remove('bottom-sheet--open');
  };

  // ── Carrito ───────────────────────────────────────────────────
  function _renderizarCarrito(items) {
    if (_esMesa) {
      _renderizarCarritoMesa(items);
    } else {
      _renderizarCarritoSidebar(items);
    }
  }

  function _renderizarCarritoMesa(items) {
    const body   = document.getElementById('mesa-cart-items');
    const footer = document.getElementById('mesa-cart-footer');
    const badge  = document.getElementById('mesa-cart-badge');

    if (badge) badge.textContent = obtenerCantidadTotal();

    if (!body) return;

    if (!items.length) {
      body.innerHTML = `
        <div class="cart-sidebar__empty">
          <div class="cart-sidebar__empty-icon">🛒</div>
          <p>Tu carrito está vacío</p>
          <p style="font-size:var(--text-xs);margin-top:var(--space-2)">Agregá productos del menú</p>
        </div>`;
      footer.innerHTML = '';
      return;
    }

    body.innerHTML = items.map(item => `
      <div class="cart-item">
        <div class="cart-item__info">
          <p class="cart-item__name">${item.nombre}</p>
          ${item.variante ? `<p class="cart-item__variant">${item.variante}</p>` : ''}
          ${item.notas ? `<p class="cart-item__notes">📝 ${item.notas}</p>` : ''}
          <p class="cart-item__price">${formatearPrecio(item.subtotal)}</p>
          <div class="cart-item__controls">
            <button class="cart-item__qty-btn" onclick="actualizarCantidad('${item._key}', ${item.cantidad - 1})">−</button>
            <span class="cart-item__qty">${item.cantidad}</span>
            <button class="cart-item__qty-btn" onclick="actualizarCantidad('${item._key}', ${item.cantidad + 1})">+</button>
          </div>
        </div>
        <button class="cart-item__remove" onclick="quitarItem('${item._key}')" aria-label="Quitar">✕</button>
      </div>`).join('');

    footer.innerHTML = `
      <div class="cart-total">
        <span class="cart-total__label">Total</span>
        <span class="cart-total__amount">${formatearPrecio(obtenerTotal())}</span>
      </div>
      <div class="cart-pago-campos" style="margin-top:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)">
        <input class="form-input" type="text" id="cart-nombre-cliente" placeholder="Tu nombre (opcional)" value="${_nombreCliente}" oninput="_nombreCliente=this.value" />
        <select class="form-select" id="cart-metodo-pago" oninput="_metodoPagoSeleccionado=this.value">
          <option value="Efectivo" ${_metodoPagoSeleccionado === 'Efectivo' ? 'selected' : ''}>💵 Efectivo</option>
          <option value="MercadoPago" ${_metodoPagoSeleccionado === 'MercadoPago' ? 'selected' : ''}>📱 MercadoPago</option>
        </select>
        <textarea class="form-textarea" id="cart-notas-generales" placeholder="Notas para cocina (general)" rows="2" oninput="_notasGenerales=this.value">${_notasGenerales}</textarea>
      </div>
      <button class="btn btn--primary btn--full" onclick="enviarPedidoMesa()" ${_pedidoEsperando ? 'disabled' : ''}>
        ${_pedidoEsperando ? '⏳ Esperando...' : '📤 Enviar pedido'}
      </button>
      <button class="btn btn--ghost btn--full btn--sm" onclick="vaciarCarrito()">
        Vaciar carrito
      </button>`;
  }

  function _renderizarCarritoSidebar(items) {
    const body   = document.getElementById('cart-items-container');
    const footer = document.getElementById('cart-footer');
    const badge  = document.getElementById('cart-badge');

    if (badge) badge.textContent = obtenerCantidadTotal();

    if (!items.length) {
      body.innerHTML = `
        <div class="cart-sidebar__empty">
          <div class="cart-sidebar__empty-icon">🛒</div>
          <p>Tu carrito está vacío</p>
          <p style="font-size:var(--text-xs);margin-top:var(--space-2)">Agregá productos del menú</p>
        </div>`;
      footer.innerHTML = '';
      return;
    }

    body.innerHTML = items.map(item => `
      <div class="cart-item">
        <div class="cart-item__info">
          <p class="cart-item__name">${item.nombre}</p>
          ${item.variante ? `<p class="cart-item__variant">${item.variante}</p>` : ''}
          ${item.notas ? `<p class="cart-item__notes">📝 ${item.notas}</p>` : ''}
          <p class="cart-item__price">${formatearPrecio(item.subtotal)}</p>
          <div class="cart-item__controls">
            <button class="cart-item__qty-btn" onclick="actualizarCantidad('${item._key}', ${item.cantidad - 1})">−</button>
            <span class="cart-item__qty">${item.cantidad}</span>
            <button class="cart-item__qty-btn" onclick="actualizarCantidad('${item._key}', ${item.cantidad + 1})">+</button>
          </div>
        </div>
        <button class="cart-item__remove" onclick="quitarItem('${item._key}')" aria-label="Quitar">✕</button>
      </div>`).join('');

    footer.innerHTML = `
      <div class="cart-total">
        <span class="cart-total__label">Total</span>
        <span class="cart-total__amount">${formatearPrecio(obtenerTotal())}</span>
      </div>
      <button class="btn btn--primary btn--full" onclick="irACheckout()">
        🛒 Ir a Pagar
      </button>
      <button class="btn btn--ghost btn--full btn--sm" onclick="vaciarCarrito()">
        Vaciar carrito
      </button>`;
  }

  window.enviarPedidoMesa = async () => {
    const items = obtenerCarrito();
    if (!items.length) { mostrarToast('Carrito vacío', 'warning'); return; }
    try {
      // Arranca un pedido nuevo → se cierra la ventana de pago anterior
      _limpiarPagoReciente();
      _ultimosPedidos = [];
      await crearPedido({
        cliente_uid: `mesa:${_numeroMesa}`,
        nombre_cliente: _nombreCliente || `Mesa ${_numeroMesa}`,
        tipo_consumo: 'Comer en el local',
        mesa_id: String(_numeroMesa),
        zona: null,
        items: items.map(i => ({
          producto_id: i.producto_id,
          nombre: i.nombre,
          variante: i.variante,
          precio_unitario: i.precio_unitario,
          cantidad: i.cantidad,
          subtotal: i.subtotal,
          notas: i.notas
        })),
        total: obtenerTotal(),
        notas_cliente: _notasGenerales,
        estado_cocina: 'Pendiente confirma caja',
        estado_pago: _metodoPagoSeleccionado === 'MercadoPago' ? 'Pendiente verificacion MP' : 'Pendiente',
        metodo_pago: _metodoPagoSeleccionado,
        recargo_delivery: 0,
        entregado: false,
        entregado_mozo: false,
        cancelado_por: null,
        motivo_cancelacion: null,
      });
      vaciarCarrito();
      cerrarBottomSheet();
      _nombreCliente = '';
      _notasGenerales = '';
      _metodoPagoSeleccionado = 'Efectivo';
      mostrarToast('Pedido enviado. Esperando confirmación de caja...', 'success');
      _pedidoEsperando = true;
      _escucharPedidoMesa();
    } catch (e) {
      mostrarToast('Error al enviar pedido', 'error');
    }
  };

  function irACheckout() {
    if (!obtenerCarrito().length) {
      mostrarToast('Tu carrito está vacío', 'warning');
      return;
    }
    cerrarCarrito();
    renderizarCheckout();
  }

  // Event Delegation para botones dinámicos "+agregar"
  // Captura clicks en cualquier botón .agregar-item aunque se creen después
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.agregar-item');
    if (btn && !btn.disabled) {
      handleAgregarItem({ currentTarget: btn });
    }
  });

  window.renderizarCliente  = renderizarCliente;
  window.handleAgregarItem  = handleAgregarItem;
  window.toggleAcordeon     = toggleAcordeon;
  window.irACheckout        = irACheckout;
  window._renderDashboardEspera = _renderDashboardEspera;
  window._abrirDashboardMesa    = _abrirDashboardMesa;
  window._cleanupCliente    = _cleanupCliente;
  // Única definición en toda la app (tracker.js ya no la pisa)
  window.hacerOtroPedido    = _otroPedidoMesa;
  window._noSeguirMesa      = _noSeguirMesa;

})();