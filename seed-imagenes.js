(() => {
  const admin = require('firebase-admin');

  let serviceAccount;
  try {
    serviceAccount = require('./serviceAccountKey.json');
  } catch (e) {
    console.error('No se encontró serviceAccountKey.json');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  const db = admin.firestore();

  const imagenesProductos = [
    // POLLOS
    { nombre: 'Medallón de Pollo', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Grilled_chicken.jpg/960px-Grilled_chicken.jpg' },
    { nombre: 'Muslo Pollo', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Chicken_leg.jpg/960px-Chicken_leg.jpg' },
    { nombre: 'Pernil Desmenuzado', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Pulled_pork.jpg/1280px-Pulled_pork.jpg' },
    { nombre: 'Alitas Glaseadas', url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Buffalo_wings-01.jpg' },
    { nombre: 'Nuggets Croccantes', url: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Chicken_McNuggets.jpg' },
    // MILANESAS
    { nombre: 'Milanesas de Pollo', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Wiener-Schnitzel02.jpg/1280px-Wiener-Schnitzel02.jpg' },
    { nombre: 'Milanesas de Carne', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Wiener-Schnitzel02.jpg/1280px-Wiener-Schnitzel02.jpg' },
    { nombre: 'Milanesas Dobles', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Wiener-Schnitzel02.jpg/1280px-Wiener-Schnitzel02.jpg' },
    { nombre: 'Milanesas a la Napolitana', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Milanesa_napolitana.jpg/1280px-Milanesa_napolitana.jpg' },
    { nombre: 'Milanesas al Buda', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Wiener-Schnitzel02.jpg/1280px-Wiener-Schnitzel02.jpg' },
    // GUARNICIONES
    { nombre: 'Papas Fritas', url: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/French_fries_20180827.jpg' },
    { nombre: 'Puré de Papas', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Mashed_potatoes.jpg/1280px-Mashed_potatoes.jpg' },
    { nombre: 'Ensalada Mixta', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Salad_01.jpg/1280px-Salad_01.jpg' },
    { nombre: 'Arroz Blanco', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a3/White_rice.jpg' },
    { nombre: 'Purei de Zapallo', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Mashed_potatoes.jpg/1280px-Mashed_potatoes.jpg' },
    // EMPANADAS
    { nombre: 'Empanadas de Carne', url: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Empanadas_de_carne%2C_2006.jpg' },
    { nombre: 'Empanadas de Pollo', url: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Empanada.jpg' },
    { nombre: 'Empanadas de Jamón y Queso', url: 'https://upload.wikimedia.org/wikipedia/commons/1/18/Empanadas_argentinas_fritas.jpg' },
    { nombre: 'Empanadas de Verduras', url: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Empanada.jpg' },
    { nombre: 'Empanadas de Crema de Papa', url: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Empanadas_de_carne%2C_2006.jpg' },
    // BEBIDAS
    { nombre: 'Coca-Cola 500ml', url: 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Coca-Cola_bottle.jpg' },
    { nombre: 'Agua Mineral', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Bottled_water.jpg/960px-Bottled_water.jpg' },
    { nombre: 'Fanta Naranja', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Fanta_Orange.jpg/960px-Fanta_Orange.jpg' },
    { nombre: 'Cerveza Artesanal', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Cerveza_artesanal.jpg/960px-Cerveza_artesanal.jpg' },
    { nombre: 'Limonada Casera', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Lemonade.jpg/960px-Lemonade.jpg' },
    // EXTRAS
    { nombre: 'Más Papas Fritas', url: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/French_fries_20180827.jpg' },
    { nombre: 'Más Empanadas', url: 'https://upload.wikimedia.org/wikipedia/commons/1/18/Empanadas_argentinas_fritas.jpg' },
    { nombre: 'Más Milanesas', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Wiener-Schnitzel02.jpg/1280px-Wiener-Schnitzel02.jpg' },
    { nombre: 'Salsa Especial', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Chimichurri_Sauce_Recipe_%2813294659804%29.jpg/1280px-Chimichurri_Sauce_Recipe_%2813294659804%29.jpg' },
    { nombre: 'Pan Blanco', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Bread_loaf.jpg/1280px-Bread_loaf.jpg' }
  ];

  async function main() {
    console.log('🔄 Actualizando URLs de productos...');

    const productosRef = db.collection('productos');
    const snap = await productosRef.get();

    let actualizados = 0;
    const docs = snap.docs;

    const productosMap = new Map();
    docs.forEach(doc => {
      const data = doc.data();
      if (data.nombre) {
        const key = (data.nombre + ' ' + data.categoria).toLowerCase();
        productosMap.set(key, doc.id);
      }
    });

    const batchSize = 10;
    for (let i = 0; i < imagenesProductos.length; i += batchSize) {
      const batch = db.batch();
      const chunk = imagenesProductos.slice(i, i + batchSize);

      for (const img of chunk) {
        const key = img.nombre.toLowerCase();
        let docId = null;

        for (const [keyMap, id] of productosMap) {
          if (keyMap.includes(key)) {
            docId = id;
            break;
          }
        }

        if (docId) {
          batch.update(db.collection('productos').doc(docId), { url_foto: img.url });
          actualizados++;
          console.log('  ✅ ' + img.nombre);
        } else {
          console.log('  ⚠ No encontrado: ' + img.nombre);
        }
      }

      await batch.commit();
      console.log('   Lote ' + (Math.floor(i / batchSize) + 1) + ' guardado');
    }

    console.log('\n🎉 Total actualizados: ' + actualizados + '/' + imagenesProductos.length);

    await admin.app().delete();
    console.log('🏁 Finalizado');
  }

  main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
})();