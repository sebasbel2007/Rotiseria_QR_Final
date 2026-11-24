require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const QRCode = require('qrcode');
const path = require('path');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// ── Firebase Admin Init ──────────────────────────────────────
if (!admin.getApps().length) {
  // Producción (Render): la clave viene en la env FIREBASE_SERVICE_ACCOUNT (JSON completo).
  // Local: se lee del archivo serviceAccountKey.json (excluido de git).
  const envKey = process.env.FIREBASE_SERVICE_ACCOUNT;
  const credential = envKey
    ? admin.cert(JSON.parse(envKey))
    : admin.cert(path.join(__dirname, 'serviceAccountKey.json'));
  admin.initializeApp({ credential });
}
const db = getFirestore();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const ROOT = __dirname;

// ── MercadoPago Client ───────────────────────────────────────
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});
const preferenceClient = new Preference(mpClient);
const paymentClient = new Payment(mpClient);

// ── Middleware ────────────────────────────────────────────────
app.use(cors());

// ── POST /api/webhook (raw body ANTES de express.json) ────────
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  res.sendStatus(200);

  try {
    const rawBody = req.body;
    const xSignature = req.headers['x-signature'] || '';

    const secret = process.env.MP_WEBHOOK_SECRET;
    if (secret && xSignature) {
      const sigParts = {};
      xSignature.split(',').forEach(p => {
        const [k, v] = p.split('=');
        if (k && v) sigParts[k.trim()] = v.trim();
      });
      const ts = sigParts.ts || '';
      const v1 = sigParts.v1 || '';

      if (ts && v1) {
        const requestId = req.headers['x-request-id'] || '';
        const manifest = `id:${requestId};request-id:${requestId};ts:${ts};`;
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(manifest);
        hmac.update(rawBody);
        const computed = hmac.digest('hex');

        if (computed !== v1) {
          console.warn('⚠️ Webhook signature mismatch — ignoring');
          return;
        }
      }
    }

    const body = JSON.parse(rawBody.toString());
    const { type, data } = body;
    if (type !== 'payment' || !data?.id) return;

    const payment = await paymentClient.get({ id: data.id });
    console.log('🔔 Webhook MP:', { id: payment.id, status: payment.status, amount: payment.transaction_amount });

    if (payment.status === 'approved' && payment.external_reference) {
      let pedidoIds = [];
      try { pedidoIds = JSON.parse(payment.external_reference); } catch {}
      if (!pedidoIds.length) return;

      const batch = db.batch();
      for (const pid of pedidoIds) {
        batch.update(db.collection('pedidos').doc(pid), {
          estado_pago: 'Pagado',
          metodo_pago: 'MercadoPago',
          mp_payment_id: String(payment.id),
          mp_status: payment.status,
          fecha_cobro: FieldValue.serverTimestamp()
        });
      }
      await batch.commit();
      console.log(`✅ ${pedidoIds.length} pedido(s) marcados como Pagado`);
    }
  } catch (err) {
    console.error('Error procesando webhook MP:', err.message);
  }
});

app.use(express.json());

// ── QR: mesa PNG ─────────────────────────────────────────────

// URL base para los QR.
// Si la petición llega desde un host no local (ngrok, dominio, IP de red),
// el QR codifica ESA url → así los QR siempre apuntan a la URL vigente,
// aunque el túnel de ngrok cambie al reiniciar (los impresos con la URL
// vieja hay que reimprimirlos igual).
// Si se pide desde localhost, usamos PUBLIC_URL (o el host como fallback).
function baseUrlQr(req) {
  const host = req.get('host') || '';
  const esLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host) ||
                  /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/i.test(host);
  if (!esLocal && host) {
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
      .split(',')[0].trim();
    return `${proto}://${host}`;
  }
  return process.env.PUBLIC_URL || `${req.protocol}://${host}`;
}

app.get('/qr/:mesa.png', async (req, res) => {
  const mesaNum = parseInt(req.params.mesa, 10);
  if (isNaN(mesaNum) || mesaNum < 1 || mesaNum > 99) {
    return res.status(400).json({ error: 'Número de mesa inválido (1-99)' });
  }
  const url = `${baseUrlQr(req)}/?mesa=${mesaNum}`;
  try {
    const pngBuffer = await QRCode.toBuffer(url, {
      type: 'png', width: 400, margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.set({
      'Content-Type': 'image/png',
      // no-store: un QR con cache de 24 h podía servir una imagen vieja
      'Cache-Control': 'no-store',
      'Content-Disposition': `inline; filename="mesa-${mesaNum}.png"`
    });
    res.send(pngBuffer);
  } catch (err) {
    console.error('Error generando QR:', err.message);
    res.status(500).json({ error: 'Error generando QR' });
  }
});

// ── QR: redirect a checkout MP de una mesa ───────────────────
app.get('/qr-mp-redirect', async (req, res) => {
  const { mesa, pref_id } = req.query;
  if (!mesa || !pref_id) {
    return res.status(400).send('Faltan parámetros mesa y pref_id');
  }
  try {
    console.log('QR MP redirect - mesa:', mesa, 'pref_id:', pref_id);
    const pref = await preferenceClient.get({ preferenceId: pref_id });
    console.log('Preference fetched:', JSON.stringify(pref, null, 2));
    const initPoint = pref.init_point;
    if (!initPoint) {
      console.error('init_point is missing from preference:', pref);
      return res.status(404).send('Preferencia no tiene init_point');
    }
    console.log('Generating QR for:', initPoint);
    // QR del link de checkout MP
    const pngBuffer = await QRCode.toBuffer(String(initPoint), {
      type: 'png', width: 400, margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
    res.send(pngBuffer);
  } catch (err) {
    console.error('Error QR MP redirect:', err);
    console.error('Stack:', err.stack);
    res.status(500).send('Error generando QR de pago: ' + err.message);
  }
});

// ── QR info (admin) ──────────────────────────────────────────
app.get('/qr/info', (req, res) => {
  const baseUrl = baseUrlQr(req);
  const mesas = req.query.mesas
    ? req.query.mesas.split(',').map(Number).filter(n => !isNaN(n))
    : Array.from({ length: 20 }, (_, i) => i + 1);
  res.set('Cache-Control', 'no-store');
  res.json(mesas.map(n => ({
    mesa: n,
    url: `${baseUrl}/?mesa=${n}`,
    png: `${baseUrl}/qr/${n}.png`
  })));
});

// ══════════════════════════════════════════════════════════════
//   MERCADOPAGO — API ENDPOINTS
// ══════════════════════════════════════════════════════════════

// ── POST /api/create-preference ──────────────────────────────
app.post('/api/create-preference', async (req, res) => {
  try {
    const { mesa_id, pedido_ids, items, total } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'Items vacíos' });
    }

    // baseUrlQr: back_urls/webhook apuntan a la URL vigente (ngrok puede haber cambiado)
    const baseUrl = baseUrlQr(req);
    const backSuccess = `${baseUrl}/?mesa=${mesa_id}&mp_result=approved`;
    const backFailure = `${baseUrl}/?mesa=${mesa_id}&mp_result=rejected`;
    const backPending = `${baseUrl}/?mesa=${mesa_id}&mp_result=pending`;

    const preference = await preferenceClient.create({
      body: {
        items: items.map(item => ({
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          currency_id: 'ARS'
        })),
        external_reference: JSON.stringify(pedido_ids || []),
        metadata: {
          mesa_id: String(mesa_id),
          pedido_ids: JSON.stringify(pedido_ids || []),
          type: 'mesa_pago'
        },
        back_urls: {
          success: backSuccess,
          failure: backFailure,
          pending: backPending
        },
        statement_descriptor: 'ROTISERIA SYM',
        notification_url: `${baseUrl}/api/webhook`
      }
    });

    res.json({
      id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point
    });
  } catch (err) {
    console.error('Error creando preferencia MP:', err.message || err);
    res.status(500).json({ error: 'Error creando preferencia de pago' });
  }
});

// ── POST /api/mp-preference-for-mesa ────────────────────────
// Genera preferencia MP consolidando todos los pedidos no pagados de una mesa
app.post('/api/mp-preference-for-mesa', async (req, res) => {
  try {
    const { mesa_id } = req.body;
    if (!mesa_id) return res.status(400).json({ error: 'Falta mesa_id' });

    const snap = await db.collection('pedidos')
      .where('mesa_id', '==', String(mesa_id))
      .where('estado_pago', 'in', ['Pendiente', 'Pendiente verificacion MP'])
      .get();

    if (snap.empty) {
      return res.status(404).json({ error: 'No hay pedidos pendientes para esta mesa' });
    }

    const pedidoIds = [];
    const allItems = [];
    let totalConsolidado = 0;

    snap.docs.forEach(doc => {
      const p = doc.data();
      pedidoIds.push(doc.id);
      (p.items || []).forEach(item => {
        allItems.push({
          title: item.variante ? `${item.nombre} (${item.variante})` : item.nombre,
          quantity: item.cantidad,
          unit_price: item.precio_unitario
        });
      });
      totalConsolidado += p.total || 0;
    });

    // baseUrlQr: back_urls/webhook apuntan a la URL vigente (ngrok puede haber cambiado)
    const baseUrl = baseUrlQr(req);
    const preference = await preferenceClient.create({
      body: {
        items: allItems.map(item => ({
          ...item,
          currency_id: 'ARS'
        })),
        external_reference: JSON.stringify(pedidoIds),
        metadata: {
          mesa_id: String(mesa_id),
          pedido_ids: JSON.stringify(pedidoIds),
          type: 'mesa_pago'
        },
        back_urls: {
          success: `${baseUrl}/?mesa=${mesa_id}&mp_result=approved`,
          failure: `${baseUrl}/?mesa=${mesa_id}&mp_result=rejected`,
          pending: `${baseUrl}/?mesa=${mesa_id}&mp_result=pending`
        },
        statement_descriptor: 'ROTISERIA SYM',
        notification_url: `${baseUrl}/api/webhook`
      }
    });

    res.json({
      id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
      total: totalConsolidado,
      pedidos_count: pedidoIds.length
    });
  } catch (err) {
    console.error('Error preferencia MP mesa:', err.message);
    res.status(500).json({ error: 'Error creando preferencia' });
  }
});

// ── POST /api/mp-preference-for-pedido ────────────────────────
// Preferencia MP para UN pedido suelto (botón "💳 Pagar con MercadoPago"
// del dashboard de espera y del tracker). El webhook ya parsea
// `external_reference` como array de IDs, así que se reutiliza igual.
app.post('/api/mp-preference-for-pedido', async (req, res) => {
  try {
    const { pedido_id } = req.body;
    if (!pedido_id) return res.status(400).json({ error: 'Falta pedido_id' });

    const snap = await db.collection('pedidos').doc(pedido_id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Pedido no encontrado' });

    const p = snap.data();
    if (p.estado_pago === 'Pagado') {
      return res.status(409).json({ error: 'El pedido ya está pagado' });
    }

    const items = (p.items || []).map(i => ({
      title: i.variante ? `${i.nombre} (${i.variante})` : i.nombre,
      quantity: i.cantidad,
      unit_price: i.precio_unitario,
      currency_id: 'ARS'
    }));
    if (!items.length) return res.status(400).json({ error: 'Pedido sin items' });

    // baseUrlQr: si la petición viene de la URL ngrok vigente, los back_urls
    // y el webhook apuntan ahí (PUBLIC_URL de .env puede quedar desactualizado)
    const baseUrl = baseUrlQr(req);
    const raizBack = p.mesa_id ? `${baseUrl}/?mesa=${p.mesa_id}&` : `${baseUrl}/?`;

    const preference = await preferenceClient.create({
      body: {
        items,
        external_reference: JSON.stringify([pedido_id]),
        metadata: {
          mesa_id: String(p.mesa_id || ''),
          pedido_ids: JSON.stringify([pedido_id]),
          type: 'pedido_pago'
        },
        back_urls: {
          success: `${raizBack}mp_result=approved`,
          failure: `${raizBack}mp_result=rejected`,
          pending: `${raizBack}mp_result=pending`
        },
        statement_descriptor: 'ROTISERIA SYM',
        notification_url: `${baseUrl}/api/webhook`
      }
    });

    res.json({
      id: preference.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
      total: p.total
    });
  } catch (err) {
    console.error('Error preferencia MP pedido:', err.message);
    res.status(500).json({ error: 'Error creando preferencia' });
  }
});

// ══════════════════════════════════════════════════════════════
//   ARCHIVOS ESTÁTICOS + SPA FALLBACK
// ══════════════════════════════════════════════════════════════

app.use((req, res, next) => {
  const blocked = [
    '/package.json', '/package-lock.json', '/server.js',
    '/node_modules', '/serviceAccountKey.json',
    '/create-indexes.js', '/.gitignore', '/.nojekyll', '/.env'
  ];
  if (blocked.some(p => req.path === p || req.path.startsWith(p + '/'))) {
    return res.status(404).send('Not found');
  }
  next();
});

app.use(express.static(ROOT, {
  index: 'index.html',
  extensions: ['html'],
  fallthrough: true
}));

app.get('*', (req, res) => {
  if (path.extname(req.path)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(ROOT, 'index.html'));
});

// ── Iniciar servidor ─────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║       Rotisería SYM — Server         ║');
  console.log('  ╠══════════════════════════════════════╣');
  console.log(`  ║  Local:  http://localhost:${PORT}       ║`);
  console.log(`  ║  Red:    http://${HOST}:${PORT}      ║`);
  console.log('  ║                                      ║');
  console.log('  ║  MercadoPago: ✅ Habilitado           ║');
  console.log('  ║  Webhook:  /api/webhook              ║');
  console.log('  ║                                      ║');
  console.log('  ║  QR ejemplo:                         ║');
  console.log(`  ║  http://localhost:${PORT}/qr/1.png     ║`);
  console.log(`  ║  http://localhost:${PORT}/?mesa=1       ║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
});
