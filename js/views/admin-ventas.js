// js/views/admin-ventas.js
(() => {

  async function cargarResumenVentas() {
    const container = document.getElementById('ventas-container');
    if (!container) return;
    container.innerHTML = `<div class="spinner-container"><div class="spinner"></div></div>`;

    try {
      const pedidos = await obtenerTodosPedidos();
      _renderizarVentas(pedidos, container);
    } catch {
      container.innerHTML = `<p style="color:var(--rojo-tuco)">Error al cargar ventas.</p>`;
    }
  }

  function _renderizarVentas(pedidos, container) {
    const pagados = pedidos.filter(p => p.estado_pago === 'Pagado');
    const ahora   = new Date();
    const hoy     = pagados.filter(p => mismoDia(p.fecha_hora_creacion?.toDate?.(), ahora));
    const semana  = pagados.filter(p => mismaSemanana(p.fecha_hora_creacion?.toDate?.(), ahora));
    const mes     = pagados.filter(p => mismoMes(p.fecha_hora_creacion?.toDate?.(), ahora));

    const sumar = arr => arr.reduce((a, p) => a + (p.total || 0), 0);

    const conteo = {};
    pagados.forEach(p => p.items?.forEach(i => {
      conteo[i.nombre] = (conteo[i.nombre] || 0) + i.cantidad;
    }));
    const top5   = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxTop = top5[0]?.[1] || 1;

    const metodos = {};
    pagados.forEach(p => {
      if (p.metodo_pago) metodos[p.metodo_pago] = (metodos[p.metodo_pago] || 0) + 1;
    });
    const totalMetodos = Object.values(metodos).reduce((a, b) => a + b, 0) || 1;

    const estados = {};
    pedidos.forEach(p => {
      estados[p.estado_cocina] = (estados[p.estado_cocina] || 0) + 1;
    });

    container.innerHTML = `
      <div class="ventas-kpis">
        <div class="kpi-card">
          <p class="kpi-card__label">Hoy</p>
          <p class="kpi-card__valor">${formatearPrecio(sumar(hoy))}</p>
          <p class="kpi-card__sub">${hoy.length} pedidos</p>
        </div>
        <div class="kpi-card">
          <p class="kpi-card__label">Esta semana</p>
          <p class="kpi-card__valor">${formatearPrecio(sumar(semana))}</p>
          <p class="kpi-card__sub">${semana.length} pedidos</p>
        </div>
        <div class="kpi-card">
          <p class="kpi-card__label">Este mes</p>
          <p class="kpi-card__valor">${formatearPrecio(sumar(mes))}</p>
          <p class="kpi-card__sub">${mes.length} pedidos</p>
        </div>
        <div class="kpi-card">
          <p class="kpi-card__label">Total histórico</p>
          <p class="kpi-card__valor">${formatearPrecio(sumar(pagados))}</p>
          <p class="kpi-card__sub">${pagados.length} pedidos</p>
        </div>
      </div>

      <div class="ventas-grid">
        <div class="ventas-card">
          <h3 class="ventas-card__title">🏆 Top 5 platos más vendidos</h3>
          ${top5.length ? top5.map(([nombre, cant]) => `
            <div class="bar-row">
              <span class="bar-row__label">${nombre}</span>
              <div class="bar-row__track">
                <div class="bar-row__fill" style="width:${Math.round((cant/maxTop)*100)}%"></div>
              </div>
              <span class="bar-row__val">${cant}</span>
            </div>`).join('') : '<p class="ventas-empty">Sin datos aún</p>'}
        </div>

        <div class="ventas-card">
          <h3 class="ventas-card__title">💳 Métodos de pago</h3>
          ${Object.entries(metodos).length ? Object.entries(metodos).map(([m, c]) => `
            <div class="bar-row">
              <span class="bar-row__label">${m}</span>
              <div class="bar-row__track">
                <div class="bar-row__fill bar-row__fill--dorado"
                     style="width:${Math.round((c/totalMetodos)*100)}%"></div>
              </div>
              <span class="bar-row__val">${Math.round((c/totalMetodos)*100)}%</span>
            </div>`).join('') : '<p class="ventas-empty">Sin datos aún</p>'}
        </div>

        <div class="ventas-card">
          <h3 class="ventas-card__title">📋 Tickets por estado</h3>
          ${Object.entries(estados).map(([e, c]) => `
            <div class="estado-row">
              <span class="badge badge--${claseEstado(e)}">${e}</span>
              <strong>${c}</strong>
            </div>`).join('') || '<p class="ventas-empty">Sin datos aún</p>'}
        </div>
      </div>`;
  }

  window.cargarResumenVentas = cargarResumenVentas;

})();
