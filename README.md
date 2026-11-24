# 🍗 Rotisería SYM — Sistema de Gestión de Restaurante

Sistema integral de gestión para rotisería/restaurante de comida rápida, **adaptable a cualquier local gastronómico**. Gestión completa: menú online con **mesas QR** para clientes en el local, **delivery** a domicilio, retiro en local, **TV lobby** en tiempo real, KDS para cocina, POS para cajero y panel de administración completo con editor de mesas drag&drop.

Construida con **Vanilla JS**, CSS3 y **Firebase** (Firestore + Auth) sin bundler. Frontend SPA monolítica, deployable en GitHub Pages + `server.js` Express para desarrollo local multi-dispositivo vía **ngrok**.

> 📄 Documentación completa en: [`SCHEMA-BDD.md`](./SCHEMA-BDD.md) · [`ESTRUCTURA-APP.md`](./ESTRUCTURA-APP.md) · [`CONTEXTO.md`](./CONTEXTO.md) · [`STYLE_APP.md`](./STYLE_APP.md)

---

## 🗂️ Estructura del Proyecto

```
rotiseria-sym/
├── index.html                  # Único HTML — punto de entrada de la SPA
├── firestore.rules             # Reglas de seguridad de Firestore (copiar a Firebase Console)
├── server.js                   # Express: SPA fallback + endpoint QR PNG
├── package.json                # Dependencias: express, qrcode
├── manifest.json               # PWA manifest (cliente mesa móvil)
├── sw.js                       # Service Worker (caché estático + install prompt)
├── cuentas.txt                 # Credenciales de prueba staff + contexto de sesiones
├── README.md
│
├── SCHEMA-BDD.md               # Documento: esquema completo de colecciones Firestore
├── ESTRUCTURA-APP.md           # Documento: rutas, archivos, componentes UI, flujos
├── CONTEXTO.md                 # Documento: decisiones de arquitectura y seguridad
├── STYLE_APP.md                # Documento: sistema dual de diseño (Dark+Bento staff / Flat 2.0 cliente)
│
├── css/
│   ├── style.css               # Estilos globales + Flat 2.0 (cliente mesa, tracker, login)
│   └── dark.css                # Dark Mode + Bento Grid (admin, cajero, cocina, TV lobby)
│
├── assets/
│   ├── img/                    # Logo, imágenes de productos
│   └── sounds/                 # Sonido de nuevo ticket para cocina
│
├── documentacion/
│   ├── firestore.rules         # Backup de reglas Firestore
│   └── q-dev-chat-*.md         # Chat de contexto de desarrollo previo
│
└── js/
    ├── firebase-config.js      # Inicialización Firebase (config + exports: db, auth)
    ├── utils.js                 # Utilidades compartidas: claseEstado(), formatearPrecio(), helpers
    ├── auth.js                  # Login, registro, Google Auth, logout, traducirErrorAuth
    ├── router.js                # Enrutador RBAC: detecta auth → lee rol → renderiza vista
    ├── app.js                   # Entry point: toast, modal, overlay, carrito, formatearPrecio
    ├── seed.js                  # Productos de prueba (15 items) + patchArchivado() [solo dev]
    │
    ├── views/
    │   ├── login.js             # Vista: login/registro tabs + Google Auth
    │   ├── cliente.js           # Vista: menú acordeones + carrito lateral + modales
    │   ├── checkout.js          # Vista: tipo consumo + métodos de pago + confirmar pedido
    │   ├── tracker.js           # Vista: seguimiento tiempo real con barra de progreso
    │   ├── cocina.js            # Vista: KDS dark mode + comandas + cancelar + sonido
    │   ├── cajero.js            # Orchestrator: tabs + imports de sub-archivos
    │   ├── cajero-pos.js        # Terminal POS: grid productos + carrito
    │   ├── cajero-mesas.js      # Dashboard mesas + panel lateral + cobro
    │   ├── admin.js             # Orchestrator: tabs + imports de sub-archivos
    │   ├── admin-menu.js        # CRUD productos + categorías
    │   ├── admin-ventas.js      # Resumen ventas + dashboard + gráficos
    │   ├── tv.js                # Vista: TV Lobby — grid mesas + carrusel "Listos" (/tv)
    │   └── mesas-editor.js      # Módulo: editor drag&drop de mesas (grid + lista arrastrable)
    │
    └── services/
        ├── productos.js         # CRUD Firestore: colección "productos" + listeners
        ├── pedidos.js           # CRUD Firestore: colección "pedidos" + listeners múltiples
        ├── usuarios.js          # Lectura Firestore: colección "users"
        ├── carrito.js           # Estado carrito en memoria + localStorage (mesa)
        ├── mesas.js             # CRUD Firestore: colección "mesas" + listeners tiempo real
        ├── config.js            # Lectura/escritura: config/sistema, config/tv_config
        └── listeners.js         # Centralizar manejo de unsubscribe de Firestore
```

---

## 🔥 Configuración Firebase

**Proyecto:** `rotiseria-sym`
**Servicios activos:** Firestore, Authentication (Email/Password + Google)

```js
// js/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyADRiQPLRaHaeVS0ABJjLzRayZml_gquTQ",
  authDomain: "rotiseria-sym.firebaseapp.com",
  projectId: "rotiseria-sym",
  storageBucket: "rotiseria-sym.firebasestorage.app",
  messagingSenderId: "698977567981",
  appId: "1:698977567981:web:30959d1c96c434572238e4",
  measurementId: "G-YDDFWEWP0Q"
};
```

**Pendiente en Firebase Console:**
- [ ] Agregar `localhost` a dominios autorizados (Authentication → Settings → Authorized domains)
- [ ] Agregar dominio de GitHub Pages cuando se publique
- [ ] Copiar contenido de `firestore.rules` en Firestore → Rules
- [ ] Crear índices Firestore (5 nuevos, ver SCHEMA-BDD.md)
- [ ] Configurar webhook MercadoPago (futuro)

---

## 👥 Roles y Acceso

El sistema maneja **6 tipos de usuario** incluyendo un pseudo-usuario "mesa" que opera sin autenticación Firebase:

| Rol | Identidad | Auth | Vista principal | Permisos clave |
|---|---|---|---|---|
| `mesa` (anónimo) | `mesas/{mesaId}` | **Sin Auth** (sin login) | Cliente Mesa (`/?mesa=N`) | Leer productos, config, mesas activas. Crear pedido con `cliente_uid="mesa:N"` |
| `cliente` | `users/{uid}` | Email/Pass + Google | Menú + Carrito + Checkout + Tracker | Crear pedidos propios, historial, delivery, retirar |
| `cajero` | `users/{uid}` | Email/Pass (staff) | POS + Dashboard Mesas | Cobros, verificación MP, liberar mesas, cancelar (con clave supervisor), walk-in |
| `cocina` | `users/{uid}` | Email/Pass (staff) | KDS Activos + Historial | Avanzar estados, cancelar (con motivo), marcar "Entregado" en historial |
| `admin` | `users/{uid}` | Email/Pass (staff) | Panel Admin completo | CRUD todo, usuarios staff, QR mesas, editor plano, cancelados, config |
| `tv` | `users/{uid}` | Email/Pass (staff) | TV Lobby (`/tv`) | Solo lectura: mesas activas, pedidos "Listo para entregar" |

**Flujo de rol:** Al hacer login → `auth.js` → `usuarios.js` lee `users/{uid}` → `router.js` redirige según `rol`.
**Flujo mesa:** Al escanear QR `/?mesa=N` → `router.js` detecta param → renderiza vista cliente mesa sin login.

**Usuarios staff de prueba** (crear en Firebase Auth + doc en Firestore `users/{uid}`):
```
admin@rotiseria-sym.com   / admin123     → rol: "admin"
caja@rotiseria-sym.com    / caja123      → rol: "cajero"
cocina@rotiseria-sym.com  / cocina123    → rol: "cocina"
tv@rotiseria-sym.com      / tv1234       → rol: "tv"
```

> La contraseña del staff se crea en Firebase Auth. El doc `users/{uid}` en Firestore almacena `{email, nombre, rol, activo}`. El Admin puede crear/editar staff desde la pestaña "Usuarios staff" en el panel.

---

## 🗃️ Modelo de Datos Firestore

> Esquema completo con campos y tipos en [`SCHEMA-BDD.md`](./SCHEMA-BDD.md)

### `users/{uid}`
```js
{
  email: "string",
  nombre: "string",
  rol: "cliente" | "cajero" | "cocina" | "admin" | "tv",
  activo: boolean          // true = habilitado, false = deshabilitado (staff)
}
```

### `productos/{id}`
```js
{
  nombre: "string",
  descripcion: "string",
  precio: number,                              // ARS
  categoria: "string",                         // ej: "Pollos", "Milanesas"
  url_foto: "string",                          // URL imagen externa
  tiempo_preparacion_min: number,
  estado: "Disponible" | "Agotado",
  composicion: ["string"],                     // ej: ["Pollo", "Papas"]
  variantes: [{ nombre: "string", extra_precio: number }],
  archivado: boolean                           // soft-delete
}
```

### `pedidos/{id}` (extendido)
```js
{
  // ── Campos existentes ─────────────────────────────
  cliente_uid: "string",          // "anonimo" | uid real | "mesa:{mesaId}"
  nombre_cliente: "string",
  tipo_consumo: "Mesa" | "Retirar" | "Domicilio",
  items: [{
    producto_id: "string",
    nombre: "string",
    variante: "string | null",
    precio_unitario: number,
    cantidad: number,
    subtotal: number,
    notas: "string"
  }],
  notas_cliente: "string",
  estado_cocina: "Pendiente confirma caja" | "Pendiente" | "En Preparación" | "Demorado" | "Listo para Retirar/Comer" | "Cancelado" | "Entregado",
  estado_pago: "Pendiente" | "Pagado" | "Pendiente verificación MP",
  metodo_pago: "Efectivo" | "MercadoPago" | "Transferencia" | "Tarjeta de Débito" | "Tarjeta de Crédito",
  fecha_hora_creacion: Timestamp,
  total: number,
  entregado: boolean,

  // ── Nuevos campos mesa ─────────────────────────────
  mesa_id: "string | null",                    // id de la mesa (si tipo_consumo="Mesa")
  zona: "string | null",                       // zona de la mesa

  // ── Nuevos campos delivery ─────────────────────────
  direccion_entrega: "string | null",          // solo si tipo_consumo="Domicilio"
  recargo_delivery: number,                    // 15% si Domicilio, 0 si no

  // ── Nuevos campos MercadoPago ──────────────────────
  mp_payment_id: "string | null",              // ID de pago MP (trayecto del cliente)
  mp_external_reference: "string | null",      // referencia externa MP
  mp_status: "string | null",                  // "approved" | "pending" | "rejected"

  // ── Nuevos campos cobro / trazabilidad ─────────────
  monto_recibido: number | null,               // efectivo: cuánto pagó el cliente
  vuelto: number | null,                       // efectivo: vuelto calculado
  cobrado_por: "string | null",                // uid del cajero que cobró
  fecha_cobro: Timestamp | null,

  // ── Nuevos campos mozo / entrega ───────────────────
  entregado_mozo: boolean,                     // default false. true = mozo marcó
  fecha_entrega_mozo: Timestamp | null,
  mozo_uid: "string | null",                   // "mozo" anónimo
  fecha_listo: Timestamp | null,               // cuando cocina marca "Listo"

  // ── Nuevos campos cancelación ──────────────────────
  cancelado_por: "string | null",              // uid cajero/admin que canceló
  motivo_cancelacion: "string | null",         // "Se fue sin pagar", "Error en pedido", etc.
  clave_usada_hash: "string | null"            // SHA-256 de la clave supervisor
}
```

### `mesas/{mesaId}` (nueva colección)
```js
{
  numero: "string",               // "1", "2", "3"...
  zona: "string",                 // "Salón", "Terraza", "Barra"
  capacidad: number,              // 2 | 4 | 6 | 8 (autocalculado según tamaño)
  tamaño: "1x1" | "1x2" | "2x1" | "2x2",   // para render merge visual en grid
  pos_x: number,                  // columna en editor (0-based)
  pos_y: number,                  // fila en editor (0-based)
  activa: boolean,                // true = visible, false = soft-delete
  merge_con: "string | null",     // id mesa padre si es hija en merge visual
  created_at: Timestamp,
  updated_at: Timestamp
}
```

### `config/sistema` (documento único)
```js
{
  supervisor_hash: "string",       // SHA-256("supervisor666") — cancelación
  timeout_caja_min: number,        // 5 — minutos para que cajero confirme mesa
  timeout_sin_pedido_min: number,  // 15 — minutos sin pedido → libera mesa
  tv_historial_max: number,        // 10 — máx items carrusel TV
  recargo_delivery_pct: number     // 15 — % recargo delivery
}
```

### `config/tv_config` (multi-TV futuro)
```js
{
  tv1: { zona: "Salón" },
  tv2: { zona: "Terraza" }
  // ...
}
```

### `config/categorias` (existente)
```js
{
  lista: [{ nombre: "string", visible: boolean }]
}
```

---

## 🎨 Paleta de Colores

### Colores base (CSS variables)
| Variable CSS | Valor | Uso |
|---|---|---|
| `--rojo-tuco` | `#D32F2F` | Botones primarios, alertas, header |
| `--rojo-tuco-dark` | `#B71C1C` | Hover botones primarios |
| `--dorado-fritura` | `#F5B041` | Acentos, badges, íconos, notas de item |
| `--blanco-crema` | `#FCFBF8` | Fondo principal |
| `--gris-carbon` | `#2C3E50` | Textos principales |
| `--gris-claro` | `#ECE9E1` | Fondos de cards, separadores |
| `--gris-medio` | `#B0A99A` | Textos secundarios, placeholders |
| `--verde-listo` | `#27AE60` | Estado "Listo", confirmaciones, toggle disponible |
| `--verde-dark` | `#1E8449` | Hover verde |
| `--azul-info` | `#2980B9` | Info, badge "En Preparación" |
| `--naranja-alerta` | `#E67E22` | Estado "Demorado", advertencias |

### Estados de mesa (UI del grid)
| Estado | Emoji | Color | Hex | Trigger Firestore |
|---|---|---|---|---|
| **Libre** | 🟢 | Verde | `#27AE60` | `activa:true`, sin pedido activo |
| **Pendiente caja** | 🟡 | Amarillo | `#F5B041` | `localStorage.mesa:N:pending` existe (5 min countdown) |
| **Ocupada armando** | 🔵 | Azul-gris | `#6B7280` | Caja confirmó, cliente armando carrito |
| **En cocina** | 🟠 | Naranja | `#E67E22` | `estado_cocina` in ["Pendiente","En Preparación","Demorado"] |
| **Comiendo / Listo** | 🔴 | Rojo | `#D32F2F` | `estado_cocina="Listo para Retirar/Comer"` AND `entregado_mozo=false` |
| **Inactiva** | ⚫ | Gris oscuro | `#2C3E50` | `activa:false` |

---

## 🔄 Flujos Principales

### 1. QR Mesa (comer en el local)
```
Cliente escanea QR → /?mesa=N
  → router.js detecta param ?mesa=N
  → guarda localStorage.mesa:N:pending (timestamp + mesaId)
  → pantalla: "Esperando confirmación del personal..." (countdown 5 min)
  → Cajero dashboard Mesas: badge "Por confirmar" en Mesa N (amarillo 🟡)
  → Cajero click → "Confirmar" / "Rechazar"
     ✅ Confirmar → crea pedido Firestore (estado_cocina="Pendiente", cliente_uid="mesa:N")
       → cocina suena alerta, ve comanda con "Mesa N" grande
       → cliente ve tracker con header "Mesa N"
     ❌ Rechazar/Timeout → borra localStorage → toast cliente "Mesa liberada: {razón}"
  → Cliente arma carrito (localStorage.mesa:N:cart)
  → Checkout: tipo_consumo fijo "Mesa", MP / Efectivo / Transferencia
  → Crea pedido con mesa_id, zona, cliente_uid="mesa:N"
  → Cocina: comanda con "Mesa N" prominente + ítems
  → Cocina marca Listo → fecha_listo → TV Lobby carrusel "Mesa N — Listo"
  → Mozo marca Entregado (Cocina tab Historial / TV) → entregado_mozo=true
  → Cajero cobra → Mesa Libre 🟢
  → Ronda 2: cliente rescanea QR → mismo flujo
```

### 2. MercadoPago Checkout Pro
```
Cliente selecciona "MercadoPago" en checkout
  → App redirige a Checkout Pro (URL real de MP)
  → Cliente paga en su navegador MP
  → MP redirige de vuelta a la app con payment_id + external_reference
  → App setea:
    - estado_pago: "Pendiente verificación MP"
    - mp_payment_id: payment_id
    - mp_external_reference: external_reference
  → Cliente ve: "Pago procesado, esperando confirmación del personal"
  → Cajero dashboard Mesas: badge "MP pendiente verificación" en Mesa N
  → Cajero abre panel MP en otra pestaña (manual) → verifica que el pago llegó
  → Cajero click "Confirmar y liberar" →
    - estado_pago: "Pagado"
    - metodo_pago: "MercadoPago"
    - fecha_cobro: now()
    - Si tipo_consumo="Mesa" → libera mesa
```

### 3. Cobro efectivo con vuelto
```
Cajero click mesa "Comiendo" 🔴 → "Pagar mesa"
  → Modal: "¿Cuánto pagó el cliente?" (input number, step 100)
  → Cálculo automático: vuelto = monto_recibido - total
  → Si vuelto < 0 → toast "Monto insuficiente"
  → Botón "Confirmar cobro" →
    - monto_recibido: monto_ingresado
    - vuelto: calculado
    - cobrado_por: uid_cajero
    - fecha_cobro: now()
    - estado_pago: "Pagado"
    - metodo_pago: "Efectivo"
    - Si tipo_consumo="Mesa" AND estado_cocina="Listo para Retirar/Comer" → libera mesa
```

### 4. Cancelación con clave supervisor
```
Cajero/Admin click mesa → "Cancelar mesa"
  → Modal: input clave supervisor "supervisor666"
  → App calcula SHA-256(clave) → compara con config/sistema.supervisor_hash
  → Si coincide:
    - estado_cocina: "Cancelado"
    - motivo_cancelacion: selector ["Se fue sin pagar", "Error en pedido", "Problema en cocina", "Producto agotado", "Cliente anuló el pedido", "Otro"]
    - clave_usada_hash: hash calculado
    - cancelado_por: uid del cajero/admin
  → Mesa → Libre 🟢
  → Admin resumen: filtro "Cancelados" + stat
```

### 5. Delivery a domicilio
```
Usuario logueado selecciona "Domicilio" en checkout
  → Input dirección (texto) + botón "Abrir en Google Maps" (link externo, sin API key)
  → Total += 15% (recargo_delivery_pct de config/sistema)
  → Crea pedido con tipo_consumo="Domicilio", direccion_entrega, recargo_delivery
  → Cocina: ve comanda normal + badge "📦 Domicilio"
  → Cocina marca "Enviado" → estado_cocina="Entregado" → fin de flujo
```

### 6. TV Lobby (`/tv`)
```
Login: tv@gmail.com / tv1234 (rol: tv)
  → Selector zona dropdown (guardado en localStorage.tv_zona)
  → Grid mesas de la zona seleccionada (tiempo real via onSnapshot)
  → Lado derecho: carrusel estático últimas 10 mesas
    - Filtro: estado_cocina="Listo para Retirar/Comer" AND entregado_mozo=false
    - Orden: fecha_listo DESC
    - Cards: "Mesa N — X items — Listo hace Y min"
    - Desaparece al marcar entregado_mozo=true en Firestore
  → Modo kiosco: body fullscreen, sin header, sin scroll
```

### 7. Cocina — 2 Tabs (Activos + Historial)
```
Tab "Activos":
  → KDS actual (comandas en tiempo real)
  → Nº mesa grande en cada comanda
  → Botones: Iniciar / Listo / Demorar / Cancelar
  → Sonido al nuevo ticket

Tab "Historial":
  → Tabs rápidos: "Hoy" / "Ayer"
  → Input búsqueda: filtra por nº mesa o nombre cliente
  → Lista: pedidos con estado_cocina="Listo para Retirar/Comer" AND entregado_mozo=false
  → Botón "Entregado" por fila →
    - entregado_mozo: true
    - mozo_uid: "mozo"
    - fecha_entrega_mozo: now()
  → Desaparece de la lista y de TV Lobby
```

### 8. Factura / Imprimir (HTML print)
```
Botón "Imprimir cuenta" en Tracker (cliente) y Panel mesa (Cajero)
  → Abre vista con @media print styles
  → Datos: Nombre local, CUIT, domicilio, IVA, "Comprobante no válido como factura"
  → Fecha/hora, Mesa N, Items (cant, desc, precio unit, subtotal), Total
  → Método de pago, Vuelto (si efectivo), QR placeholder AFIP (futuro)
  → CSS: .no-print display:none, body margin:0, .factura width:80mm
```

---

## 🚀 Cómo Correr el Proyecto

### Opción 1: Live Server (desarrollo rápido, sin server.js)
```bash
# Abrir con Live Server en VS Code
# Click derecho en index.html → "Open with Live Server"
# URL: http://127.0.0.1:5500
```
> No requiere npm. Firebase se carga vía CDN. Funcional para desarrollo local.

### Opción 2: server.js + ngrok (recomendado para multi-dispositivo)
```bash
# 1. Instalar dependencias (solo una vez)
npm install

# 2. Iniciar servidor Express (puerto 3000)
npm start
# → Server http://localhost:3000

# 3. (Opcional) Abrir HTTPS público para probar en móviles reales
ngrok http 3000
# → Copia la URL HTTPS generada (ej: https://abc123.ngrok.io)
```

> `server.js` sirve archivos estáticos + genera QR PNG automáticos en `GET /qr/:mesa.png`.
> **ngrok** provee HTTPS necesario para: PWA, MercadoPago Checkout Pro, pruebas en celular real.

---

## ⚠️ Notas Importantes

### Seguridad y configuración
- **Nunca commitear** credenciales reales. La `firebaseConfig` es pública por diseño (Firebase la protege con reglas de seguridad y dominios autorizados).
- Las reglas de `firestore.rules` deben copiarse manualmente en **Firebase Console → Firestore → Rules** cada vez que se modifican.
- El campo `rol` en `users/{uid}` es la **fuente de verdad** para el acceso. Sin ese documento, el usuario queda sin vista asignada.
- La clave de supervisor `"supervisor666"` se almacena como hash SHA-256 en `config/sistema.supervisor_hash`. La validación es cliente-side + reglas Firestore. No se expone en el frontend.

### MercadoPago
- Se usa **Checkout Pro** (redirect a web de MP). El cliente paga en su navegador y vuelve a la app.
- La verificación es **manual**: el cajero abre el panel de MP en otra pestaña y verifica que el pago llegó, luego confirma en la app.
- Las credenciales MP (`MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`) se configurarán cuando se implemente (pendiente).
- El webhook de MP se configura en el panel de MP. Cuando el pago se aprueba, **escribe en Firestore** (`estado_pago: 'Pagado'` + `fecha_cobro`) usando `external_reference` (array de IDs de pedido).

### Carrito y persistencia
- El carrito del **cliente normal** (domicilio/retirar) vive **solo en memoria** (no en Firestore). Se pierde al recargar. Esto es intencional.
- El carrito de la **mesa** persiste en **localStorage** (`mesa:N:cart`) para sobrevivir recargas. Se borra al confirmar pago o al timeout de la mesa.
- El **pending** de mesa (esperando confirmación de caja) se guarda en `localStorage.mesa:N:pending` con timestamp.

### Delivery
- Delivery **requiere login** (usuario real con cuenta).
- Recargo fijo de **15%** sobre el total (configurable en `config/sistema.recargo_delivery_pct`).
- Dirección: input de texto + botón "Abrir en Google Maps" (sin API key, sin costo).

### Mesas
- Capacidad: 1 cuadrado (1x1) = 2-4 personas, 2 cuadrados (1x2) = 6 personas, 4 cuadrados (2x2) = 8 personas (máx).
- Merge es **solo visual** en el editor. Cada mesa sigue siendo un documento independiente en Firestore.
- Soft-delete: `activa:false` bloquea eliminar si hay pedidos activos vinculados (la guarda compara por **número** de mesa, que es como se guarda `pedidos.mesa_id`).

### Reglas de Firestore (hay que DESPLEGARLAS)
- `firestore.rules` cambió: el cliente de mesa **sin sesión** (el QR) ahora puede
  leer sus pedidos, marcar el fallback a efectivo y listar pedidos de su mesa.
  Los pedidos de mesa se identifican por `cliente_uid` con prefijo `mesa:N`
  (los que crea el cliente desde el QR y los de POS "Comer en el local").
- **IMPORTANTE — acción manual:** copiá `firestore.rules` en
  **Firebase Console → Firestore → Rules** (o `firebase deploy --only firestore:rules`).
  Sin el deploy, al escanear un QR en un celular sin sesión la app muestra
  "Ocurrió un error inesperado" (las reglas viejas rechazan el listado de `pedidos`).
- Las queries del cliente filtran por `cliente_uid == 'mesa:N'` (necesario para
  que Firestore pueda demostrar el acotamiento) y ordenan/filttran en memoria,
  por eso **no hacen falta índices nuevos**.

### Sesiones (login por pestaña)
- Cada pestaña mantiene **SU propia sesión** (persistencia `SESSION` de Firebase): podés tener cajero, cocina, admin y TV abiertos en 4 pestañas del mismo navegador sin que se pisen.
- **Cerrar la pestaña = cerrar sesión de ese rol** en esa pestaña. Si cerrás el navegador entero, hay que volver a loguearse.
- **Migración (importante, hacer una vez tras el deploy):** las sesiones viejas guardadas en `localStorage` siguen auto-logueando pestañas nuevas. La app las borra automáticamente al arrancar (`js/auth.js`), pero si ves que una pestaña nueva arranca con un rol sin pedirlo, **cerrá sesión una vez** en ese equipo y volvé a loguear. A partir de ahí queda en `sessionStorage` y no vuelve a pasar.
- El **modo mesa** (`/?mesa=N`) no usa auth: no se ve afectado.

### QR de mesas
- El PNG se genera en `GET /qr/:mesa.png` con `Cache-Control: no-store` (nunca sirve una imagen vieja).
- **La URL que codifica el QR es la URL vigente desde la que se pidió el PNG**: si lo descargás desde la URL de ngrok actual, el QR apunta a esa URL, aunque `.env tenga un `PUBLIC_URL` viejo. Si lo pedís desde `localhost`, usa `PUBLIC_URL`.
- **ngrok gratis cambia de URL al reiniciar** → hay que volver a descargar los QR (los ya impresos quedan apuntando a la URL anterior y no abren). Verificación rápida: escaneá/descargá un QR y fijate que abra `https://<url-vigente>/?mesa=N`.
- El Service Worker **no cachea** `/qr/*` ni `/api/*`, y las navegaciones siempre van a la red → la app arranca con el HTML fresco (cache `sym-v12.5`).

---

## 📋 Roadmap de Desarrollo

### ✅ BASE APP (Sesiones 0-11) — COMPLETADA

#### ✅ SESIÓN 0 — Estructura (COMPLETADA)
- [x] Crear carpetas y archivos vacíos
- [x] Escribir README con contexto completo

#### ✅ SESIÓN 1 — Base HTML + CSS Global (COMPLETADA)
**Archivos:** `index.html`, `css/style.css`
- [x] HTML base: `<div id="app">` como contenedor único de la SPA
- [x] Variables CSS, reset, tipografía (Google Fonts: Poppins)
- [x] Componentes CSS reutilizables: botones, cards, badges, modales, spinner
- [x] Layout del header con logo y nav condicional
- [x] CSS del carrito lateral (sidebar)
- [x] Responsive básico (mobile-first)

#### ✅ SESIÓN 2 — Firebase Config + Auth + Router (COMPLETADA)
**Archivos:** `js/firebase-config.js`, `js/auth.js`, `js/router.js`, `js/app.js`
- [x] Inicializar Firebase con CDN (compat v10.12.2)
- [x] `auth.js`: login email/pass, registro, login Google, logout, persistencia `browserLocalPersistence`
- [x] `usuarios.js`: función `obtenerUsuario(uid)` que lee `users/{uid}`
- [x] `router.js`: `onAuthStateChanged` → lee rol → renderiza vista correcta
- [x] `app.js`: punto de entrada, inicializa todo

#### ✅ SESIÓN 3 — Vista Login (COMPLETADA)
**Archivo:** `js/views/login.js`
- [x] Formulario con tabs: "Iniciar Sesión" / "Registrarse"
- [x] Login con email + contraseña
- [x] Registro con nombre + email + contraseña (crea doc en `users/` con rol `"cliente"`)
- [x] Botón "Continuar con Google" (crea doc si no existe)
- [x] Manejo de errores con mensajes en español

#### ✅ SESIÓN 4 — Vista Cliente: Menú (COMPLETADA)
**Archivos:** `js/views/cliente.js`, `js/services/productos.js`, `js/services/carrito.js`
- [x] `productos.js`: `onSnapshot` de colección `productos`, agrupados por categoría
- [x] Acordeones por categoría (5 categorías base)
- [x] Cards de producto: foto, nombre, precio, variantes, botón agregar
- [x] Badge "Agotado" reactivo en tiempo real
- [x] `carrito.js`: estado en memoria (array), funciones add/remove/update/clear
- [x] Sidebar del carrito: lista items, subtotal, botón "Ir a Pagar"

#### ✅ SESIÓN 5 — Vista Cliente: Checkout + Tracker (COMPLETADA)
**Archivos:** `js/views/checkout.js`, `js/views/tracker.js`, `js/services/pedidos.js`
- [x] Checkout: selector tipo de consumo (Comer en el local / Retirar)
- [x] Pasarela ficticia: formulario visual por método de pago (tarjeta, MP, transferencia)
- [x] `pedidos.js`: función `crearPedido(data)` → escribe en Firestore
- [x] Tracker: `onSnapshot` de `pedidos/{id}` → barra de progreso animada con 4 estados
- [x] Redirigir al tracker tras confirmar pedido

#### ✅ SESIÓN 6 — Vista Cocina (KDS) (COMPLETADA)
**Archivos:** `js/views/cocina.js`, `css/dark.css`
- [x] Dark mode CSS para esta vista
- [x] `onSnapshot` con filtro `estado_cocina in ["Pendiente", "En Preparación"]`
- [x] Cards de comanda: número de ticket, items, tiempo transcurrido
- [x] Botones de acción: "Iniciar" → "En Preparación", "Listo" → "Listo para Retirar/Comer"
- [x] Sonido al entrar nuevo ticket (Web Audio API)
- [x] Badge contador de pendientes

#### ✅ SESIÓN 7 — Vista Cajero (POS) (COMPLETADA)
**Archivo:** `js/views/cajero.js`
- [x] Tab 1 — Cobros pendientes: lista pedidos con `estado_pago == "Pendiente"`
- [x] Modal de cobro: detalle del pedido + selector método de pago + confirmar → `estado_pago = "Pagado"`
- [x] Tab 2 — Nuevo pedido (walk-in): buscador de productos, armar carrito, misma pasarela
- [x] Genera pedido en Firestore con `cliente_uid` del cajero y nombre manual

#### ✅ SESIÓN 8 — Vista Admin: CRUD Productos (COMPLETADA)
**Archivo:** `js/views/admin.js` (parte 1)
- [x] Tabla de productos con filtro por categoría
- [x] Modal "Nuevo Producto" / "Editar": todos los campos del modelo
- [x] Gestión de variantes y composición (agregar/quitar dinámicamente)
- [x] Toggle rápido Disponible/Agotado desde la tabla
- [x] Eliminar producto con confirmación

#### ✅ SESIÓN 9 — Vista Admin: Resumen de Ventas (COMPLETADA)
**Archivo:** `js/views/admin.js` (parte 2)
- [x] Total facturado del día / semana / mes (filtro por fecha)
- [x] Cantidad de tickets por estado
- [x] Top 5 platos más vendidos
- [x] Métodos de pago más usados (gráfico de barras CSS puro)

#### ✅ SESIÓN 10 — Reglas Firestore + Datos de Prueba (COMPLETADA)
**Archivo:** `firestore.rules`
- [x] Reglas de seguridad RBAC completas
- [x] Script `js/seed.js` con 15 productos de prueba
- [x] Crear usuarios staff de prueba (Auth + Firestore)

#### ✅ SESIÓN 11 — Pulido Final (COMPLETADA)
- [x] Responsive en mobile
- [x] Animaciones de transición entre vistas
- [x] Estados de carga (spinner)
- [x] Mensajes de error globales (toasts)
- [x] Preparar para deploy en GitHub Pages
- [x] Flujo sin login obligatorio (pedidos anónimos)
- [x] Cancelación con motivo desde cocina
- [x] Botones KDS compactos

---

### 🚧 NUEVAS FASES (Mesas + Delivery + TV + PWA) — EN DESARROLLO

#### ✅ FASE 0 — Documentación de contexto (COMPLETADA)
- [x] `SCHEMA-BDD.md` — Esquema completo de colecciones Firestore
- [x] `ESTRUCTURA-APP.md` — Rutas, archivos, componentes UI, flujos
- [x] `CONTEXTO.md` — Decisiones de arquitectura y seguridad
- [x] `README.md` — Actualizado con toda la info nueva
- [x] `STYLE_APP.md` — Sistema dual de diseño: Dark+Bento Grid (staff) + Flat 2.0 (cliente)

#### FASE 0.5 — Refactorización del código (PREVIA a funcionalidad nueva)
- [ ] Crear `js/utils.js` — extraer `claseEstado()` (4 copias → 1), `formatearPrecio()`, helpers compartidos
- [ ] Envolver todos los `.js` en IIFE `(() => { ... })()` — eliminar variables globales
- [ ] Split `admin.js` (641 lin) → `admin.js` (orchestrator ~150 lin) + `admin-menu.js` + `admin-ventas.js`
- [ ] Split `cajero.js` (544 lin) → `cajero.js` (orchestrator ~150 lin) + `cajero-pos.js` + `cajero-mesas.js`
- [ ] Fix `productos.js` — eliminar cross-layer leak con `_unsubCategorias` de `views/cliente.js`
- [ ] Mover `seed.js` fuera del `<script>` de `index.html` — cargar solo en desarrollo
- [ ] Actualizar `<script>` tags en `index.html` con archivos nuevos
- [ ] Actualizar `index.html` con `+manifest`, `+SW`, rutas `/tv`

#### FASE 1 — Colección mesas + seed + índices
- [ ] Crear `js/services/mesas.js` (CRUD + listeners tiempo real)
- [ ] Crear `js/services/config.js` (leer/escribir config/sistema)
- [ ] Agregar seed de mesas en `js/seed.js` (ej: 12 mesas, 2 zonas)
- [ ] Crear 5 índices Firestore nuevos (ver SCHEMA-BDD.md)
- [ ] Crear documento `config/sistema` con valores default

#### FASE 2 — Reglas Firestore actualizadas
- [ ] Lectura anónima de `productos`, `config/categorias`, `config/sistema`, `mesas` (activas)
- [ ] Create pedido mesa: `cliente_uid` empieza "mesa:" + `mesa_id` válido + `activa:true`
- [ ] Cancelación: solo admin/cajero + exige `motivo_cancelacion` + `clave_usada_hash`
- [ ] Entregado mozo: cocina/tv pueden escribir `entregado_mozo=true`
- [ ] Cobro/verif MP: cajero/admin escriben campos pago
- [ ] TV Lobby: rol `tv` lee mesas + pedidos Listo
- [ ] Usuarios staff CRUD: admin puede crear/editar/desactivar

#### FASE 3 — server.js + QR PNG
- [ ] Crear `server.js` (Express, static, SPA fallback, `GET /qr/:mesa.png`)
- [ ] Crear `package.json` (express, qrcode)
- [ ] `npm install` y probar en puerto 3000
- [ ] Probar generación QR con ngrok

#### FASE 4 — Router QR + timeouts
- [ ] Detectar `?mesa=N` en `router.js` → modo mesa
- [ ] Detectar `/tv` → vista TV (rol `tv`)
- [ ] Sidebar izquierdo en cajero y admin
- [ ] Timeout 5 min caja (localStorage countdown)
- [ ] Timeout 15 min sin pedido (auto-libera)
- [ ] Notificación toast al cliente si rechazan/timeout

#### FASE 5 — Admin: CRUD Mesas + Editor Plano
- [ ] Pestaña "Mesas" en admin (CRUD tabla + editor visual)
- [ ] Editor drag&drop: grid canvas + lista arrastrable de tamaños
- [ ] Persistencia pos_x/pos_y en Firestore via drag&drop
- [ ] Panel edición: número, zona, tamaño selector, activa toggle
- [ ] Soft-delete: bloquear si pedidos activos
- [ ] Merge visual via campo `tamaño` (1x1, 1x2, 2x1, 2x2)

#### FASE 6 — Cliente Mesa PWA + Checkout Mesa
- [ ] Header fijo "Mesa N" + login discreto
- [ ] Menú responsive (1 col <480px, 2 col >480px)
- [ ] Carrito bottom-sheet (slide up)
- [ ] Checkout: tipo_consumo fijo "Mesa"
- [ ] MP Checkout Pro (redirect simulado)
- [ ] Efectivo: "Pagar en caja al finalizar"
- [ ] localStorage `mesa:N:cart` + `mesa:N:pending`

#### FASE 7 — Tracker Mesa
- [ ] Header "Mesa N — Ticket #XXX"
- [ ] Login discreto (mismo que cliente)
- [ ] Progreso igual actual
- [ ] Botón "Hacer otro pedido" → limpia carrito + vuelve menú

#### FASE 8 — Cocina: 2 tabs + entregado
- [ ] Nº mesa prominente en cada comanda (tab Activos)
- [ ] Tab "Historial" (Hoy / Ayer + buscador)
- [ ] Botón "Entregado" → `entregado_mozo=true` + `mozo_uid="mozo"` + `fecha_entrega_mozo`
- [ ] Desaparece de historial y TV Lobby al marcar

#### FASE 9 — Cajero: Dashboard Mesas + Cobro
- [ ] Tab "Mesas" con grid tiempo real por zona
- [ ] Panel lateral derecho (click mesa): estado, items, total, acciones
- [ ] Modal cobro efectivo con vuelto automático
- [ ] Badge "MP pendiente verificación" + botón "Verificar" (abre MP web)
- [ ] Botón "Confirmar y liberar" (MP)
- [ ] Botón "Cancelar mesa" con clave supervisor

#### FASE 10 — Admin: Cancelados + Staff + QR
- [ ] Pestaña "Pedidos Cancelados" (filtro + stat en resumen ventas)
- [ ] Pestaña "Usuarios staff" (CRUD: crear, editar, activar, reset pass)
- [ ] Botón "Descargar QR" por mesa (PNG) + "Descargar todos (ZIP)"
- [ ] Estadística "Cancelados hoy/semana/mes" en dashboard ventas

#### FASE 11 — TV Lobby (`/tv`)
- [ ] Vista `/tv` (rol `tv`)
- [ ] Selector zona (localStorage)
- [ ] Grid mesas tiempo real (solo lectura)
- [ ] Carrusel estático últimas 10 "Listos" (fecha_listo DESC)
- [ ] Desaparece al marcar `entregado_mozo=true`
- [ ] Modo kiosco fullscreen

#### FASE 12 — Factura/Imprimir + Delivery
- [ ] Vista `@media print` en cliente (post-pago) y cajero (panel mesa)
- [ ] Datos: local, CUIT, IVA, "No válido como factura", items, total, método, vuelto
- [ ] Delivery: login requerido, input dirección + "Abrir Maps", +15%, estado "Enviado"

#### FASE 13 — PWA install
- [ ] `manifest.json` (name, start_url, display, icons 192/512)
- [ ] `sw.js` (Cache First assets, Network First HTML)
- [ ] Install prompt tras 10s en mesa
- [ ] `<link rel="manifest">` + `<script>register SW</script>` en index.html

#### FASE 14 — Testing integrado
- [ ] Flujo completo: scan QR → caja confirma → cliente pide → cocina prepara → mozo entrega → cajero cobra → mesa libre
- [ ] Flujo delivery: login → pedir → dirección → cocina prepara → "Enviado"
- [ ] Cancelación: supervisor → clave → motivo → mesa libre
- [ ] Timeout: scan → 5 min sin caja → libera + toast cliente
- [ ] Timeout: 15 min sin pedido → libera
- [ ] MP: redirect → vuelve → pendiente verif → cajero confirma → mesa libre
- [ ] Efectivo: vuelto calculado correctamente
- [ ] TV Lobby: aparece "Listo" → mozo marca → desaparece
- [ ] PWA: install prompt → app instalada → funciona offline básico

---

## 📌 Estado Actual

**Estado:** ✅ Base app completa (sesiones 0-11) + Documentación contexto (fase 0) + Estilo dual (STYLE_APP)
**En desarrollo:** Fase 0.5 (refactorización código) → Fases 1-14 (Mesas QR, Delivery, TV, PWA)
**Documentación:** [`SCHEMA-BDD.md`](./SCHEMA-BDD.md) · [`ESTRUCTURA-APP.md`](./ESTRUCTURA-APP.md) · [`CONTEXTO.md`](./CONTEXTO.md) · [`STYLE_APP.md`](./STYLE_APP.md)
**Próximo paso:** Fase 0.5 — Refactorizar código (utils.js, IIFEs, split admin/cajero) antes de funcionalidad nueva

---

## 📚 Referencias

| Documento | Descripción |
|---|---|
| [`SCHEMA-BDD.md`](./SCHEMA-BDD.md) | Esquema completo de todas las colecciones Firestore, campos, tipos, índices, reglas de seguridad |
| [`ESTRUCTURA-APP.md`](./ESTRUCTURA-APP.md) | Rutas de la SPA, archivos nuevos/modificados, componentes UI detallados, flujos de datos, server.js |
| [`CONTEXTO.md`](./CONTEXTO.md) | Decisiones de arquitectura, flujos QR/MP/cobro/cancelación, roles, seguridad, pendientes |
| [`STYLE_APP.md`](./STYLE_APP.md) | Sistema dual de diseño: Dark Mode + Bento Grid (staff) y Flat Design 2.0 (cliente) con tokens CSS, componentes y especificaciones |
| [`firestore.rules`](./firestore.rules) | Reglas de seguridad Firestore (copiar a Firebase Console) |
| [`AGENT.md`](./AGENT.md) | Reglas de output para agents (token efficiency, chunking, diff-only) |