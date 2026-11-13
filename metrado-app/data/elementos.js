// Catálogo de elementos: medidas (una sola vez), partidas que admite y armado típico.

// Orden de la Norma Técnica de Metrados: OE.2 Estructuras … OE.5 Instalaciones eléctricas.
export const ESPECIALIDADES = {
  estructuras: { nombre: 'Estructuras', codigo: 'OE.2' },
  arquitectura: { nombre: 'Arquitectura', codigo: 'OE.3' },
  sanitarias: { nombre: 'Instalaciones sanitarias', codigo: 'OE.4' },
  electricas: { nombre: 'Instalaciones eléctricas', codigo: 'OE.5' },
  otras: { nombre: 'Otras partidas', codigo: 'OE.X' },
};

// Tipo de "partida libre" (unidad, metrado, rendimiento y materiales a mano) de cada especialidad.
export const LIBRE_POR_ESP = {
  estructuras: 'libre_est',
  arquitectura: 'libre_arq',
  sanitarias: 'libre_san',
  electricas: 'libre_ele',
  otras: 'manual',
};
export const esLibre = (tipo) => !!TIPOS[tipo]?.libre;

// Subtemas de cada especialidad en el orden de la Norma Técnica de Metrados.
// El código sale de la posición: OE.2.1, OE.2.2… Los subtemas propios del usuario van al final.
export const SUBTEMAS = {
  estructuras: ['Obras preliminares', 'Movimiento de tierras', 'Concreto simple', 'Concreto armado'],
  arquitectura: ['Muros y tabiques de albañilería', 'Revoques y enlucidos', 'Cielorrasos', 'Pisos y pavimentos', 'Zócalos y contrazócalos', 'Carpintería', 'Vidrios', 'Pintura'],
  sanitarias: ['Aparatos sanitarios', 'Salidas de agua', 'Redes de agua', 'Salidas de desagüe', 'Redes de desagüe', 'Accesorios de desagüe'],
  electricas: ['Salidas', 'Canalizaciones y conductores', 'Tableros e interruptores', 'Puesta a tierra', 'Artefactos'],
  otras: [],
};

const normal = (t) => String(t || '').trim().toLowerCase();

// Subtema de un elemento: el de su tipo (columna → Concreto armado) o el que escribió el usuario.
export function subtemaDe(el) {
  const t = TIPOS[el.tipo];
  if (t?.subtema) return t.subtema;
  const g = String(el.grupo || '').trim();
  if (!g) return t?.plural || 'Otras partidas';
  // Si coincide con uno de la lista (sin importar mayúsculas), se usa el nombre de la lista.
  return (SUBTEMAS[el.especialidad] || []).find((x) => normal(x) === normal(g)) || g;
}

// Subtemas presentes de una especialidad, ordenados y con su código: [{ codigo, nombre, els }].
export function subtemasEspecialidad(esp, elementos) {
  const lista = SUBTEMAS[esp] || [];
  const mapa = new Map();
  for (const el of elementos) {
    if (el.especialidad !== esp) continue;
    const n = subtemaDe(el);
    if (!mapa.has(n)) mapa.set(n, []);
    mapa.get(n).push(el);
  }
  const propios = [...mapa.keys()].filter((n) => !lista.includes(n));
  const cod = ESPECIALIDADES[esp].codigo;
  const out = [];
  lista.forEach((n, i) => { if (mapa.has(n)) out.push({ codigo: `${cod}.${i + 1}`, nombre: n, els: ordenarPorTipo(mapa.get(n)) }); });
  propios.forEach((n, i) => out.push({ codigo: `${cod}.${lista.length + i + 1}`, nombre: n, els: ordenarPorTipo(mapa.get(n)) }));
  return out;
}

// Código de un subtema por nombre (aunque aún no tenga partidas).
export function codigoSubtema(esp, nombre, elementos = []) {
  const s = subtemasEspecialidad(esp, elementos).find((x) => x.nombre === nombre);
  if (s) return s.codigo;
  const i = (SUBTEMAS[esp] || []).indexOf(nombre);
  return i >= 0 ? `${ESPECIALIDADES[esp].codigo}.${i + 1}` : ESPECIALIDADES[esp].codigo;
}

// Dentro de un subtema: primero por tipo (zapatas, columnas, vigas…) y luego en el orden en que se agregaron.
function ordenarPorTipo(els) {
  const orden = Object.keys(TIPOS);
  return els.map((e, i) => [e, i]).sort((a, b) => (orden.indexOf(a[0].tipo) - orden.indexOf(b[0].tipo)) || (a[1] - b[1])).map(([e]) => e);
}

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
    subtema: 'Concreto simple', esp: 'estructuras', nombre: 'Cimiento corrido', plural: 'Cimientos corridos', pref: 'CC',
    dims: [d('L', 'Largo', 10), d('B', 'Ancho', 0.4), d('h', 'Alto', 0.8)],
    partidas: ['concreto'], mezcla: 'ciclopeo',
    conc: (m) => [m.L, m.B, m.h],
  },
  sobrecimiento: {
    subtema: 'Concreto simple', esp: 'estructuras', nombre: 'Sobrecimiento', plural: 'Sobrecimientos', pref: 'SC',
    dims: [d('L', 'Largo', 10), d('B', 'Ancho', 0.15), d('h', 'Alto', 0.3)],
    partidas: ['concreto', 'encofrado'], mezcla: 'ciclopeo',
    conc: (m) => [m.L, m.B, m.h], enc: (m) => [m.L, m.h],
  },
  zapata: {
    subtema: 'Concreto armado', esp: 'estructuras', nombre: 'Zapata', plural: 'Zapatas', pref: 'Z',
    dims: [d('A', 'Largo A', 1.5), d('B', 'Ancho B', 1.5), d('h', 'Peralte h', 0.6)],
    partidas: ['concreto', 'encofrado', 'acero'], inactivas: ['encofrado'], mezcla: '210', rec: 7.5,
    conc: (m) => [m.A, m.B, m.h], enc: (m) => [m.A, m.B, m.h], planta: (m) => ({ X: m.A, Y: m.B }),
    armado: () => [
      { tipo: 'malla', uso: 'Malla inferior en X', diam: '1/2', sep: 0.15, rec: 0.075, dir: 'X', ganchos: 2 },
      { tipo: 'malla', uso: 'Malla inferior en Y', diam: '1/2', sep: 0.15, rec: 0.075, dir: 'Y', ganchos: 2 },
    ],
  },
  columna: {
    subtema: 'Concreto armado', esp: 'estructuras', nombre: 'Columna', plural: 'Columnas', pref: 'C',
    dims: [d('b', 'Lado b', 0.25), d('h', 'Lado h', 0.25), d('H', 'Altura H', 2.8)],
    partidas: ['concreto', 'encofrado', 'acero'], mezcla: '210',
    conc: (m) => [m.b, m.h, m.H], enc: (m) => [m.b, m.h, m.H], criterio: 'E060', rec: 4,
    luz: (m) => m.H, seccion: (m) => ({ b: m.b, h: m.h }),
    armado: (m) => [
      { tipo: 'barras', uso: 'Longitudinal', modo: 'apoyos', cara: 'int', zona: 'corrido', diam: '1/2', cant: 4, rec: 0.04,
        izq: { apoyo: 'zapata', ancho: 0.6 }, der: { apoyo: 'traslape' } },
      { tipo: 'estribos', uso: 'Estribos', diam: '3/8', b: m.b, h: m.h, rec: 0.04, long: m.H, tramos: [{ n: 1, s: 0.05 }, { n: 4, s: 0.1 }], resto: 0.25 },
    ],
  },
  viga: {
    subtema: 'Concreto armado', esp: 'estructuras', nombre: 'Viga', plural: 'Vigas', pref: 'V',
    dims: [d('b', 'Base b', 0.25), d('h', 'Peralte h', 0.4), d('L', 'Luz libre L', 4), d('e', 'Espesor de losa e', 0.2)],
    partidas: ['concreto', 'encofrado', 'acero'], mezcla: '210', clase: 'peraltada', criterio: 'E060', rec: 4,
    conc: (m) => [m.b, m.h, m.L], enc: (m) => [m.b, m.h, m.L, m.e],
    luz: (m) => m.L, seccion: (m) => ({ b: m.b, h: m.h }),
    armado: (m, el = {}) => armadoViga(m, el.clase),
  },
  placa: {
    subtema: 'Concreto armado', esp: 'estructuras', nombre: 'Placa', plural: 'Placas', pref: 'PL',
    dims: [d('L', 'Longitud L', 2), d('e', 'Espesor e', 0.2), d('H', 'Altura H', 2.8)],
    partidas: ['concreto', 'encofrado', 'acero'], mezcla: '210', rec: 2,
    conc: (m) => [m.L, m.e, m.H], enc: (m) => [m.L, m.H], planta: (m) => ({ X: m.L, Y: m.H }),
    armado: () => [
      { tipo: 'malla', uso: 'Horizontal', diam: '3/8', sep: 0.25, rec: 0.04, dir: 'X', ganchos: 0, capas: 2 },
      { tipo: 'malla', uso: 'Vertical', diam: '3/8', sep: 0.25, rec: 0.04, dir: 'Y', ganchos: 0, capas: 2 },
    ],
  },
  losa_maciza: {
    subtema: 'Concreto armado', esp: 'estructuras', nombre: 'Losa maciza', plural: 'Losas macizas', pref: 'LM',
    dims: [d('A', 'Largo A', 5), d('B', 'Ancho B', 4), d('e', 'Espesor e', 0.15)],
    partidas: ['concreto', 'encofrado', 'acero'], mezcla: '210', rec: 2,
    conc: (m) => [m.A, m.B, m.e], enc: (m) => [m.A, m.B], planta: (m) => ({ X: m.A, Y: m.B }),
    armado: () => [
      { tipo: 'malla', uso: 'Malla en X', diam: '3/8', sep: 0.2, rec: 0.02, dir: 'X', ganchos: 2 },
      { tipo: 'malla', uso: 'Malla en Y', diam: '3/8', sep: 0.2, rec: 0.02, dir: 'Y', ganchos: 2 },
    ],
  },
  losa_aligerada: {
    subtema: 'Concreto armado', esp: 'estructuras', nombre: 'Losa aligerada', plural: 'Losas aligeradas', pref: 'LA',
    dims: [d('A', 'Luz A (dirección de viguetas)', 4), d('B', 'Ancho B', 5)],
    partidas: ['concreto', 'encofrado', 'acero'], mezcla: '210', peralte: '20', rec: 2,
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
    subtema: 'Concreto armado', esp: 'estructuras', nombre: 'Escalera', plural: 'Escaleras', pref: 'E',
    dims: [d('B', 'Ancho B', 1), d('L', 'Longitud inclinada L', 3.2), d('t', 'Garganta t', 0.15),
      d('np', 'N° de pasos', 10), d('p', 'Paso p', 0.25), d('cp', 'Contrapaso cp', 0.175)],
    partidas: ['concreto', 'encofrado', 'acero'], mezcla: '210', rec: 2,
    conc: (m) => [m.B, m.L, m.t, m.np, m.p, m.cp], enc: (m) => [m.B, m.L], planta: (m) => ({ X: m.L, Y: m.B }),
    armado: () => [
      { tipo: 'malla', uso: 'Longitudinal', diam: '1/2', sep: 0.2, rec: 0.025, dir: 'X', ganchos: 2 },
      { tipo: 'malla', uso: 'Transversal', diam: '3/8', sep: 0.25, rec: 0.025, dir: 'Y', ganchos: 0 },
    ],
  },
  muro: {
    subtema: 'Muros y tabiques de albañilería', esp: 'arquitectura', nombre: 'Muro de albañilería', plural: 'Muros de albañilería', pref: 'M',
    dims: [d('L', 'Largo L', 5), d('H', 'Alto H', 2.6)],
    partidas: ['muro'],
  },
  libre_est: {
    esp: 'estructuras', nombre: 'Partida de estructuras', plural: 'Otras partidas de estructuras', pref: 'P',
    dims: [], partidas: ['manual'], libre: true,
  },
  libre_arq: {
    esp: 'arquitectura', nombre: 'Partida de arquitectura', plural: 'Otras partidas de arquitectura', pref: 'P',
    dims: [], partidas: ['manual'], libre: true,
  },
  libre_san: {
    esp: 'sanitarias', nombre: 'Partida sanitaria', plural: 'Partidas sanitarias', pref: 'P',
    dims: [], partidas: ['manual'], libre: true,
  },
  libre_ele: {
    esp: 'electricas', nombre: 'Partida eléctrica', plural: 'Partidas eléctricas', pref: 'P',
    dims: [], partidas: ['manual'], libre: true,
  },
  manual: {
    esp: 'otras', nombre: 'Partida manual', plural: 'Partidas manuales', pref: 'P',
    dims: [], partidas: ['manual'], libre: true,
  },
};

export const CLASES_VIGA = {
  peraltada: 'Viga peraltada',
  chata: 'Viga chata',
  borde: 'Viga de borde',
};

// Armado típico por clase de viga: corridos superior e inferior, bastones en apoyos y estribos.
function armadoViga(m, clase = 'peraltada') {
  const chata = clase === 'chata';
  const ext = { apoyo: 'columna', ancho: 0.25 };
  const base = { tipo: 'barras', modo: 'apoyos', rec: 0.04, izq: { ...ext }, der: { ...ext } };
  const items = [
    { ...base, uso: 'Acero superior corrido', cara: 'sup', zona: 'corrido', diam: chata ? '1/2' : '5/8', cant: 2 },
    { ...base, uso: 'Acero inferior corrido', cara: 'inf', zona: 'corrido', diam: chata ? '1/2' : '5/8', cant: 2 },
  ];
  if (!chata) items.push({ ...base, uso: 'Bastones superiores en apoyos', cara: 'sup', zona: 'ambos', frac: '3', diam: '5/8', cant: 1 });
  items.push({
    tipo: 'estribos', uso: 'Estribos', diam: chata ? '1/4' : '3/8', b: m.b, h: m.h, rec: 0.04, long: m.L,
    tramos: [{ n: 1, s: 0.05 }, { n: 5, s: 0.1 }], resto: 0.2,
  });
  return items;
}

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
  if (t.clase) el.clase = t.clase;
  if (t.criterio) el.criterio = t.criterio;
  if (t.peralte) el.peralte = t.peralte;
  for (const p of t.partidas) {
    el.partidas[p] = nuevaPartida(p);
    if (t.inactivas?.includes(p)) el.partidas[p].activa = false;
  }
  if (el.partidas.encofrado) el.partidas.encofrado.usos = 1;
  if (el.partidas.acero) {
    el.partidas.acero.recCm = t.rec ?? 4;
    el.partidas.acero.armado = t.armado ? t.armado(medidas(el), el) : [];
  }
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

// Partida libre creada desde el catálogo o desde "Mis partidas".
// pl = { esp, grupo, nombre, und, rend, cuadrilla, materiales }
export function nuevaDesdePlantilla(pl, id) {
  const tipo = LIBRE_POR_ESP[pl.esp] || 'manual';
  const el = nuevoElemento(tipo, pl.nombre || 'Nueva partida', id);
  if (pl.grupo) el.grupo = pl.grupo;
  Object.assign(el.partidas.manual, {
    und: pl.und || 'und',
    cantidad: 0,
    rend: pl.rend ?? 10,
    cuadrilla: { capataz: 0, operario: 0, oficial: 0, peon: 0, ...(pl.cuadrilla || {}) },
    materiales: (pl.materiales || []).map((x) => ({ nombre: x.nombre, und: x.und, porUnidad: x.porUnidad })),
  });
  if (pl.detalle?.length) {
    el.partidas.manual.modoMetrado = 'detalle';
    el.partidas.manual.detalle = pl.detalle.map(filaDetalle);
  }
  return el;
}

// Convierte una partida libre del proyecto en plantilla para "Mis partidas".
export function plantillaDesde(el) {
  const p = el.partidas.manual;
  return {
    esp: el.especialidad,
    grupo: el.grupo || '',
    nombre: el.nombre,
    und: p.und || 'und',
    rend: p.rend,
    cuadrilla: { ...(p.cuadrilla || {}) },
    materiales: (p.materiales || []).filter((x) => x.nombre).map((x) => ({ nombre: x.nombre, und: x.und, porUnidad: x.porUnidad })),
    // Se guardan las filas del detalle (con sus cantidades) para reusarlas como lista de accesorios.
    ...(p.modoMetrado === 'detalle' && p.detalle?.length ? { detalle: p.detalle.filter((f) => String(f.desc || '').trim()).map(filaDetalle) } : {}),
  };
}

// Fila del detalle de metrado: descripción, N° veces, largo, ancho, alto; "material" = va al pedido.
export function filaDetalle(f = {}) {
  return { desc: f.desc ?? '', veces: f.veces ?? '', largo: f.largo ?? '', ancho: f.ancho ?? '', alto: f.alto ?? '', material: !!f.material, und: f.und ?? '' };
}

// Cambia una partida libre de especialidad (sin perder sus datos).
export function moverEspecialidad(el, esp) {
  if (!esLibre(el.tipo) || !LIBRE_POR_ESP[esp]) return el;
  el.tipo = LIBRE_POR_ESP[esp];
  el.especialidad = esp;
  return el;
}
