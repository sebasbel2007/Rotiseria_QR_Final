// js/seed.js
// USO: Abrir consola del navegador (F12) y ejecutar: seedProductos()
// ADVERTENCIA: Solo ejecutar una vez. Crea productos nuevos cada vez.
(() => {

  async function seedProductos() {
    const productos = [
      // ── Pollos ──────────────────────────────────────────────
      {
        nombre: 'Pollo Entero al Spiedo',
        descripcion: 'Pollo entero cocido a la brasa, jugoso y crocante por fuera.',
        precio: 8500, categoria: 'Pollos',
        url_foto: 'https://images.unsplash.com/photo-1598103442097-8b74394b95c3?w=400',
        tiempo_preparacion_min: 45, estado: 'Disponible',
        composicion: ['Pollo', 'Condimentos', 'Limón'],
        variantes: [{ nombre: 'Con papas fritas', extra_precio: 1500 }, { nombre: 'Con ensalada', extra_precio: 800 }]
      },
      {
        nombre: 'Medio Pollo al Spiedo',
        descripcion: 'Media unidad de pollo al spiedo, ideal para una persona.',
        precio: 4500, categoria: 'Pollos',
        url_foto: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=400',
        tiempo_preparacion_min: 20, estado: 'Disponible',
        composicion: ['Pollo', 'Condimentos'],
        variantes: [{ nombre: 'Con papas fritas', extra_precio: 1500 }]
      },
      {
        nombre: 'Pollo al Horno con Papas',
        descripcion: 'Pollo al horno con papas doradas y hierbas aromáticas.',
        precio: 9200, categoria: 'Pollos',
        url_foto: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400',
        tiempo_preparacion_min: 50, estado: 'Disponible',
        composicion: ['Pollo', 'Papas', 'Romero', 'Ajo'], variantes: []
      },
      // ── Milanesas ────────────────────────────────────────────
      {
        nombre: 'Milanesa de Ternera',
        descripcion: 'Milanesa de ternera clásica, apanada y frita.',
        precio: 5800, categoria: 'Milanesas',
        url_foto: 'https://images.unsplash.com/photo-1585325701956-60dd9c8553bc?w=400',
        tiempo_preparacion_min: 15, estado: 'Disponible',
        composicion: ['Ternera', 'Pan rallado', 'Huevo'],
        variantes: [{ nombre: 'A la napolitana', extra_precio: 700 }, { nombre: 'A caballo', extra_precio: 600 }]
      },
      {
        nombre: 'Milanesa de Pollo',
        descripcion: 'Pechuga de pollo apanada, tierna y jugosa.',
        precio: 5200, categoria: 'Milanesas',
        url_foto: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=400',
        tiempo_preparacion_min: 12, estado: 'Disponible',
        composicion: ['Pollo', 'Pan rallado', 'Huevo'],
        variantes: [{ nombre: 'A la napolitana', extra_precio: 700 }]
      },
      {
        nombre: 'Suprema de Pollo',
        descripcion: 'Suprema rellena con jamón y queso, apanada.',
        precio: 6500, categoria: 'Milanesas',
        url_foto: 'https://images.unsplash.com/photo-1559847844-5315695dadae?w=400',
        tiempo_preparacion_min: 18, estado: 'Disponible',
        composicion: ['Pollo', 'Jamón', 'Queso', 'Pan rallado'], variantes: []
      },
      // ── Guarniciones ─────────────────────────────────────────
      {
        nombre: 'Papas Fritas',
        descripcion: 'Papas fritas crocantes, porción generosa.',
        precio: 2200, categoria: 'Guarniciones',
        url_foto: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400',
        tiempo_preparacion_min: 10, estado: 'Disponible',
        composicion: ['Papa', 'Aceite', 'Sal'],
        variantes: [{ nombre: 'Con cheddar', extra_precio: 400 }, { nombre: 'Con cheddar y panceta', extra_precio: 700 }]
      },
      {
        nombre: 'Ensalada Mixta',
        descripcion: 'Lechuga, tomate, zanahoria y cebolla.',
        precio: 1800, categoria: 'Guarniciones',
        url_foto: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
        tiempo_preparacion_min: 5, estado: 'Disponible',
        composicion: ['Lechuga', 'Tomate', 'Zanahoria', 'Cebolla'], variantes: []
      },
      {
        nombre: 'Puré de Papas',
        descripcion: 'Puré casero cremoso con manteca y leche.',
        precio: 1900, categoria: 'Guarniciones',
        url_foto: 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=400',
        tiempo_preparacion_min: 8, estado: 'Disponible',
        composicion: ['Papa', 'Manteca', 'Leche', 'Sal'], variantes: []
      },
      // ── Empanadas ────────────────────────────────────────────
      {
        nombre: 'Empanada de Carne',
        descripcion: 'Empanada de carne cortada a cuchillo, jugosa y sabrosa.',
        precio: 850, categoria: 'Empanadas',
        url_foto: 'https://images.unsplash.com/photo-1604467794349-0b74285de7e7?w=400',
        tiempo_preparacion_min: 5, estado: 'Disponible',
        composicion: ['Carne', 'Cebolla', 'Huevo duro', 'Aceitunas'],
        variantes: [{ nombre: 'Docena (x12)', extra_precio: 1200 }]
      },
      {
        nombre: 'Empanada de Pollo',
        descripcion: 'Empanada de pollo con morrón y especias.',
        precio: 800, categoria: 'Empanadas',
        url_foto: 'https://images.unsplash.com/photo-1604467794349-0b74285de7e7?w=400',
        tiempo_preparacion_min: 5, estado: 'Disponible',
        composicion: ['Pollo', 'Morrón', 'Cebolla', 'Especias'], variantes: []
      },
      {
        nombre: 'Empanada de Jamón y Queso',
        descripcion: 'Clásica empanada de jamón y queso derretido.',
        precio: 780, categoria: 'Empanadas',
        url_foto: 'https://images.unsplash.com/photo-1604467794349-0b74285de7e7?w=400',
        tiempo_preparacion_min: 5, estado: 'Disponible',
        composicion: ['Jamón', 'Queso'], variantes: []
      },
      // ── Bebidas ──────────────────────────────────────────────
      {
        nombre: 'Coca-Cola',
        descripcion: 'Botella 500ml fría.',
        precio: 1200, categoria: 'Bebidas',
        url_foto: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400',
        tiempo_preparacion_min: 1, estado: 'Disponible',
        composicion: [], variantes: [{ nombre: '1.5L', extra_precio: 600 }]
      },
      {
        nombre: 'Agua Mineral',
        descripcion: 'Agua mineral sin gas 500ml.',
        precio: 800, categoria: 'Bebidas',
        url_foto: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400',
        tiempo_preparacion_min: 1, estado: 'Disponible',
        composicion: [], variantes: [{ nombre: 'Con gas', extra_precio: 0 }]
      },
      {
        nombre: 'Jugo Natural',
        descripcion: 'Jugo de naranja exprimido al momento.',
        precio: 1500, categoria: 'Bebidas',
        url_foto: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400',
        tiempo_preparacion_min: 3, estado: 'Disponible',
        composicion: ['Naranja'], variantes: []
      }
    ];

    console.log('🌱 Cargando productos...');
    for (const p of productos) {
      await db.collection('productos').add({ ...p, archivado: false });
      console.log(`  ✅ ${p.nombre}`);
    }
    console.log(`\n✅ Seed completado — ${productos.length} productos cargados.`);
  }

  // ── Seed de mesas (testing inicial) ────────────────────────
  // 6 mesas, 2 zonas, tamaños mixtos
  // Llamar desde consola: seedMesas()
  async function seedMesas() {
    const mesas = [
      // Salón: 4 mesas
      { numero: '1', zona: 'Salón',  tamaño: '1x1', pos_x: 0, pos_y: 0 },
      { numero: '2', zona: 'Salón',  tamaño: '1x1', pos_x: 1, pos_y: 0 },
      { numero: '3', zona: 'Salón',  tamaño: '1x2', pos_x: 2, pos_y: 0 },
      { numero: '4', zona: 'Salón',  tamaño: '2x2', pos_x: 0, pos_y: 1 },
      // Pateo: 2 mesas
      { numero: '5', zona: 'Pateo',  tamaño: '1x1', pos_x: 0, pos_y: 0 },
      { numero: '6', zona: 'Pateo',  tamaño: '1x2', pos_x: 1, pos_y: 0 },
    ];

    const capacidades = { '1x1': 4, '1x2': 6, '2x1': 6, '2x2': 8 };

    console.log('🌱 Cargando mesas...');
    for (const m of mesas) {
      await db.collection('mesas').add({
        numero:     m.numero,
        zona:       m.zona,
        tamaño:     m.tamaño,
        capacidad:  capacidades[m.tamaño],
        pos_x:      m.pos_x,
        pos_y:      m.pos_y,
        activa:     true,
        merge_con:  null,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
        updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  ✅ Mesa ${m.numero} (${m.zona} — ${m.tamaño})`);
    }

    // Crear config/sistema si no existe
    const configSnap = await db.collection('config').doc('sistema').get();
    if (!configSnap.exists) {
      await db.collection('config').doc('sistema').set({
        supervisor_hash:        'b3c4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4',
        timeout_caja_min:       5,
        timeout_sin_pedido_min: 15,
        tv_historial_max:       10,
        recargo_delivery_pct:   15,
      });
      console.log('  ✅ config/sistema creado');
    } else {
      console.log('  ℹ️ config/sistema ya existe, no se sobreescribe');
    }

    console.log(`
✅ Seed mesas completado — 6 mesas cargadas.`);
    console.log('⚠️  Recordá crear los 5 índices en Firebase Console (ver documentacion/indices-firestore.txt)');
  }

  window.seedProductos = seedProductos;
  window.seedMesas     = seedMesas;

})();
