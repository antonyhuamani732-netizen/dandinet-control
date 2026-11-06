// Criterios referenciales de confinamiento y empalmes (Norma E.060 y E.070).
// Son ayudas para metrar: verifica siempre con los planos y el ingeniero del proyecto.
import { num } from './util.js';

export const CRITERIOS = {
  E060: 'E.060 Concreto armado (pórticos)',
  E070: 'E.070 Albañilería confinada',
};

// Diámetro nominal en metros a partir del peso (acero 7850 kg/m³).
export function dbDesdeKgm(kgm) {
  return Math.sqrt((4 * num(kgm)) / (7850 * Math.PI));
}

const abajo = (x, paso) => Math.floor(x / paso + 1e-9) * paso;

// Zona de confinamiento y espaciamientos máximos.
// tipo: 'viga' | 'columna'; g = { b, h, luz, dbLong, dbEst } (m)
export function confinamiento(tipo, criterio, g) {
  const b = num(g.b);
  const h = num(g.h);
  const luz = num(g.luz);
  const dbL = num(g.dbLong) || 0.0127;
  const dbE = num(g.dbEst) || 0.0095;
  if (criterio === 'E070') {
    const d = (tipo === 'columna' ? Math.max(b, h) : h) - 0.04;
    return {
      zona: Math.max(1.5 * d, 0.45),
      so: Math.min(d / 4, 0.1),
      sMax: 0.25,
      texto: 'E.070: zona = máx(1.5 d, 0.45 m); s ≤ mín(d/4, 0.10 m); 1.er estribo a 0.05 m; resto a 0.25 m.',
    };
  }
  if (tipo === 'columna') {
    return {
      zona: Math.max(luz / 6, Math.max(b, h), 0.5),
      so: Math.min(8 * dbL, Math.min(b, h) / 2, 0.1),
      sMax: Math.min(16 * dbL, 48 * dbE, Math.min(b, h), 0.3),
      texto: 'E.060 columnas: Lo = máx(hn/6, lado mayor, 0.50 m); so ≤ mín(8 db, lado menor/2, 0.10 m); 1.er estribo a 0.05 m; en el nudo s ≤ 0.15 m.',
    };
  }
  const d = h - 0.06;
  return {
    zona: 2 * h,
    so: Math.min(d / 4, 10 * dbL, 24 * dbE, 0.3),
    sMax: d / 2,
    texto: 'E.060 vigas: zona = 2h desde la cara del apoyo; so ≤ mín(d/4, 10 db, 24 db estribo, 0.30 m); 1.er estribo a 0.05 m; fuera de la zona s ≤ d/2.',
  };
}

// Distribución que cumple: 1@.05, n@so que cubren la zona, resto a sMax (redondeado).
export function distribuirSegunNorma(c) {
  const so = Math.max(0.05, abajo(c.so, 0.025));
  const n = Math.max(0, Math.ceil((c.zona - 0.05) / so - 1e-9));
  const resto = Math.min(0.3, Math.max(0.1, abajo(c.sMax, 0.05)));
  return { tramos: [{ n: 1, s: 0.05 }, { n, s: Math.round(so * 1000) / 1000 }], resto };
}

// Avisos si la distribución dibujada no cumple el criterio.
export function verificarEstribos(it, c) {
  const avisos = [];
  const tramos = it.tramos || [];
  const cubierto = tramos.reduce((s, t) => s + num(t.n) * num(t.s), 0);
  if (cubierto + 1e-6 < c.zona) {
    avisos.push(`La zona confinada cubre ${cubierto.toFixed(2)} m; se piden ${c.zona.toFixed(2)} m en cada extremo.`);
  }
  tramos.slice(1).forEach((t) => {
    if (num(t.n) && num(t.s) > c.so + 1e-6) avisos.push(`Tramo @${num(t.s).toFixed(3)} mayor que el máximo en zona (${c.so.toFixed(3)} m).`);
  });
  if (num(it.resto) > c.sMax + 1e-6) avisos.push(`El resto @${num(it.resto).toFixed(2)} pasa el máximo fuera de la zona (${c.sMax.toFixed(2)} m).`);
  return avisos;
}

// Zonas recomendadas para empalmar (en m desde la cara del apoyo izquierdo o desde el piso).
// cara: 'sup' | 'inf' | 'int'
export function zonasEmpalme(tipo, criterio, g, cara) {
  const luz = num(g.luz);
  if (!luz) return { zonas: [], texto: '' };
  if (tipo === 'columna') {
    const c = confinamiento('columna', criterio, g);
    let x0 = Math.max(c.zona, luz / 4);
    let x1 = Math.min(luz - c.zona, (3 * luz) / 4);
    if (x0 >= x1) { x0 = c.zona; x1 = luz - c.zona; }
    return {
      zonas: x1 > x0 ? [{ x0, x1 }] : [],
      texto: `Columnas: empalma en la mitad central de la altura libre, fuera de la zona confinada (entre ${x0.toFixed(2)} y ${x1.toFixed(2)} m sobre el piso). Nunca dentro del nudo.`,
    };
  }
  if (cara === 'inf') {
    const z = criterio === 'E070' ? confinamiento('viga', criterio, g).zona : 2 * num(g.h);
    const zonas = z < luz / 3 ? [{ x0: z, x1: luz / 3 }, { x0: (2 * luz) / 3, x1: luz - z }] : [];
    return {
      zonas,
      texto: zonas.length
        ? `Acero inferior: empalma cerca de los apoyos pero fuera del nudo y de la zona confinada (de ${z.toFixed(2)} a ${(luz / 3).toFixed(2)} m de cada cara).`
        : 'Acero inferior: la luz es corta para empalmar fuera de la zona confinada; usa barras enteras.',
    };
  }
  return {
    zonas: [{ x0: luz / 3, x1: (2 * luz) / 3 }],
    texto: `Acero superior: empalma en el tercio central de la luz (de ${(luz / 3).toFixed(2)} a ${((2 * luz) / 3).toFixed(2)} m).`,
  };
}

export const NOTA_EMPALME = 'No empalmes más del 50 % de las barras en la misma sección: alterna los empalmes. Referencial: verifica con los planos y el ingeniero.';
