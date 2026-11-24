// js/views/factura.js
(() => {

  function renderizarFactura(pedidoId) {
    _cargarPedido(pedidoId);
  }

  async function _cargarPedido(pedidoId) {
    try {
      const snap = await db.collection('pedidos').doc(pedidoId).get();
      if (!snap.exists) {
        mostrarToast('Pedido no encontrado', 'error');
        return;
      }
      const pedido = { id: snap.id, ...snap.data() };
      _mostrarFactura(pedido);
    } catch {
      mostrarToast('Error al cargar el pedido', 'error');
    }
  }

  function _mostrarFactura(pedido) {
    const fecha = pedido.fecha_hora_creacion?.toDate?.() || new Date();
    const fechaStr = fecha.toLocaleDateString('es-AR');
    const horaStr = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const subtotal = pedido.items.reduce((acc, i) => acc + i.subtotal, 0);
    const iva = Math.round(subtotal * 0.21);
    const total = subtotal + iva;

    const html = `
      <div class="factura-print" id="factura-print">
        <div class="factura-header">
          <div class="factura-empresa">
            <h2>Rotisería SYM</h2>
            <p>Sebastian Beltran</p>
            <p>CUIT: 20-12345678-9</p>
            <p>Av. Principal 123, Buenos Aires</p>
            <p>IVA: Responsable Inscripto</p>
          </div>
          <div class="factura-tipo">
            <h3>FACTURA C</h3>
            <p>N°: ${pedido.id.slice(-8).toUpperCase()}</p>
          </div>
        </div>

        <div class="factura-info">
          <div class="factura-cliente">
            <p><strong>Cliente:</strong> ${pedido.nombre_cliente}</p>
            <p><strong>DNI/CUIT:</strong> ----------</p>
            <p><strong>Domicilio:</strong> ${pedido.direccion_entrega || 'Sin especificar'}</p>
          </div>
          <div class="factura-fechas">
            <p><strong>Fecha:</strong> ${fechaStr}</p>
            <p><strong>Hora:</strong> ${horaStr}</p>
            <p><strong>Condición:</strong> Consumidor Final</p>
          </div>
        </div>

        <table class="factura-tabla">
          <thead>
            <tr>
              <th>Cant.</th>
              <th>Descripción</th>
              <th>P. Unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${pedido.items.map(i => `
              <tr>
                <td>${i.cantidad}</td>
                <td>${i.nombre}${i.variante ? ` (${i.variante})` : ''}</td>
                <td>${formatearPrecio(i.precio_unitario)}</td>
                <td>${formatearPrecio(i.subtotal)}</td>
              </tr>`).join('')}
          </tbody>
        </table>

        <div class="factura-totales">
          <div class="factura-totales-row">
            <span>Subtotal:</span>
            <span>${formatearPrecio(subtotal)}</span>
          </div>
          <div class="factura-totales-row">
            <span>IVA (21%):</span>
            <span>${formatearPrecio(iva)}</span>
          </div>
          <div class="factura-totales-row factura-totales-total">
            <span>TOTAL:</span>
            <span>${formatearPrecio(total)}</span>
          </div>
        </div>

        <div class="factura-footer">
          <p>CAE: 00000000000000</p>
          <p>Vencimiento CAE: ${fechaStr}</p>
          <p>Comprobante generado automáticamente</p>
        </div>
      </div>

      <div class="factura-actions" id="factura-actions">
        <button class="btn btn--primary" onclick="imprimirFactura()">🖨️ Imprimir</button>
        <button class="btn btn--secondary" onclick="cerrarModal()">Cerrar</button>
      </div>`;

    abrirModal(`
      <div class="modal modal--visible modal--lg">
        <div class="modal__box">
          <div class="modal__header">
            <h3 class="modal__title">📄 Factura</h3>
            <button class="modal__close" onclick="cerrarModal()">✕</button>
          </div>
          <div class="modal__body">
            ${html}
          </div>
        </div>
      </div>`);
  }

  window.imprimirFactura = () => {
    const content = document.getElementById('factura-print');
    const actions = document.getElementById('factura-actions');
    if (!content) return;

    actions.style.display = 'none';
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Factura - Rotisería SYM</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; }
          .factura-print { padding: 20px; max-width: 80mm; margin: 0 auto; }
          .factura-header { display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
          .factura-empresa h2 { font-size: 16px; }
          .factura-empresa p { font-size: 10px; }
          .factura-tipo { text-align: right; }
          .factura-tipo h3 { font-size: 14px; }
          .factura-info { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 11px; }
          .factura-info p { margin-bottom: 3px; }
          .factura-tabla { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          .factura-tabla th, .factura-tabla td { padding: 5px; border-bottom: 1px dashed #ccc; text-align: left; }
          .factura-tabla th { font-size: 10px; text-transform: uppercase; }
          .factura-totales { border-top: 1px dashed #000; padding-top: 10px; }
          .factura-totales-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .factura-totales-total { font-size: 14px; font-weight: bold; border-top: 1px solid #000; padding-top: 5px; }
          .factura-footer { margin-top: 20px; text-align: center; font-size: 9px; color: #666; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>`);
    printWindow.document.close();
    actions.style.display = 'flex';
  };

  window.renderizarFactura = renderizarFactura;

})();
