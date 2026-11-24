// File: server.js
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { initializeApp: initFirebase, cert, getApps } = require('firebase-admin');
const { getAuth }    = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const cloudinary = require('cloudinary').v2;

const crypto = require('crypto');

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Cloudinary (borrado seguro de archivos) ────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ─── Firebase Admin (validación de tokens en el server) ─────
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const serviceAccountAbs = SERVICE_ACCOUNT_PATH
  ? path.resolve(__dirname, SERVICE_ACCOUNT_PATH)
  : null;

if (serviceAccountAbs && fs.existsSync(serviceAccountAbs)) {
  initFirebase({
    credential: cert(require(serviceAccountAbs))
  });
  console.log('[Firebase Admin] Inicializado con service account.');
} else {
  console.warn('[Firebase Admin] No se encontró el service account. El endpoint de borrado no va a funcionar.');
}

// ─── Mercado Pago ─────────────────────────────────────────────
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});
const preferenceClient = new Preference(mpClient);
const paymentClient    = new Payment(mpClient);

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Archivos estáticos ───────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ─── Ayudante: borrar carpeta Cloudinary (imágenes + videos) ─
async function deleteCloudinaryFolder(folder) {
  const results = [];
  // 'all' no es válido como resource_type; se borra por cada tipo.
  for (const type of ['image', 'video', 'raw']) {
    try {
      const r = await cloudinary.api.delete_resources_by_prefix(folder, { resource_type: type });
      results.push({ type, deleted: r.deleted ? Object.keys(r.deleted).length : 0 });
    } catch (e) {
      results.push({ type, error: e.error?.message || e.message });
    }
  }
  try {
    await cloudinary.api.delete_folder(folder);
  } catch (e) {
    // La carpeta puede no existir o quedar con subcarpetas; no es un error fatal.
  }
  return results;
}

// ─── API: borrado seguro en Cloudinary (OPCIÓN B) ─────────────
// Valida token de Firebase + rol antes de borrar.
// Requiere: Authorization: Bearer <id token> y { folder }
app.post('/api/cloudinary/delete', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      return res.status(401).json({ error: 'No autorizado: falta el token.' });
    }
    if (!getApps().length) {
      return res.status(500).json({ error: 'Firebase Admin no inicializado en el servidor.' });
    }

    // 1) Verificar identidad con el token de Firebase
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o sesión expirada.' });
    }
    const uid = decoded.uid;

    // 2) Cargar rol del usuario
    const userSnap = await getFirestore().collection('users').doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : null;
    const role     = userData?.role;
    const isStaff  = role === 'admin' || role === 'sub_admin';

    // 3) Validar folder
    const folder = req.body?.folder;
    if (typeof folder !== 'string' || !folder || folder.includes('..')) {
      return res.status(400).json({ error: 'Carpeta no válida.' });
    }
    const FOLDER_PREFIX = 'cursos-sym/';
    if (!folder.startsWith(FOLDER_PREFIX)) {
      return res.status(400).json({ error: 'Solo se pueden borrar carpetas de cursos.' });
    }

    // 4) Validar autorización según rol
    if (!isStaff && role !== 'teacher') {
      return res.status(403).json({ error: 'Tu rol no tiene permisos para borrar archivos.' });
    }
    if (!isStaff) {
      // Teacher: solo puede borrar su propia carpeta (cursos-sym/{suUid}/...)
      const teacherPrefix = `${FOLDER_PREFIX}${uid}/`;
      if (!folder.startsWith(teacherPrefix)) {
        return res.status(403).json({ error: 'No podés borrar la carpeta de otro profesor.' });
      }
    }

    // 5) Borrar en Cloudinary
    await deleteCloudinaryFolder(folder);
    res.json({ ok: true, folder, deletedBy: uid, role });
  } catch (err) {
    console.error('[Cloudinary delete] Error:', err);
    res.status(500).json({ error: 'No se pudo borrar la carpeta en Cloudinary.' });
  }
});

// ─── API: crear preferencia de pago ──────────────────────────
app.post('/api/create-preference', async (req, res) => {
  const { type, userId, courseTitle, price, courseId, studentId, teacherId } = req.body;

  const BASE_URL = `${process.env.APP_URL || `http://localhost:${PORT}`}/pages/checkout/checkout-result.html`;

  try {
    let body;

    if (type === 'membership') {
      body = {
        items: [{
          title:       'Membresía Profesor — Cursos SyM',
          quantity:    1,
          unit_price:  1000.00, // PRECIO TEMPORAL PARA PRUEBA REAL
          currency_id: 'ARS'
        }],
        back_urls: {
          success: `${BASE_URL}?type=membership&userId=${userId}&status=approved`,
          failure: `${BASE_URL}?type=membership&status=failure`,
          pending: `${BASE_URL}?type=membership&status=pending`
        },
        auto_return: 'approved',
        metadata: { type: 'membership', userId }
      };

    } else if (type === 'course') {
      body = {
        items: [{
          title:       courseTitle,
          quantity:    1,
          unit_price:  parseFloat(Number(price).toFixed(2)),
          currency_id: 'ARS'
        }],
        back_urls: {
          success: `${BASE_URL}?type=course&courseId=${courseId}&studentId=${studentId}&teacherId=${teacherId}&price=${price}&status=approved`,
          failure: `${BASE_URL}?type=course&courseId=${courseId}&status=failure`,
          pending: `${BASE_URL}?type=course&courseId=${courseId}&status=pending`
        },
        auto_return: 'approved',
        metadata: { type: 'course', courseId, studentId, teacherId, price }
      };

    } else {
      return res.status(400).json({ error: 'Tipo de preferencia inválido.' });
    }

    const preference = await preferenceClient.create({ body });

    res.json({
      id:                 preference.id,
      init_point:         preference.init_point,
      sandbox_init_point: preference.sandbox_init_point
    });

  } catch (err) {
    console.error('Error MP:', err);
    res.status(500).json({ error: 'No se pudo crear la preferencia de pago.' });
  }
});

// ─── Webhook: notificaciones de pago ────────────────────────
app.post('/api/webhook', async (req, res) => {
  const xSignature   = req.headers['x-signature'];
  const xRequestId   = req.headers['x-request-id'];
  const { type, data } = req.body;

  // Validar firma
  if (xSignature && xRequestId && process.env.MP_WEBHOOK_SECRET) {
    const [tsPart, v1Part] = xSignature.split(',');
    const ts = tsPart?.split('=')[1];
    const v1 = v1Part?.split('=')[1];
    const manifest = `id:${data?.id};request-id:${xRequestId};ts:${ts};`;
    const expected = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
      .update(manifest).digest('hex');
    if (expected !== v1) {
      console.warn('[Webhook] Firma inválida');
      return res.sendStatus(401);
    }
  }

  res.sendStatus(200);

  if (type === 'payment' && data?.id) {
    try {
      const payment = await paymentClient.get({ id: data.id });
      console.log(`[Webhook] Pago ${payment.id} — status: ${payment.status}`);
    } catch (err) {
      console.error('[Webhook] Error al obtener pago:', err);
    }
  }
});

// ─── Fallback: todas las rutas sirven el index ────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Arrancar ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
