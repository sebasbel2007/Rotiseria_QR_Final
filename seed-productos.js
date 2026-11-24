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

  async function main() {
    // 1. Agregar categoría 'Extras' al config/categorias
    const catSnap = await db.collection('config').doc('categorias').get();
    const cats = catSnap.exists ? catSnap.data().lista : [
      { nombre: 'Pollos',       visible: true },
      { nombre: 'Milanesas',    visible: true },
      { nombre: 'Guarniciones', visible: true },
      { nombre: 'Empanadas',    visible: true },
      { nombre: 'Bebidas',      visible: true },
    ];

    // Agregamos 'Extras' si no existe
    if (!cats.some(c => c.nombre === 'Extras')) {
      cats.push({ nombre: 'Extras', visible: true });
    }

    await db.collection('config').doc('categorias').set({ lista: cats });
    console.log('✅ Categoría "Extras" agregada');

    // 2. Definir 5 productos por categoría con variantes realistas
    const productosPorCategoria = {
      Pollos: [
        { nombre: 'Medallón de Pollo', descripcion: 'Pecho de pollo a la parrilla', precio: 2500, tiempo: 15, variantes: ['Simple', 'Doble', 'Triple'] },
        { nombre: 'Muslo Pollo', descripcion: 'Muslo completo con hueso', precio: 2000, tiempo: 20, variantes: ['Unidad', 'Media Docena', 'Docena'] },
        { nombre: 'Pernil Desmenuzado', descripcion: 'Pernil desmenuzado al fuego', precio: 3200, tiempo: 30, variantes: ['Porción 1kg', 'Porción 2kg', 'Porción 3kg'] },
        { nombre: 'Alitas Glaseadas', descripcion: 'Alitas con salsa glaseada dulces', precio: 1800, tiempo: 12, variantes: ['5 unidades', '10 unidades', '15 unidades'] },
        { nombre: 'Nuggets Croccantes', descripcion: 'Nuggets de pollo empanados', precio: 1500, tiempo: 10, variantes: ['Cantidad 1', 'Cantidad 2', 'Cantidad 3'] },
      ],
      Milanesas: [
        { nombre: 'Milanesas de Pollo', descripcion: 'Pollo empanado y frito', precio: 2200, tiempo: 15, variantes: ['Simple', 'Con jamón y queso', 'Especial'] },
        { nombre: 'Milanesas de Carne', descripcion: 'Carne empanada y frita', precio: 2800, tiempo: 20, variantes: ['Simple', 'Con jamón y queso', 'Napolitana'] },
        { nombre: 'Milanesas Dobles', descripcion: 'Dos milanesas en un solo plato', precio: 4500, tiempo: 25, variantes: ['Con pure', 'Con ensalada', 'Con french'] },
        { nombre: 'Milanesas a la Napolitana', descripcion: 'Con salsa tomate, jamón y queso', precio: 3000, tiempo: 20, variantes: ['Pollo', 'Carne'] },
        { nombre: 'Milanesas al Buda', descripcion: 'Con verduras y salsa especial', precio: 3200, tiempo: 25, variantes: ['Pollo', 'Carne'] },
      ],
      Guarniciones: [
        { nombre: 'Papas Fritas', descripcion: 'Papas fritas caseras', precio: 800, tiempo: 8, variantes: ['Pequeña', 'Mediana', 'Grande'] },
        { nombre: 'Puré de Papas', descripcion: 'Puré cremoso con leche', precio: 600, tiempo: 5, variantes: ['Porción simple', 'Con queso', 'Con jamón'] },
        { nombre: 'Ensalada Mixta', descripcion: 'Verduras frescas de temporada', precio: 500, tiempo: 5, variantes: ['Pequeña', 'Mediana', 'Familiar'] },
        { nombre: 'Arroz Blanco', descripcion: 'Arroz suelto con especias', precio: 400, tiempo: 5, variantes: ['Individual', 'Doble', 'Para compartir'] },
        { nombre: 'Purei de Zapallo', descripcion: 'Zapollo cocido y aplastado', precio: 550, tiempo: 6, variantes: ['Simple', 'Con crema', 'Con tocino'] },
      ],
      Empanadas: [
        { nombre: 'Empanadas de Carne', descripcion: 'Carne con cebolla y especias', precio: 350, tiempo: 10, variantes: ['x3', 'x6', 'x12'] },
        { nombre: 'Empanadas de Pollo', descripcion: 'Pollo con verduras y especias', precio: 350, tiempo: 10, variantes: ['x3', 'x6', 'x12'] },
        { nombre: 'Empanadas de Jamón y Queso', descripcion: 'Clásicas con jamón y mozzarella', precio: 380, tiempo: 10, variantes: ['x3', 'x6', 'x12'] },
        { nombre: 'Empanadas de Verduras', descripcion: 'Mix de verduras y cebolla', precio: 350, tiempo: 10, variantes: ['x3', 'x6', 'x12'] },
        { nombre: 'Empanadas de Crema de Papa', descripcion: 'Cremosas con papas y cebolla', precio: 370, tiempo: 10, variantes: ['x3', 'x6', 'x12'] },
      ],
      Bebidas: [
        { nombre: 'Coca-Cola 500ml', descripcion: 'Refresco de cola', precio: 200, tiempo: 2, variantes: ['Unidad', 'Doble', 'Familiar'] },
        { nombre: 'Agua Mineral', descripcion: 'Agua natural 500ml', precio: 150, tiempo: 2, variantes: ['Unidad', 'Doble', 'Familiar'] },
        { nombre: 'Fanta Naranja', descripcion: 'Refresco de naranja', precio: 200, tiempo: 2, variantes: ['Unidad', 'Doble', 'Familiar'] },
        { nombre: 'Cerveza Artesanal', descripcion: 'Cerveza local 500ml', precio: 400, tiempo: 3, variantes: ['Unidad', 'Doble', 'Promo 3'] },
        { nombre: 'Limonada Casera', descripcion: 'Limón fresco con azúcar', precio: 180, tiempo: 2, variantes: ['Unidad', 'Doble', 'Para compartir'] },
      ],
      Extras: [
        { nombre: 'Más Papas Fritas', descripcion: 'Porción adicional de papas', precio: 600, tiempo: 5, variantes: ['Porción simple', 'Doble', 'Familiar'] },
        { nombre: 'Más Empanadas', descripcion: '2 empanadas adicionales', precio: 700, tiempo: 5, variantes: ['2 uds', '4 uds', '6 uds'] },
        { nombre: 'Más Milanesas', descripcion: '2 milanesas adicionales', precio: 900, tiempo: 8, variantes: ['2 uds', '4 uds', '6 uds'] },
        { nombre: 'Salsa Especial', descripcion: 'Salsa secreta para acompañar', precio: 150, tiempo: 1, variantes: ['Small', 'Medium', 'Large'] },
        { nombre: 'Pan Blanco', descripcion: 'Pan fresco para la mesa', precio: 100, tiempo: 1, variantes: ['Unidad', 'Docena', 'Medio Docena'] },
      ]
    };

    // 3. Crear productos en Firestore
    const categorias = cats.map(c => c.nombre);
    const batch = db.batch();
    let count = 0;

    for (const cat of categorias) {
      const productos = productosPorCategoria[cat] || [];
      for (const prod of productos) {
        const ref = db.collection('productos').doc();
        const datos = {
          nombre: prod.nombre,
          descripcion: prod.descripcion,
          precio: prod.precio,
          categoria: cat,
          url_foto: '',
          tiempo_preparacion_min: prod.tiempo,
          estado: 'Disponible',
          composicion: [],
          variantes: prod.variantes.map(v => ({ nombre: v, extra_precio: 0 }))
        };
        batch.set(ref, datos);
        count++;
      }
    }

    await batch.commit();
    console.log('✅ Creamos', count, 'productos con variantes realistas');

    // Resumen
    console.log('\nResumen de categorías y productos:');
    for (const cat of categorias) {
      const prods = productosPorCategoria[cat] || [];
      console.log('  - ' + cat + ':', prods.length, 'productos');
    }

    await admin.app().delete();
    console.log('\n🎉 Seed de productos completado');
  }

  main().catch(e => {
    console.error('Error fatal:', e.message);
    process.exit(1);
  });
})();