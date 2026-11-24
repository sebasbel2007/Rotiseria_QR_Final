# PLAN DE ACTUALIZACIÓN — FLUJO CLIENTE (Modo Mesa)

## Resumen del cambio
Transformar la experiencia cliente en modo mesa (`/?mesa=N`) para que:
1. Al crear el pedido, elija método de pago (Efectivo/MP) + notas generales
2. Tras check-in de caja, el catálogo se reemplaza por **Dashboard de espera** (progreso dinámico + resumen pedido)
3. Al marcar mozo "Entregado" en cocina, se habilitan botones de pago según método elegido
4. MP: botón "Pagar con MercadoPago" → redirect app/web (preferencia individual)
5. Fallback MP→Efectivo: modal confirmación → bloquea MP permanentemente → notifica a caja en tiempo real
6. Efectivo: mensaje fijo "Acérquese a caja" + resumen en pantalla

---

## Archivos a modificar

| Fase | Archivo | Cambios principales |
|------|---------|---------------------|
| 1 | `js/views/cliente.js` | Core: campos pago, cleanup, dashboard, listeners, botones |
| 2 | `js/services/pedidos.js` | `actualizarMetodoPago()` |
| 3 | `js/views/tracker.js` | `pagarPedidoMP()` exportado |
| 4 | `js/router.js` | Detección pedido activo + cleanup |
| 5 | `sw.js` | `sym-v11` |

---

## Fase 1: `js/views/cliente.js` — Core completo

### 1.1 Bottom-sheet carrito — Campos de pago
Agregar antes de "Enviar pedido":
- Input "Nombre" (opcional, placeholder "Tu nombre")
- Select "Método de pago": [Efectivo, MercadoPago]
- Textarea "Notas para cocina (general)" → `pedido.notas_cliente`

### 1.2 `enviarPedidoMesa()` — Pasar nuevos campos
```javascript
crearPedido({
  ...,
  nombre_cliente: nombre || `Mesa ${_numeroMesa}`,
  metodo_pago: metodoSeleccionado,
  notas_cliente: notasGenerales,
  estado_pago: metodoSeleccionado === 'MercadoPago' ? 'Pendiente verificacion MP' : 'Pendiente',
})
```

### 1.3 `_cleanupCliente()` — Nueva función
```javascript
function _cleanupCliente() {
  if (_unsubCategorias) { _unsubCategorias(); _unsubCategorias = null; }
  if (_unsubProductos) { _unsubProductos(); _unsubProductos = null; }
  if (_unsubPedidoMesa) { _unsubPedidoMesa(); _unsubPedidoMesa = null; }
  localStorage.removeItem(`mesa:${_numeroMesa}:cart`);
}
```

### 1.4 `_renderDashboardEspera(pedidos)` — Nueva vista
- Oculta `#menu-container`, `#bottom-sheet`
- Header: `🍽️ Mesa N` + badge estado (colores sistema)
- Progreso dinámico (6 pasos según `estado_cocina`)
- Toggle 👁️ resumen items + total
- Área botones pago (oculta hasta `entregado_mozo=true`)
- Footer: "Tu pedido está en proceso..."

### 1.5 Listener `escucharPedidosMesa()` — Lógica transición
- Detecta pedido activo sin `entregado_mozo` → dashboard
- Detecta `entregado_mozo=true` + `estado_pago !== 'Pagado'` → muestra botones
- Detecta `estado_pago: 'Pagado'` → "✅ Pagado, mesa liberada" + botón "Otro pedido"

### 1.6 `_mostrarBotonesPago(pedido)` — Según método_pago
- **MP**: 🟢 "Pagar con MercadoPago" + 🟡 "Pagar en caja" (fallback)
- **Efectivo**: mensaje fijo "Acérquese a caja" + resumen

### 1.7 `_confirmarFallbackEfectivo(pedidoId)` — Modal confirmación
```javascript
abrirModal(`
  <h3>¿Confirmás pagar en efectivo en caja?</h3>
  <button onclick="_ejecutarFallback('${pedidoId}')">Sí, pagar en caja</button>
  <button onclick="cerrarModal()">No, usar MercadoPago</button>
`);

window._ejecutarFallback = async (pedidoId) => {
  await actualizarMetodoPago(pedidoId, 'Efectivo');
  cerrarModal();
  _renderDashboardEspera(/* re-fetch */);
  // Botón MP desaparece, mensaje fijo "Acérquese a caja"
};
```

### 1.8 `pagarPedidoMP(pedidoId, total)` — Preferencia individual
```javascript
async function pagarPedidoMP(pedidoId, total) {
  const res = await fetch('/api/mp-preference-for-pedido', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pedido_id: pedidoId })
  });
  const data = await res.json();
  window.location.href = data.init_point;
}
```

---

## Fase 2: `js/services/pedidos.js`

```javascript
async function actualizarMetodoPago(pedidoId, nuevoMetodo) {
  await db.collection('pedidos').doc(pedidoId).update({
    metodo_pago: nuevoMetodo,
    estado_pago: nuevoMetodo === 'MercadoPago' ? 'Pendiente verificacion MP' : 'Pendiente'
  });
}
window.actualizarMetodoPago = actualizarMetodoPago;
```

---

## Fase 3: `js/views/tracker.js`

```javascript
window.pagarPedidoMP = async (pedidoId, total) => {
  try {
    const res = await fetch('/api/mp-preference-for-pedido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedidoId })
    });
    if (!res.ok) throw new Error('Error creando preferencia');
    const data = await res.json();
    window.location.href = data.init_point;
  } catch (err) {
    console.error('Error MP:', err);
    mostrarToast('Error al conectar con MercadoPago', 'error');
  }
};
```

---

## Fase 4: `js/router.js` — `_setupMesaMode()`

```javascript
async function _setupMesaMode(mesaNum) {
  // Validaciones existentes...

  // 1. Verificar pedido activo SIN entregado_mozo
  const snap = await db.collection('pedidos')
    .where('mesa_id', '==', String(mesaNum))
    .where('entregado_mozo', '==', false)
    .where('estado_cocina', 'not-in', ['Cancelado', 'Entregado'])
    .limit(1)
    .get();

  if (!snap.empty) {
    // Hay pedido en curso → LIMPIAR CARRITO + DASHBOARD
    localStorage.removeItem(`mesa:${mesaNum}:cart`);
    const pedidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    window._renderDashboardEspera(pedidos); // Expone desde cliente.js
    return;
  }

  // 2. No hay pedido → flujo normal catálogo
  localStorage.setItem('mesa_actual', mesaNum);
  renderizarCliente();
}
```

> **Nota**: `window._renderDashboardEspera = _renderDashboardEspera;` en cliente.js

---

## Fase 5: `sw.js`

```javascript
const CACHE_NAME = 'sym-v11';
```

---

## Reglas Firestore — Verificar compatibilidad

Las reglas actuales ya permiten:
- ✅ Create pedido anónimo (`isMesaRequest()`)
- ✅ Read pedido mesa anónima (`cliente_uid.matches('mesa:.*')`)
- ✅ Update `metodo_pago` + `estado_pago` por cajero (`soloFieldsCobro()`)
- ✅ List pedidos para dashboards cajero/admin (`allow list`)

**No se requieren cambios en reglas** para este flujo.

---

## Índices Firestore — Verificar compatibilidad

Índices actuales cubren:
- ✅ `pedidos`: `mesa_id` + `fecha_hora_creacion` (dashboard mesa)
- ✅ `pedidos`: `entregado_mozo` + `fecha_listo` (TV/historial)
- ✅ `pedidos`: `estado_cocina` + `mesa_id` + `fecha_hora_creacion` (cocina)
- ✅ `pedidos`: `estado_pago` + `mesa_id` (cobros)

**No se requieren nuevos índices** para este flujo.

---

## Checklist post-implementación

- [ ] Crear pedido con MP → `estado_pago: "Pendiente verificacion MP"`, `metodo_pago: "MercadoPago"`
- [ ] Crear pedido con Efectivo → `estado_pago: "Pendiente"`, `metodo_pago: "Efectivo"`
- [ ] Check-in cajero → Dashboard aparece, catálogo oculto, progreso dinámico
- [ ] Cocina Listo → Entregado → Botones MP/Efectivo aparecen
- [ ] Pago MP → Redirect app/web → Webhook → "Pagado" → Botones desaparecen
- [ ] Fallback MP→Efectivo → Modal confirmación → `metodo_pago: "Efectivo"` → Botón MP desaparece
- [ ] Recarga página → Router detecta pedido activo → Dashboard directo
- [ ] SW v11 → Hard refresh trae cambios
- [ ] Caja ve cambio `metodo_pago: "Efectivo"` en tiempo real (badge 💰)
- [ ] "Otro pedido" → Limpia todo → Catálogo con misma mesa libre

---

## Riesgos controlados

| Riesgo | Mitigación |
|--------|------------|
| Race condition pago MP | Listener Firestore oculta botones al ver `estado_pago: "Pagado"` |
| Doble preferencia MP | Solo crear bajo demanda (click botón), no al crear pedido |
| Cambio MP→Efectivo | `actualizarMetodoPago()` oculta botón MP permanentemente |
| Cleanup listeners | `_cleanupCliente()` mata todos los unsub antes de dashboard |
| SW cache | `sym-v11` fuerza refresh |
| QR consolidado vs individual | Flujos separados: Cliente (individual) / Caja (consolidado) |

---

## Próximos pasos
1. Implementar Fase 1 completa (`cliente.js`)
2. Verificar funcionamiento completo antes de Fase 2
3. Implementar Fases 2-5
4. Backtesting completo
5. Deploy con `sym-v11`