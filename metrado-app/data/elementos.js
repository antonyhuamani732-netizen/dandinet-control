// Catálogo de elementos: medidas (una sola vez), partidas que admite y armado típico.

export const ESPECIALIDADES = {
  estructuras: { nombre: 'Estructuras', codigo: 'OE.2' },
  arquitectura: { nombre: 'Arquitectura', codigo: 'OE.3' },
  otras: { nombre: 'Otras partidas', codigo: 'OE.X' },
};

export const PARTIDAS = {
  concreto: { nombre: 'Concreto', und: 'm³' },
  encofrado: { nombre: 'Encofrado', und: 'm²' },
  acero: { nombre: 'Acero', und: 'kg' },
  muro: { nombre: 'Muro', und: 'm²' },
  manual: { nombre: 'Partida', und: '' },
};

const d = (k, label, def) => ({ k, label, def });

// conc / enc: medidas que esperan calc/concreto.js y calc/encofrado.js.
// planta: largo en X y en Y para las mallas de acero.
export const TIPOS = {
  cimiento: {
    esp: 'estructuras', nombre: 'Cimiento corrido', plural: 'Cimientos corridos', pref: 'CC',
    dims: [d('L', 'Largo', 10), d('B', 'Ancho', 0.4), d('h', 'Alto', 0.8)],
    partidas: ['concreto'], mezcla: 'ciclopeo',
    conc: (m) => [m.L, m.B, m.h],
  },
  sobrecimiento: {
    esp: 'estructuras', nombre: 'Sobrecimiento', plural: 'Sobrecimientos', pref: 'SC',
    dims: [d('L', 'Largo', 10), d('B', 'Ancho', 0.15), d('h', 'Alto', 0.3)],
    partidas: ['concreto', 'encofrado'], mezcla: 'ciclopeo',
    conc: (m) => [m.L, m.B, m.h], enc: (m) => [m.L, m.h],
  },
  zapata: {
    esp: 'estructuras', nombre: 'Zapata', plural: 'Zapatas', pref: 'Z',
    dims: [d('A', 'Largo A', 1.5), d('B', 'Ancho B', 1.5), d('h', 'Peralte h', 0.6)],
    partidas: ['concreto', 'encofrado', 'acero'], inactivas: ['encofrado'], mezcla: '210',
    conc: (m) => [m.A, m.B, m.h], enc: (m) => [m.A, m.B, m.h], planta: (m) => ({ X: m.A, Y: m.B }),
    armado: () => [
      { tipo: 'malla', uso: 'Malla inferior en X', diam: '1/2', sep: 0.15, rec: 0.075, dir: 'X', ganchos: 2 },
      { tipo: 'malla', uso: 'Malla inferior en Y', diam: '1/2', sep: 0.15, rec: 0.075, dir: 'Y', ganchos: 2 },
    ],
  },
  columna: {
    esp: 'estructuras', nombre: 'Columna', plural: 'Columnas', pref: 'C',
    dims: [d('b', 'Lado b', 0.25), d('h', 'Lado h', 0.25), d('H', 'Altura H', 2.8)],
    partidas: ['concreto', 'encofrado', 'acero'], mezcla: '210',
    conc: (m) => [m.b, m.h, m.H], enc: (m) => [m.b, m.h, m.H],
    armado: (m) => [
      { tipo: 'barras', uso: 'Longitudinal', diam: '1/2', cant: 4, long: round2(+m.H + 0.6), ganchos: 1, traslapes: 0 },
      { tipo: 'estribos', uso: 'Estribos', diam: '3/8', b: m.b, h: m.h, rec: 0.04, long: m.H, tramos: [{ n: 1, s: 0.05 }, { n: 4, s: 0.1 }], resto: 0.25 },
    ],
  },
  viga: {
    esp: 'estructuras', nombre: 'Viga', plural: 'Vigas', pref: 'V',
    dims: [d('b', 'Base b', 0.25), d('h', 'Peralte h', 0.4), d('L', 'Luz libre L', 4)],
    partidas: ['concreto', 'encofrado', 'acero'], mezcla: '210',
    conc: (m) => [m.b, m.h, m.L], enc: (m) => [m.b, m.h, m.L],
    armado: (m) => [
      { tipo: 'barras', uso: 'Acero superior', diam: '5/8', cant: 2, long: round2(+m.L + 0.6), ganchos: 2, traslapes: 0 },
      { tipo: 'barras', uso: 'Acero inferior', diam: '5/8', cant: 2, long: round2(+m.L + 0.6), ganchos: 2, traslapes: 0 },
      { tipo: 'estribos', uso: 'Estribos', diam: '3/8', b: m.b, h: m.h, rec: 0.04, long: m.L, tramos: [{ n: 1, s: 0.05 }, { n: 5, s: 0.1 }], resto: 0.2 },
    ],
  },
  placa: {
    esp: 'estructuras', nombre: 'Placa', plural: 'Placas', pref: 'PL',
    dims: [d('L', 'Longitud L', 2), d('e', 'Espesor e', 0.2), d('H', 'Altura H', 2.8)],
    partidas: ['concreto', 'encofrado', 'acero'], mezcla: '210',
    conc: (m) => [m.L, m.e, m.H], enc: (m) => [m.L, m.H], planta: (m) => ({ X: m.L, Y: m.H }),
    armado: () => [
      { tipo: 'malla', uso: 'Horizontal', diam: '3/8', sep: 0.25, rec: 0.04, dir: 'X', ganchos: 0, capas: 2 },
      { tipo: 'malla', uso: 'Vertical', diam: '3/8', sep: 0.25, rec: 0.04, dir: 'Y', ganchos: 0, capas: 2 },
    ],
  },
  losa_maciza: {
    esp: 'estructuras', nombre: 'Losa maciza', plural: 'Losas macizas', pref: 'LM',
    dims: [d('A', 'Largo A', 5), d('B', 'Ancho B', 4), d('e', 'Espesor e', 0.15)],
    partidas: ['concreto', 'encofrado', 'acero'], mezcla: '210',
    conc: (m) => [m.A, m.B, m.e], enc: (m) => [m.A, m.B], planta: (m) => ({ X: m.A, Y: m.B }),
    armado: () => [
      { tipo: 'malla', uso: 'Malla en X', diam: '3/8', sep: 0.2, rec: 0.02, dir: 'X', ganchos: 2 },
      { tipo: 'malla', uso: 'Malla en Y', diam: '3/8', sep: 0.2, rec: 0.02, dir: 'Y', ganchos: 2 },
    ],
  },
  losa_aligerada: {
    esp: 'estructuras', nombre: 'Losa aligerada', plural: 'Losas aligeradas', pref: 'LA',
    dims: [d('A', 'Luz A (dirección de viguetas)', 4), d('B', 'Ancho B', 5)],
    partidas: ['concreto', 'encofrado', 'acero'], mezcla: '210', peralte: '20',
    conc: (m) => [m.A, m.B], enc: (m) => [m.A, m.B], planta: (m) => ({ X: m.A, Y: m.B }),
    armado: (m) => {
      const viguetas = Math.max(1, Math.round(+m.B / 0.4));
      return [
        { tipo: 'barras', uso: 'Viguetas: acero inferior', diam: '1/2', cant: viguetas, long: round2(+m.A + 0.3), ganchos: 2, traslapes: 0 },
        { tipo: 'barras', uso: 'Viguetas: bastones superiores', diam: '3/8', cant: viguetas * 2, long: round2(+m.A / 3 + 0.15), ganchos: 1, traslapes: 0 },
        { tipo: 'malla', uso: 'Acero de temperatura', diam: '1/4', sep: 0.25, rec: 0.02, dir: 'Y', ganchos: 0 },
      ];
    },
  },
  escalera: {
    esp: 'estructuras', nombre: 'Escalera', plural: 'Escaleras', pref: 'E',
    dims: [d('B', 'Ancho B', 1), d('L', 'Longitud inclinada L', 3.2), d('t', 'Garganta t', 0.15),
      d('np', 'N° de pasos', 10), d('p', 'Paso p', 0.25), d('cp', 'Contrapaso cp', 0.175)],
    partidas: ['concreto', 'encofrado', 'acero'], mezcla: '210',
    conc: (m) => [m.B, m.L, m.t, m.np, m.p, m.cp], enc: (m) => [m.B, m.L], planta: (m) => ({ X: m.L, Y: m.B }),
    armado: () => [
      { tipo: 'malla', uso: 'Longitudinal', diam: '1/2', sep: 0.2, rec: 0.025, dir: 'X', ganchos: 2 },
      { tipo: 'malla', uso: 'Transversal', diam: '3/8', sep: 0.25, rec: 0.025, dir: 'Y', ganchos: 0 },
    ],
  },
  muro: {
    esp: 'arquitectura', nombre: 'Muro de albañilería', plural: 'Muros de albañilería', pref: 'M',
    dims: [d('L', 'Largo L', 5), d('H', 'Alto H', 2.6)],
    partidas: ['muro'],
  },
  manual: {
    esp: 'otras', nombre: 'Partida manual', plural: 'Partidas manuales', pref: 'P',
    dims: [],
    partidas: ['manual'],
  },
};

function round2(x) {
  return Math.round(x * 100) / 100;
}

export function medidas(el) {
  const m = {};
  for (const x of TIPOS[el.tipo].dims) m[x.k] = el.dims?.[x.k] ?? x.def;
  return m;
}

export function nuevaPartida(clave) {
  return { activa: true, fijo: null, rend: '', cuadrilla: null, cuadrillas: 1, ejecutado: false };
}

export function nuevoElemento(tipo, nombre, id) {
  const t = TIPOS[tipo];
  const el = {
    id, tipo, especialidad: t.esp, nombre, n: 1, oculto: false,
    dims: Object.fromEntries(t.dims.map((x) => [x.k, x.def])),
    partidas: {},
  };
  if (t.mezcla) el.mezcla = t.mezcla;
  if (t.peralte) el.peralte = t.peralte;
  for (const p of t.partidas) {
    el.partidas[p] = nuevaPartida(p);
    if (t.inactivas?.includes(p)) el.partidas[p].activa = false;
  }
  if (el.partidas.encofrado) el.partidas.encofrado.usos = 1;
  if (el.partidas.acero) el.partidas.acero.armado = t.armado ? t.armado(medidas(el)) : [];
  if (el.partidas.muro) {
    Object.assign(el.partidas.muro, {
      ladrillo: 'kk18', ladPers: { L: 24, A: 13, H: 9 }, aparejo: 'soga', junta: 1.5, mortero: '1:4', vanos: [],
    });
  }
  if (el.partidas.manual) {
    Object.assign(el.partidas.manual, {
      und: 'm²', cantidad: 0, rend: 10,
      cuadrilla: { capataz: 0.1, operario: 1, oficial: 0, peon: 1 },
      materiales: [],
    });
  }
  return el;
}
