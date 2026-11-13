// Catálogo de partidas por especialidad (Norma Técnica de Metrados, OE.2 a OE.5).
// Cada partida trae unidad, rendimiento (und/día), cuadrilla y materiales por unidad.
// Todos los valores son REFERENCIALES: revísalos con tus análisis de costos unitarios.
// El usuario puede corregirlos en cada partida y guardar las suyas en "Mis partidas".

// Cuadrillas típicas: { capataz, operario, oficial, peon }
const PEON = { capataz: 0.1, operario: 0, oficial: 0, peon: 1 };
const ALBANIL = { capataz: 0.1, operario: 1, oficial: 0, peon: 0.5 };
const ACABADO = { capataz: 0.1, operario: 1, oficial: 0, peon: 0.5 };
const GASFITERO = { capataz: 0.1, operario: 1, oficial: 0, peon: 0.5 };
const ELECTRICISTA = { capataz: 0.1, operario: 1, oficial: 0.5, peon: 0 };

const m = (nombre, und, porUnidad) => ({ nombre, und, porUnidad });
const p = (esp, grupo, nombre, und, rend, cuadrilla, materiales = [], detalle) => ({ esp, grupo, nombre, und, rend, cuadrilla, materiales, ...(detalle ? { detalle } : {}) });
// Partida de accesorios: una fila por accesorio (N° veces = cuántos), cada fila va al pedido como material.
const acc = (esp, grupo, nombre, rend, cuadrilla, materiales, items) =>
  p(esp, grupo, nombre, 'und', rend, cuadrilla, materiales, items.map((desc) => ({ desc, veces: 0, largo: '', ancho: '', alto: '', material: true, und: 'und' })));

export const CATALOGO = [
  // ---------------- OE.2 Estructuras: obras preliminares y movimiento de tierras ----------------
  p('estructuras', 'Obras preliminares', 'Limpieza de terreno manual', 'm²', 60, PEON),
  p('estructuras', 'Obras preliminares', 'Trazo, nivelación y replanteo', 'm²', 250,
    { capataz: 0.1, operario: 1, oficial: 0, peon: 2 }, [m('Yeso', 'bls', 0.005), m('Estacas de madera', 'p²', 0.02)]),
  p('estructuras', 'Movimiento de tierras', 'Excavación de zanjas para cimientos (manual)', 'm³', 3.5, PEON),
  p('estructuras', 'Movimiento de tierras', 'Excavación para zapatas (manual)', 'm³', 3, PEON),
  p('estructuras', 'Movimiento de tierras', 'Refine y nivelación de zanjas', 'm²', 20, PEON),
  p('estructuras', 'Movimiento de tierras', 'Relleno compactado con material propio', 'm³', 8,
    { capataz: 0.1, operario: 0, oficial: 1, peon: 2 }, [m('Agua', 'm³', 0.05)]),
  p('estructuras', 'Movimiento de tierras', 'Eliminación de material excedente (manual, hasta 30 m)', 'm³', 6, PEON),
  p('estructuras', 'Movimiento de tierras', 'Eliminación de material con volquete', 'm³', 100,
    { capataz: 0, operario: 0, oficial: 0, peon: 1 }, [m('Volquete de 15 m³ (viaje)', 'und', 0.067)]),
  p('estructuras', 'Concreto simple', 'Solado e = 4", mezcla 1:12', 'm²', 100,
    { capataz: 0.2, operario: 2, oficial: 1, peon: 6 }, [m('Cemento Portland', 'bls', 0.25), m('Hormigón', 'm³', 0.11), m('Agua', 'm³', 0.02)]),

  // ---------------- OE.3 Arquitectura: revoques, pisos, pintura ----------------
  p('arquitectura', 'Revoques y enlucidos', 'Tarrajeo de muros interiores, mezcla 1:5, e = 1.5 cm', 'm²', 12, ALBANIL,
    [m('Cemento Portland', 'bls', 0.12), m('Arena fina', 'm³', 0.017), m('Agua', 'm³', 0.005)]),
  p('arquitectura', 'Revoques y enlucidos', 'Tarrajeo de muros exteriores, mezcla 1:5, e = 1.5 cm', 'm²', 10, ALBANIL,
    [m('Cemento Portland', 'bls', 0.12), m('Arena fina', 'm³', 0.017), m('Agua', 'm³', 0.005)]),
  p('arquitectura', 'Revoques y enlucidos', 'Tarrajeo de columnas y vigas', 'm²', 8, ALBANIL,
    [m('Cemento Portland', 'bls', 0.12), m('Arena fina', 'm³', 0.017), m('Agua', 'm³', 0.005)]),
  p('arquitectura', 'Revoques y enlucidos', 'Vestidura de derrames', 'm', 15, ALBANIL,
    [m('Cemento Portland', 'bls', 0.03), m('Arena fina', 'm³', 0.004)]),
  p('arquitectura', 'Cielorrasos', 'Cielorraso con mezcla 1:5', 'm²', 9, ALBANIL,
    [m('Cemento Portland', 'bls', 0.12), m('Arena fina', 'm³', 0.017), m('Agua', 'm³', 0.005)]),
  p('arquitectura', 'Pisos y pavimentos', 'Falso piso e = 4", mezcla 1:8', 'm²', 100,
    { capataz: 0.2, operario: 2, oficial: 1, peon: 6 }, [m('Cemento Portland', 'bls', 0.42), m('Hormigón', 'm³', 0.11), m('Agua', 'm³', 0.02)]),
  p('arquitectura', 'Pisos y pavimentos', 'Contrapiso e = 48 mm', 'm²', 100,
    { capataz: 0.2, operario: 2, oficial: 1, peon: 4 }, [m('Cemento Portland', 'bls', 0.24), m('Arena gruesa', 'm³', 0.04), m('Agua', 'm³', 0.01)]),
  p('arquitectura', 'Pisos y pavimentos', 'Piso de cerámico 45 × 45 cm', 'm²', 10, ACABADO,
    [m('Cerámico 45 × 45', 'm²', 1.05), m('Pegamento en polvo (25 kg)', 'bls', 0.2), m('Fragua', 'kg', 0.25)]),
  p('arquitectura', 'Pisos y pavimentos', 'Piso de porcelanato 60 × 60 cm', 'm²', 8, ACABADO,
    [m('Porcelanato 60 × 60', 'm²', 1.05), m('Pegamento para porcelanato (25 kg)', 'bls', 0.22), m('Fragua', 'kg', 0.2)]),
  p('arquitectura', 'Zócalos y contrazócalos', 'Zócalo de cerámico 30 × 60 cm', 'm²', 8, ACABADO,
    [m('Cerámico 30 × 60', 'm²', 1.05), m('Pegamento en polvo (25 kg)', 'bls', 0.2), m('Fragua', 'kg', 0.25)]),
  p('arquitectura', 'Zócalos y contrazócalos', 'Contrazócalo de cerámico h = 10 cm', 'm', 30, ACABADO,
    [m('Cerámico (contrazócalo)', 'm', 1.05), m('Pegamento en polvo (25 kg)', 'bls', 0.03)]),
  p('arquitectura', 'Pintura', 'Pintura látex en muros interiores (2 manos)', 'm²', 35,
    { capataz: 0.1, operario: 1, oficial: 0, peon: 0.25 }, [m('Pintura látex', 'gal', 0.07), m('Imprimante', 'gal', 0.04), m('Lija', 'pliego', 0.1)]),
  p('arquitectura', 'Pintura', 'Pintura látex en cielorrasos (2 manos)', 'm²', 30,
    { capataz: 0.1, operario: 1, oficial: 0, peon: 0.25 }, [m('Pintura látex', 'gal', 0.07), m('Imprimante', 'gal', 0.04), m('Lija', 'pliego', 0.1)]),
  p('arquitectura', 'Pintura', 'Pintura de muros exteriores (2 manos)', 'm²', 30,
    { capataz: 0.1, operario: 1, oficial: 0, peon: 0.25 }, [m('Pintura látex para exteriores', 'gal', 0.08), m('Imprimante', 'gal', 0.04)]),
  p('arquitectura', 'Carpintería', 'Puerta contraplacada (suministro y colocación)', 'und', 2,
    { capataz: 0, operario: 1, oficial: 0, peon: 0.5 }, [m('Puerta contraplacada con marco', 'und', 1), m('Bisagra capuchina 3½"', 'und', 3)]),
  p('arquitectura', 'Vidrios', 'Vidrio crudo incoloro 6 mm', 'p²', 60,
    { capataz: 0, operario: 1, oficial: 0, peon: 0 }, [m('Vidrio incoloro 6 mm', 'p²', 1.05), m('Silicona', 'und', 0.03)]),

  // ---------------- OE.4 Instalaciones sanitarias ----------------
  p('sanitarias', 'Aparatos sanitarios', 'Inodoro (suministro e instalación)', 'und', 4, GASFITERO,
    [m('Inodoro con accesorios', 'und', 1), m('Cinta teflón', 'und', 1), m('Pegamento PVC', 'gal', 0.02)]),
  p('sanitarias', 'Aparatos sanitarios', 'Lavatorio (suministro e instalación)', 'und', 5, GASFITERO,
    [m('Lavatorio con accesorios', 'und', 1), m('Cinta teflón', 'und', 1)]),
  p('sanitarias', 'Aparatos sanitarios', 'Lavadero de cocina (suministro e instalación)', 'und', 5, GASFITERO,
    [m('Lavadero de acero con grifería', 'und', 1), m('Cinta teflón', 'und', 1)]),
  p('sanitarias', 'Aparatos sanitarios', 'Ducha (suministro e instalación)', 'und', 6, GASFITERO,
    [m('Ducha con mezcladora', 'und', 1), m('Cinta teflón', 'und', 1)]),
  p('sanitarias', 'Salidas de agua', 'Salida de agua fría PVC 1/2"', 'pto', 8, GASFITERO,
    [m('Tubo PVC C-10 1/2" × 5 m', 'und', 0.6), m('Codo PVC 1/2" × 90°', 'und', 3), m('Tee PVC 1/2"', 'und', 1), m('Pegamento PVC', 'gal', 0.01), m('Cinta teflón', 'und', 0.5)]),
  p('sanitarias', 'Salidas de agua', 'Salida de agua caliente CPVC 1/2"', 'pto', 6, GASFITERO,
    [m('Tubo CPVC 1/2" × 5 m', 'und', 0.6), m('Codo CPVC 1/2" × 90°', 'und', 3), m('Tee CPVC 1/2"', 'und', 1), m('Pegamento CPVC', 'gal', 0.01)]),
  p('sanitarias', 'Redes de agua', 'Red de distribución de agua PVC 1/2"', 'm', 40, GASFITERO,
    [m('Tubo PVC C-10 1/2" × 5 m', 'und', 0.21), m('Pegamento PVC', 'gal', 0.002)]),
  p('sanitarias', 'Redes de agua', 'Red de distribución de agua PVC 3/4"', 'm', 35, GASFITERO,
    [m('Tubo PVC C-10 3/4" × 5 m', 'und', 0.21), m('Pegamento PVC', 'gal', 0.003)]),
  p('sanitarias', 'Redes de agua', 'Válvula compuerta de bronce 1/2"', 'und', 12, GASFITERO,
    [m('Válvula compuerta 1/2"', 'und', 1), m('Unión universal PVC 1/2"', 'und', 2), m('Cinta teflón', 'und', 1)]),
  acc('sanitarias', 'Redes de agua', 'Accesorios de redes de agua (codos, tees, uniones…)', 20, GASFITERO,
    [m('Pegamento PVC', 'gal', 0.003), m('Cinta teflón', 'und', 0.2)],
    ['Codo PVC 1/2" × 90°', 'Codo PVC 3/4" × 90°', 'Codo PVC 1/2" × 45°', 'Tee PVC 1/2"', 'Tee PVC 3/4"', 'Reducción PVC 3/4" a 1/2"',
      'Unión simple PVC 1/2"', 'Unión universal PVC 1/2"', 'Adaptador UPR PVC 1/2"', 'Niple PVC 1/2"', 'Tapón PVC 1/2" (prueba)']),
  p('sanitarias', 'Salidas de desagüe', 'Salida de desagüe PVC 2"', 'pto', 8, GASFITERO,
    [m('Tubo PVC SAL 2" × 3 m', 'und', 0.7), m('Codo PVC SAL 2" × 90°', 'und', 1), m('Yee PVC SAL 2"', 'und', 1), m('Pegamento PVC', 'gal', 0.015)]),
  p('sanitarias', 'Salidas de desagüe', 'Salida de desagüe PVC 4"', 'pto', 6, GASFITERO,
    [m('Tubo PVC SAL 4" × 3 m', 'und', 0.7), m('Codo PVC SAL 4" × 90°', 'und', 1), m('Yee PVC SAL 4"', 'und', 1), m('Pegamento PVC', 'gal', 0.025)]),
  p('sanitarias', 'Salidas de desagüe', 'Salida de ventilación PVC 2"', 'pto', 8, GASFITERO,
    [m('Tubo PVC SAL 2" × 3 m', 'und', 0.8), m('Sombrero de ventilación 2"', 'und', 1), m('Pegamento PVC', 'gal', 0.01)]),
  p('sanitarias', 'Redes de desagüe', 'Red colectora de desagüe PVC 4"', 'm', 25, GASFITERO,
    [m('Tubo PVC SAL 4" × 3 m', 'und', 0.35), m('Pegamento PVC', 'gal', 0.006)]),
  p('sanitarias', 'Redes de desagüe', 'Red de desagüe PVC 2"', 'm', 30, GASFITERO,
    [m('Tubo PVC SAL 2" × 3 m', 'und', 0.35), m('Pegamento PVC', 'gal', 0.004)]),
  acc('sanitarias', 'Redes de desagüe', 'Accesorios de redes de desagüe (codos, yees, tees…)', 15, GASFITERO,
    [m('Pegamento PVC', 'gal', 0.008)],
    ['Codo PVC SAL 4" × 90°', 'Codo PVC SAL 4" × 45°', 'Codo PVC SAL 2" × 90°', 'Codo PVC SAL 2" × 45°', 'Yee PVC SAL 4"',
      'Yee PVC SAL 4" × 2"', 'Yee PVC SAL 2"', 'Tee sanitaria PVC 2"', 'Reducción PVC SAL 4" a 2"', 'Trampa "P" PVC 2"']),
  p('sanitarias', 'Accesorios de desagüe', 'Caja de registro de concreto 12" × 24"', 'und', 2,
    { capataz: 0.1, operario: 1, oficial: 0, peon: 1 }, [m('Caja de registro 12" × 24" con tapa', 'und', 1), m('Cemento Portland', 'bls', 0.3), m('Arena gruesa', 'm³', 0.03)]),
  p('sanitarias', 'Accesorios de desagüe', 'Sumidero de bronce 2"', 'und', 12, GASFITERO,
    [m('Sumidero de bronce 2"', 'und', 1)]),
  p('sanitarias', 'Accesorios de desagüe', 'Registro roscado de bronce 4"', 'und', 12, GASFITERO,
    [m('Registro roscado de bronce 4"', 'und', 1)]),

  // ---------------- OE.5 Instalaciones eléctricas ----------------
  p('electricas', 'Salidas', 'Salida para centro de luz (techo)', 'pto', 8, ELECTRICISTA,
    [m('Caja octogonal F°G° 4"', 'und', 1), m('Tubo PVC SEL 3/4" × 3 m', 'und', 1), m('Curva PVC SEL 3/4"', 'und', 1), m('Conductor THW 2.5 mm²', 'm', 10), m('Cinta aislante', 'und', 0.1)]),
  p('electricas', 'Salidas', 'Salida para braquete (pared)', 'pto', 8, ELECTRICISTA,
    [m('Caja octogonal F°G° 4"', 'und', 1), m('Tubo PVC SEL 3/4" × 3 m', 'und', 1), m('Conductor THW 2.5 mm²', 'm', 9), m('Cinta aislante', 'und', 0.1)]),
  p('electricas', 'Salidas', 'Salida para interruptor simple', 'pto', 10, ELECTRICISTA,
    [m('Caja rectangular F°G° 4" × 2"', 'und', 1), m('Tubo PVC SEL 3/4" × 3 m', 'und', 1), m('Conductor THW 2.5 mm²', 'm', 6), m('Interruptor simple', 'und', 1)]),
  p('electricas', 'Salidas', 'Salida para interruptor doble', 'pto', 10, ELECTRICISTA,
    [m('Caja rectangular F°G° 4" × 2"', 'und', 1), m('Tubo PVC SEL 3/4" × 3 m', 'und', 1), m('Conductor THW 2.5 mm²', 'm', 8), m('Interruptor doble', 'und', 1)]),
  p('electricas', 'Salidas', 'Salida para interruptor de conmutación', 'pto', 8, ELECTRICISTA,
    [m('Caja rectangular F°G° 4" × 2"', 'und', 1), m('Tubo PVC SEL 3/4" × 3 m', 'und', 1.5), m('Conductor THW 2.5 mm²', 'm', 10), m('Interruptor de conmutación', 'und', 1)]),
  p('electricas', 'Salidas', 'Salida para tomacorriente doble con línea a tierra', 'pto', 8, ELECTRICISTA,
    [m('Caja rectangular F°G° 4" × 2"', 'und', 1), m('Tubo PVC SEL 3/4" × 3 m', 'und', 1), m('Conductor THW 2.5 mm²', 'm', 9), m('Conductor desnudo 2.5 mm² (tierra)', 'm', 4.5), m('Tomacorriente doble con L.T.', 'und', 1)]),
  p('electricas', 'Salidas', 'Salida para cocina eléctrica / terma', 'pto', 6, ELECTRICISTA,
    [m('Caja rectangular F°G° 4" × 2"', 'und', 1), m('Tubo PVC SEL 3/4" × 3 m', 'und', 1.5), m('Conductor THW 4 mm²', 'm', 12), m('Tomacorriente de fuerza', 'und', 1)]),
  p('electricas', 'Salidas', 'Salida para TV / cable', 'pto', 10, ELECTRICISTA,
    [m('Caja rectangular F°G° 4" × 2"', 'und', 1), m('Tubo PVC SEL 3/4" × 3 m', 'und', 1), m('Cable coaxial RG-6', 'm', 8), m('Placa para TV', 'und', 1)]),
  p('electricas', 'Salidas', 'Salida para teléfono / datos', 'pto', 10, ELECTRICISTA,
    [m('Caja rectangular F°G° 4" × 2"', 'und', 1), m('Tubo PVC SEL 3/4" × 3 m', 'und', 1), m('Cable UTP Cat 6', 'm', 8), m('Placa con conector RJ45', 'und', 1)]),
  p('electricas', 'Salidas', 'Salida para timbre', 'pto', 10, ELECTRICISTA,
    [m('Caja rectangular F°G° 4" × 2"', 'und', 1), m('Tubo PVC SEL 3/4" × 3 m', 'und', 1), m('Conductor THW 1.5 mm²', 'm', 8), m('Pulsador y timbre', 'und', 1)]),
  p('electricas', 'Canalizaciones y conductores', 'Tubería PVC SEL 3/4" empotrada', 'm', 60, ELECTRICISTA,
    [m('Tubo PVC SEL 3/4" × 3 m', 'und', 0.35), m('Curva PVC SEL 3/4"', 'und', 0.2)]),
  p('electricas', 'Canalizaciones y conductores', 'Tubería PVC SAP 1" (alimentador)', 'm', 40, ELECTRICISTA,
    [m('Tubo PVC SAP 1" × 3 m', 'und', 0.35), m('Curva PVC SAP 1"', 'und', 0.2), m('Pegamento PVC', 'gal', 0.002)]),
  acc('electricas', 'Canalizaciones y conductores', 'Cajas y accesorios de canalización', 25, ELECTRICISTA,
    [m('Pegamento PVC', 'gal', 0.002)],
    ['Caja de pase F°G° 4" × 4"', 'Caja de pase F°G° 6" × 6"', 'Curva PVC SEL 3/4"', 'Unión PVC SEL 3/4"', 'Conector PVC SEL 3/4" a caja',
      'Curva PVC SAP 1"', 'Unión PVC SAP 1"', 'Tapa ciega 4"']),
  p('electricas', 'Canalizaciones y conductores', 'Conductor THW 2.5 mm² (alumbrado)', 'm', 300, ELECTRICISTA,
    [m('Conductor THW 2.5 mm²', 'm', 1.05)]),
  p('electricas', 'Canalizaciones y conductores', 'Conductor THW 4 mm² (tomacorrientes)', 'm', 250, ELECTRICISTA,
    [m('Conductor THW 4 mm²', 'm', 1.05)]),
  p('electricas', 'Canalizaciones y conductores', 'Alimentador 2 × 10 mm² + 1 × 6 mm² (tierra)', 'm', 80, ELECTRICISTA,
    [m('Conductor THW 10 mm²', 'm', 2.1), m('Conductor desnudo 6 mm² (tierra)', 'm', 1.05)]),
  p('electricas', 'Tableros e interruptores', 'Tablero de distribución empotrado (12 polos)', 'und', 1, ELECTRICISTA,
    [m('Tablero metálico 12 polos', 'und', 1), m('Barra de cobre para tierra', 'und', 1)]),
  p('electricas', 'Tableros e interruptores', 'Interruptor termomagnético 2 × 20 A', 'und', 16, ELECTRICISTA,
    [m('Interruptor termomagnético 2 × 20 A', 'und', 1)]),
  p('electricas', 'Tableros e interruptores', 'Interruptor diferencial 2 × 25 A, 30 mA', 'und', 16, ELECTRICISTA,
    [m('Interruptor diferencial 2 × 25 A', 'und', 1)]),
  p('electricas', 'Puesta a tierra', 'Pozo de puesta a tierra', 'und', 0.5,
    { capataz: 0.1, operario: 1, oficial: 0, peon: 2 }, [m('Varilla de cobre 5/8" × 2.4 m', 'und', 1), m('Tierra de chacra cernida', 'm³', 1.5), m('Dosis química para pozo', 'und', 2), m('Caja de registro con tapa', 'und', 1)]),
  p('electricas', 'Artefactos', 'Artefacto de iluminación LED (instalación)', 'und', 12, ELECTRICISTA,
    [m('Equipo LED', 'und', 1)]),
];

// Agrupa una lista de partidas por especialidad y luego por grupo, conservando el orden.
export function agruparCatalogo(lista) {
  const out = {};
  for (const x of lista) ((out[x.esp] ||= {})[x.grupo || 'Otras partidas'] ||= []).push(x);
  return out;
}
