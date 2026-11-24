// js/views/tv.js
(() => {

  let _unsubMesasTV    = null;
  let _unsubPedidosTV  = null;
  let _carruselIdx     = 0;
  let _carruselTimer   = null;

  const COLORES = {
    'Libre':              '#27AE60',
    'Pendiente caja':     '#F5B041',
    'Ocupada armando':    '#6B7280',
    'En cocina':          '#E67E22',
    'Comiendo/Listo':     '#D32F2F',
    'Inactiva':           '#2C3E50',
  };

  function renderizarTV() {
    document.getElementById('app').innerHTML = `
      <div class="tv-wrap">
        <section class="tv-grid-section">
          <h2 class="tv-section-title">Estado de Mesas</h2>
          <div class="tv-grid" id="tv-grid">
            <div class="spinner-container"><div class="spinner"></div></div>
          </div>
        </section>
        <section class="tv-carrusel-section">
          <h2 class="tv-section-title">Pedidos Listos para Retirar</h2>
          <div class="tv-carrusel" id="tv-carrusel">
            <p class="tv-empty">Esperando pedidos...</p>
          </div>
        </section>
      </div>`;

    _escucharMesasTV();
    _escucharPedidosListosTV();
  }

  // ── Grid de mesas ─────────────────────────────────────────────
  function _escucharMesasTV() {
    if (_unsubMesasTV) _unsubMesasTV();
    _unsubMesasTV = db.collection('mesas')
      .where('activa', '==', true)
      .onSnapshot(snap => {
        const grid = document.getElementById('tv-grid');
        if (!grid) { _unsubMesasTV(); return; }

        const mesas = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            if (a.zona !== b.zona) return a.zona.localeCompare(b.zona);
            return parseInt(a.numero) - parseInt(b.numero);
          });

        if (!mesas.length) {
          grid.innerHTML = '<p class="tv-empty">No hay mesas configuradas</p>';
          return;
        }

        // Agrupar por zona
        const zonas = {};
        mesas.forEach(m => {
          if (!zonas[m.zona]) zonas[m.zona] = [];
          zonas[m.zona].push(m);
        });

        let html = '';
        for (const [zona, lista] of Object.entries(zonas)) {
          html += `<div class="tv-zona"><h3 class="tv-zona-name">${zona}</h3><div class="tv-zona-grid">`;
          lista.forEach(m => {
            const estado = m.estado || 'Libre';
            const color  = COLORES[estado] || COLORES['Libre'];
            const tam = m.tamaño || '1x1';
            const style = tam === '1x2' || tam === '2x1'
              ? 'grid-column: span 2;'
              : tam === '2x2'
                ? 'grid-column: span 2; grid-row: span 2;'
                : '';
            html += `
              <div class="tv-mesa" style="border-left: 5px solid ${color}; ${style}">
                <span class="tv-mesa-num">${m.numero}</span>
                <span class="tv-mesa-estado" style="color:${color}">${estado}</span>
                <span class="tv-mesa-cap">${m.capacidad || 4}p</span>
              </div>`;
          });
          html += '</div></div>';
        }
        grid.innerHTML = html;
      });
  }

  // ── Carrusel pedidos listos ───────────────────────────────────
  function _escucharPedidosListosTV() {
    if (_unsubPedidosTV) _unsubPedidosTV();
    _unsubPedidosTV = db.collection('pedidos')
      .where('estado_cocina', '==', 'Listo para Retirar/Comer')
      .onSnapshot(snap => {
        const contenedor = document.getElementById('tv-carrusel');
        if (!contenedor) { _unsubPedidosTV(); return; }

        const pedidos = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.entregado !== true && p.entregado_mozo !== true)
          .sort((a, b) => (b.fecha_listo?.toMillis?.() || 0) - (a.fecha_listo?.toMillis?.() || 0))
          .slice(0, 10);

        if (!pedidos.length) {
          contenedor.innerHTML = '<p class="tv-empty">No hay pedidos listos</p>';
          _resetCarrusel();
          return;
        }

        // Renderizar cards
        contenedor.innerHTML = pedidos.map((p, i) => {
          const mesa = p.mesa_id ? `Mesa ${p.numero_mesa || p.mesa_id}` : 'Para llevar';
          const items = (p.items || []).map(it => `${it.nombre} x${it.cantidad}`).join(', ');
          const tiempo = p.fecha_listo ? _formatTiempo(p.fecha_listo.toDate()) : '';
          return `
            <div class="tv-card ${i === 0 ? 'tv-card--active' : ''}" data-idx="${i}">
              <div class="tv-card-header">
                <span class="tv-card-mesa">${mesa}</span>
                <span class="tv-card-tiempo">${tiempo}</span>
              </div>
              <div class="tv-card-body">${items}</div>
              ${p.notas_cliente ? `<div class="tv-card-nota">📝 ${p.notas_cliente}</div>` : ''}
            </div>`;
        }).join('');

        _iniciarCarrusel(pedidos.length);
      });
  }

  function _iniciarCarrusel(total) {
    _resetCarrusel();
    if (total <= 1) return;
    _carruselTimer = setInterval(() => {
      const cards = document.querySelectorAll('.tv-card');
      if (!cards.length) return;
      cards[_carruselIdx].classList.remove('tv-card--active');
      _carruselIdx = (_carruselIdx + 1) % total;
      cards[_carruselIdx].classList.add('tv-card--active');
      cards[_carruselIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 4000);
  }

  function _resetCarrusel() {
    if (_carruselTimer) { clearInterval(_carruselTimer); _carruselTimer = null; }
    _carruselIdx = 0;
  }

  function _formatTiempo(fecha) {
    const diff = Math.floor((Date.now() - fecha.getTime()) / 60000);
    if (diff < 1) return 'Ahora';
    if (diff < 60) return `${diff}min`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${m}m`;
  }

  function _cleanup() {
    if (_unsubMesasTV)   { _unsubMesasTV();   _unsubMesasTV   = null; }
    if (_unsubPedidosTV) { _unsubPedidosTV(); _unsubPedidosTV = null; }
    _resetCarrusel();
  }

  // Expose
  window.renderizarTV   = renderizarTV;
  window._cleanupTV     = _cleanup;

})();
