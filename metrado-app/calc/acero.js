import { mat, num } from './util.js';

// Cuenta estribos de una distribución tipo "1@.05, 4@.10, r@.25" aplicada en ambos
// extremos de un elemento de longitud libre `largo`.
export function contarEstribos(distribucion, largo) {
  const tramos = String(distribucion || '')
    .split(/[,;]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .map((t) => {
      const [cant, sep] = t.split('@').map((x) => x.trim());
      if (sep === undefined) throw new Error(`Tramo inválido "${t}". Usa el formato 4@.10`);
      return { resto: /^r/.test(cant), cant: num(cant), sep: num(sep) };
    });
  let fijos = 0;
  let ocupado = 0;
  let resto = null;
  for (const t of tramos) {
    if (t.resto) resto = t.sep;
    else {
      fijos += t.cant;
      ocupado += t.cant * t.sep;
    }
  }
  const libre = num(largo) - 2 * ocupado;
  let centrales = 0;
  if (resto > 0 && libre > 0) centrales = Math.max(0, Math.ceil(libre / resto - 1e-9) - 1);
  if (libre < 0) throw new Error('La distribución de estribos excede la longitud del elemento');
  return 2 * fijos + centrales;
}

export function longitudEstribo(b, h, rec, ganchoEstribo) {
  return 2 * (num(b) - 2 * num(rec)) + 2 * (num(h) - 2 * num(rec)) + 2 * num(ganchoEstribo);
}

// p = { n, barras: [{ diam, cant, long, ganchos, traslapes }],
//       estribos: { diam, b, h, rec, long, dist } | null }
export function calcAcero(p, T) {
  const D = T.acero.diametros;
  const n = num(p.n) || 1;
  const metros = {}; // metros por diámetro
  const add = (diam, m) => { metros[diam] = (metros[diam] || 0) + m; };
  const notas = [];

  for (const b of p.barras || []) {
    const d = D[b.diam];
    if (!d || !num(b.cant)) continue;
    const largo = num(b.long) + num(b.ganchos) * d.gancho + num(b.traslapes) * d.traslape;
    add(b.diam, num(b.cant) * largo * n);
  }

  const e = p.estribos;
  if (e && e.diam && D[e.diam]) {
    const cant = contarEstribos(e.dist, e.long);
    const lEst = longitudEstribo(e.b, e.h, e.rec, D[e.diam].ganchoEstribo);
    add(e.diam, cant * lEst * n);
    notas.push(`${cant} estribos de ${lEst.toFixed(2)} m por elemento`);
  }

  const f = 1 + num(T.acero.desperdicio) / 100;
  let total = 0;
  const materiales = [];
  for (const [diam, m] of Object.entries(metros)) {
    const kg = m * D[diam].kgm;
    total += kg;
    materiales.push(mat(`acero_${diam}`, `Acero corrugado ${D[diam].nombre}`, 'kg', kg * f));
    const varillas = Math.ceil((m * f) / num(T.acero.longitudVarilla) - 1e-9);
    notas.push(`${D[diam].nombre}: ${m.toFixed(2)} m → ${varillas} varillas de ${T.acero.longitudVarilla} m`);
  }
  materiales.push(mat('alambre16', 'Alambre negro N°16', 'kg', total * f * num(T.acero.alambrePorKg)));

  return { cantidad: total, und: 'kg', materiales, detalle: notas.join(' · '), rendKey: 'acero' };
}
