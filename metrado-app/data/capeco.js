// Tablas por defecto. Valores referenciales tomados de las tablas de dosificación y
// análisis de costos unitarios de CAPECO. Todo es editable desde la pestaña "Tablas";
// verifícalos con tu edición vigente antes de presupuestar.

export const VERSION_TABLAS = 1;

export const DEFAULTS = {
  // Materiales por m³ de concreto según f'c (kg/cm²), slump 3"–4", piedra 1/2"–3/4".
  concreto: {
    desperdicio: 5,
    fc: {
      140: { cemento: 7.01, arena: 0.51, piedra: 0.64, agua: 0.184 },
      175: { cemento: 8.43, arena: 0.54, piedra: 0.55, agua: 0.185 },
      210: { cemento: 9.73, arena: 0.52, piedra: 0.53, agua: 0.186 },
      245: { cemento: 11.5, arena: 0.5, piedra: 0.51, agua: 0.187 },
      280: { cemento: 13.34, arena: 0.45, piedra: 0.51, agua: 0.189 },
    },
    // Concreto ciclópeo por m³: cemento (bls), hormigón (m³), piedra (m³), agua (m³).
    ciclopeo: {
      cimiento: { nombre: 'C:H 1:10 + 30% P.G.', cemento: 2.9, hormigon: 0.83, piedra: 0.48, agua: 0.08 },
      sobrecimiento: { nombre: 'C:H 1:8 + 25% P.M.', cemento: 3.7, hormigon: 0.86, piedra: 0.4, agua: 0.1 },
    },
  },

  // Losa aligerada en una dirección, viguetas a 40 cm, ladrillo de techo 30x30.
  aligerado: {
    17: { concreto: 0.08, ladrillo: 8.33, altoLadrillo: 12 },
    20: { concreto: 0.0875, ladrillo: 8.33, altoLadrillo: 15 },
    25: { concreto: 0.1, ladrillo: 8.33, altoLadrillo: 20 },
    desperdicioLadrillo: 5,
  },

  // Acero corrugado grado 60. kg/m, traslape y ganchos en metros.
  acero: {
    alambrePorKg: 0.03, // kg de alambre N°16 por kg de acero
    longitudVarilla: 9,
    desperdicio: 3,
    diametros: {
      '6mm': { nombre: '6 mm', kgm: 0.222, traslape: 0.3, gancho: 0.1, ganchoEstribo: 0.075 },
      '8mm': { nombre: '8 mm', kgm: 0.395, traslape: 0.35, gancho: 0.1, ganchoEstribo: 0.075 },
      '3/8': { nombre: '3/8"', kgm: 0.56, traslape: 0.4, gancho: 0.15, ganchoEstribo: 0.1 },
      '12mm': { nombre: '12 mm', kgm: 0.888, traslape: 0.5, gancho: 0.15, ganchoEstribo: 0.12 },
      '1/2': { nombre: '1/2"', kgm: 0.994, traslape: 0.5, gancho: 0.2, ganchoEstribo: 0.13 },
      '5/8': { nombre: '5/8"', kgm: 1.552, traslape: 0.6, gancho: 0.25, ganchoEstribo: 0.16 },
      '3/4': { nombre: '3/4"', kgm: 2.235, traslape: 0.75, gancho: 0.3, ganchoEstribo: 0.19 },
      '1': { nombre: '1"', kgm: 3.973, traslape: 1.0, gancho: 0.4, ganchoEstribo: 0.25 },
    },
  },

  // Materiales de encofrado por m² (madera tornillo con reúso, clavos de 3", alambre N°8).
  encofrado: {
    zapata: { nombre: 'Zapatas', madera: 3.0, clavos: 0.12, alambre: 0.1 },
    sobrecimiento: { nombre: 'Sobrecimientos', madera: 2.0, clavos: 0.1, alambre: 0.1 },
    columna: { nombre: 'Columnas', madera: 5.0, clavos: 0.17, alambre: 0.25 },
    viga: { nombre: 'Vigas', madera: 5.5, clavos: 0.17, alambre: 0.25 },
    placa: { nombre: 'Placas / muros', madera: 4.5, clavos: 0.15, alambre: 0.2 },
    losa_maciza: { nombre: 'Losa maciza', madera: 4.0, clavos: 0.12, alambre: 0.15 },
    losa_aligerada: { nombre: 'Losa aligerada', madera: 3.5, clavos: 0.12, alambre: 0.15 },
    escalera: { nombre: 'Escalera', madera: 6.0, clavos: 0.2, alambre: 0.25 },
  },

  // Ladrillos: dimensiones en cm (largo x ancho x alto).
  ladrillos: {
    kk18: { nombre: 'King Kong 18 huecos', L: 24, A: 13, H: 9 },
    kkmacizo: { nombre: 'King Kong macizo', L: 24, A: 13, H: 9 },
    pandereta: { nombre: 'Pandereta', L: 23, A: 12, H: 9 },
    pastelero: { nombre: 'Pastelero', L: 24, A: 24, H: 3 },
  },

  // Mortero por m³: cemento (bls), arena gruesa (m³), agua (m³).
  mortero: {
    '1:3': { cemento: 10.5, arena: 0.95, agua: 0.29 },
    '1:4': { cemento: 8.9, arena: 1.0, agua: 0.27 },
    '1:5': { cemento: 7.4, arena: 1.05, agua: 0.26 },
    '1:6': { cemento: 6.3, arena: 1.07, agua: 0.25 },
  },
  desperdicioLadrillo: 5,
  desperdicioMortero: 10,

  // Rendimientos (unidad por día de 8 h) y cuadrilla.
  rendimientos: {
    'concreto.cimiento': { nombre: 'Concreto cimiento corrido', und: 'm³', rend: 25, capataz: 0.1, operario: 1, oficial: 2, peon: 8 },
    'concreto.sobrecimiento': { nombre: 'Concreto sobrecimiento', und: 'm³', rend: 20, capataz: 0.1, operario: 1, oficial: 2, peon: 8 },
    'concreto.zapata': { nombre: 'Concreto zapatas', und: 'm³', rend: 25, capataz: 0.1, operario: 2, oficial: 2, peon: 8 },
    'concreto.columna': { nombre: 'Concreto columnas', und: 'm³', rend: 12, capataz: 0.1, operario: 2, oficial: 2, peon: 8 },
    'concreto.viga': { nombre: 'Concreto vigas', und: 'm³', rend: 14, capataz: 0.1, operario: 2, oficial: 2, peon: 8 },
    'concreto.placa': { nombre: 'Concreto placas', und: 'm³', rend: 12, capataz: 0.1, operario: 2, oficial: 2, peon: 8 },
    'concreto.losa_maciza': { nombre: 'Concreto losa maciza', und: 'm³', rend: 25, capataz: 0.1, operario: 2, oficial: 2, peon: 8 },
    'concreto.losa_aligerada': { nombre: 'Concreto losa aligerada', und: 'm³', rend: 25, capataz: 0.1, operario: 2, oficial: 2, peon: 8 },
    'concreto.escalera': { nombre: 'Concreto escalera', und: 'm³', rend: 10, capataz: 0.1, operario: 2, oficial: 2, peon: 8 },
    'acero': { nombre: 'Acero de refuerzo fy=4200', und: 'kg', rend: 250, capataz: 0.1, operario: 1, oficial: 1, peon: 0 },
    'encofrado.zapata': { nombre: 'Encofrado zapatas', und: 'm²', rend: 12, capataz: 0.1, operario: 1, oficial: 1, peon: 0 },
    'encofrado.sobrecimiento': { nombre: 'Encofrado sobrecimientos', und: 'm²', rend: 14, capataz: 0.1, operario: 1, oficial: 1, peon: 0 },
    'encofrado.columna': { nombre: 'Encofrado columnas', und: 'm²', rend: 10, capataz: 0.1, operario: 1, oficial: 1, peon: 0 },
    'encofrado.viga': { nombre: 'Encofrado vigas', und: 'm²', rend: 9, capataz: 0.1, operario: 1, oficial: 1, peon: 0 },
    'encofrado.placa': { nombre: 'Encofrado placas', und: 'm²', rend: 12, capataz: 0.1, operario: 1, oficial: 1, peon: 0 },
    'encofrado.losa_maciza': { nombre: 'Encofrado losa maciza', und: 'm²', rend: 12, capataz: 0.1, operario: 1, oficial: 1, peon: 0 },
    'encofrado.losa_aligerada': { nombre: 'Encofrado losa aligerada', und: 'm²', rend: 12, capataz: 0.1, operario: 1, oficial: 1, peon: 0 },
    'encofrado.escalera': { nombre: 'Encofrado escalera', und: 'm²', rend: 8, capataz: 0.1, operario: 1, oficial: 1, peon: 0 },
    'muro.soga': { nombre: 'Muro de ladrillo en soga', und: 'm²', rend: 8.5, capataz: 0.1, operario: 1, oficial: 0, peon: 0.5 },
    'muro.cabeza': { nombre: 'Muro de ladrillo en cabeza', und: 'm²', rend: 5.5, capataz: 0.1, operario: 1, oficial: 0, peon: 0.5 },
    'muro.canto': { nombre: 'Muro de ladrillo en canto', und: 'm²', rend: 12, capataz: 0.1, operario: 1, oficial: 0, peon: 0.5 },
  },

  // Costo de hora-hombre en soles (incluye leyes sociales). Actualízalo con la tabla vigente.
  costoHH: { capataz: 32.0, operario: 29.0, oficial: 23.0, peon: 21.0 },
};

export const CATEGORIAS = ['capataz', 'operario', 'oficial', 'peon'];
export const NOMBRE_CATEGORIA = { capataz: 'Capataz', operario: 'Operario', oficial: 'Oficial', peon: 'Peón' };

export const ELEMENTOS_CONCRETO = {
  cimiento: { nombre: 'Cimiento corrido', dims: ['Largo (m)', 'Ancho (m)', 'Alto (m)'], ciclopeo: 'cimiento' },
  sobrecimiento: { nombre: 'Sobrecimiento', dims: ['Largo (m)', 'Ancho (m)', 'Alto (m)'], ciclopeo: 'sobrecimiento' },
  zapata: { nombre: 'Zapata', dims: ['Largo (m)', 'Ancho (m)', 'Peralte (m)'] },
  columna: { nombre: 'Columna', dims: ['Lado b (m)', 'Lado h (m)', 'Altura (m)'] },
  viga: { nombre: 'Viga', dims: ['Base b (m)', 'Peralte h (m)', 'Longitud libre (m)'] },
  placa: { nombre: 'Placa', dims: ['Longitud (m)', 'Espesor (m)', 'Altura (m)'] },
  losa_maciza: { nombre: 'Losa maciza', dims: ['Largo (m)', 'Ancho (m)', 'Espesor (m)'] },
  losa_aligerada: { nombre: 'Losa aligerada', dims: ['Largo (m)', 'Ancho (m)'] },
  escalera: { nombre: 'Escalera', dims: ['Ancho (m)', 'Longitud inclinada (m)', 'Garganta (m)', 'N° pasos', 'Paso (m)', 'Contrapaso (m)'] },
};

export const ELEMENTOS_ENCOFRADO = {
  zapata: { dims: ['Largo (m)', 'Ancho (m)', 'Peralte (m)'], ayuda: 'Perímetro × peralte' },
  sobrecimiento: { dims: ['Largo (m)', 'Alto (m)'], ayuda: '2 caras × largo × alto' },
  columna: { dims: ['Lado b (m)', 'Lado h (m)', 'Altura (m)'], ayuda: 'Perímetro × altura' },
  viga: { dims: ['Base b (m)', 'Peralte h (m)', 'Longitud (m)'], ayuda: '(fondo + 2 costados) × longitud' },
  placa: { dims: ['Longitud (m)', 'Altura (m)'], ayuda: '2 caras × longitud × altura' },
  losa_maciza: { dims: ['Largo (m)', 'Ancho (m)'], ayuda: 'Área de fondo' },
  losa_aligerada: { dims: ['Largo (m)', 'Ancho (m)'], ayuda: 'Área de fondo' },
  escalera: { dims: ['Ancho (m)', 'Longitud inclinada (m)'], ayuda: 'Fondo de la losa inclinada' },
};
