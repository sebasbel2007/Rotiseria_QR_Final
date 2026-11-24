const admin = require('firebase-admin');

let serviceAccount;
try {
  serviceAccount = require('./serviceAccountKey.json');
} catch (e) {
  console.error('No se encontró serviceAccountKey.json');
  console.error('Pegá tu clave de Firebase Console → Configuración del proyecto → Cuentas de servicio');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

async function testConnection() {
  console.log('=== Test de conexión ===');
  console.log(`Proyecto: ${serviceAccount.project_id}`);
  console.log(`Email: ${serviceAccount.client_email}\n`);

  try {
    const collections = await db.listCollections();
    const names = collections.map(c => c.id);
    console.log(`Colecciones: ${names.length > 0 ? names.join(', ') : '(vacías)'}\n`);
    return true;
  } catch (e) {
    console.error('Error de conexión:', e.message);
    return false;
  }
}

async function seedConfig() {
  console.log('=== Seed: config/sistema ===');
  try {
    await db.doc('config/sistema').set({
      nombre: 'Rotisería SYM',
      hash_supervisor: 'supervisor666',
      zonas: ['Salón', 'Pateo'],
      recargo_delivery_pct: 15,
      timeout_caja_min: 5,
      timeout_pendiente_min: 5,
      timeout_sPedido_min: 15,
      factura: {
        razon_social: 'Rotisería SYM',
        titular: 'Sebastian Beltran',
        cuit: '20-12345678-9',
        domicilio: 'Av. Principal 123, Buenos Aires',
        iva: 'Responsable Inscripto',
       cae: '00000000000000'
      }
    }, { merge: true });
    console.log('✅ config/sistema creado\n');
  } catch (e) {
    console.error('Error:', e.message);
  }
}

async function seedMesas() {
  console.log('=== Seed: mesas (6 de prueba) ===');
  const mesas = [
    { numero: 1, zona: 'Salón', capacidad: 4, tamano: '1x1', activa: true },
    { numero: 2, zona: 'Salón', capacidad: 4, tamano: '1x1', activa: true },
    { numero: 3, zona: 'Salón', capacidad: 6, tamano: '1x2', activa: true },
    { numero: 4, zona: 'Salón', capacidad: 4, tamano: '1x1', activa: true },
    { numero: 5, zona: 'Pateo', capacidad: 4, tamano: '1x1', activa: true },
    { numero: 6, zona: 'Pateo', capacidad: 4, tamano: '1x1', activa: true }
  ];
  try {
    const batch = db.batch();
    for (const m of mesas) {
      const ref = db.doc(`mesas/${m.numero}`);
      batch.set(ref, m, { merge: true });
    }
    await batch.commit();
    console.log(`✅ ${mesas.length} mesas creadas\n`);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

async function seedStaffUsers() {
  console.log('=== Seed: usuarios staff ===');
  const users = [
    { email: 'cajero@rotiseria.com', pass: 'Cajero2026', rol: 'cajero', nombre: 'Cajero' },
    { email: 'cocina@rotiseria.com', pass: 'Cocina2026', rol: 'cocina', nombre: 'Cocina' },
    { email: 'admin@rotiseria.com', pass: 'Admin2026', rol: 'admin', nombre: 'Admin' },
    { email: '.comtv@gmail', pass: 'tv1234', rol: 'tv', nombre: 'TV Lobby' }
  ];

  for (const u of users) {
    try {
      const userRecord = await auth.createUser({
        email: u.email,
        password: u.pass,
        displayName: u.nombre,
        disabled: false
      });
      await db.doc(`users/${userRecord.uid}`).set({
        email: u.email,
        nombre: u.nombre,
        rol: u.rol,
        activo: true,
        fecha_creacion: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      console.log(`  ✅ ${u.rol}: ${u.email}`);
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        console.log(`  ⚠️  ${u.email} ya existe, actualizando rol...`);
        const user = await auth.getUserByEmail(u.email);
        await db.doc(`users/${user.uid}`).set({
          email: u.email,
          nombre: u.nombre,
          rol: u.rol,
          activo: true
        }, { merge: true });
      } else {
        console.error(`  ❌ ${u.email}: ${e.message}`);
      }
    }
  }
  console.log('');
}

async function main() {
  const ok = await testConnection();
  if (!ok) process.exit(1);

  const cmd = process.argv[2];

  if (cmd === 'seed-all') {
    await seedConfig();
    await seedMesas();
    await seedStaffUsers();
    console.log('🎉 Todo sembrado. Recordá publicar las reglas de Firestore.');
  } else if (cmd === 'test') {
    console.log('Conexión OK. Usá "node create-indexes.js seed-all" para sembrar datos.');
  } else {
    console.log('Uso:');
    console.log('  node create-indexes.js test       — Verificar conexión');
    console.log('  node create-indexes.js seed-all   — Sembrar config + mesas + usuarios staff');
  }

  await admin.app().delete();
}

main().catch(e => {
  console.error('Error fatal:', e.message);
  process.exit(1);
});
