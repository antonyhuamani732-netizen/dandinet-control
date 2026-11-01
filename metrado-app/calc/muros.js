import { mat, num } from './util.js';

// Cara visible y espesor según el aparejo (dimensiones en cm).
export function caraYEspesor(lad, aparejo) {
  const { L, A, H } = lad;
  if (aparejo === 'soga') return { a: L, b: H, e: A };
  if (aparejo === 'cabeza') return { a: A, b: H, e: L };
  if (aparejo === 'canto') return { a: L, b: A, e: H };
  throw new Error(`Aparejo desconocido: ${aparejo}`);
}

// Fórmulas CAPECO por m² de muro (sin desperdicio).
export function porM2(lad, aparejo, juntaCm) {
  const l = { L: num(lad.L) / 100, A: num(lad.A) / 100, H: num(lad.H) / 100 };
  const j = num(juntaCm) / 100;
  const { a, b, e } = caraYEspesor(l, aparejo);
  const ladrillos = 1 / ((a + j) * (b + j));
  const mortero = e - ladrillos * l.L * l.A * l.H;
  return { ladrillos, mortero, espesor: e };
}

// p = { ladrillo, ladPers: {L,A,H}, aparejo, junta, mortero, largo, alto, vanos: [{ancho, alto, cant}], n }
export function calcMuro(p, T) {
  const lad = p.ladrillo === 'otro' ? p.ladPers : T.ladrillos[p.ladrillo];
  if (!lad) throw new Error('Elige un tipo de ladrillo');
  const nombreLad = p.ladrillo === 'otro' ? `Ladrillo ${lad.L}×${lad.A}×${lad.H}` : `Ladrillo ${T.ladrillos[p.ladrillo].nombre}`;
  const vanos = (p.vanos || []).reduce((s, v) => s + num(v.ancho) * num(v.alto) * (num(v.cant) || 1), 0);
  const bruta = num(p.largo) * num(p.alto);
  if (vanos > bruta) throw new Error('Los vanos superan el área del muro');
  const area = (bruta - vanos) * (num(p.n) || 1);

  const u = porM2(lad, p.aparejo, p.junta);
  const fl = 1 + num(T.desperdicioLadrillo) / 100;
  const fm = 1 + num(T.desperdicioMortero) / 100;
  const vm = area * u.mortero * fm;
  const m = T.mortero[p.mortero];
  if (!m) throw new Error(`Sin dosificación de mortero ${p.mortero}`);

  return {
    cantidad: area,
    und: 'm²',
    materiales: [
      mat(`ladrillo_${p.ladrillo === 'otro' ? `${lad.L}x${lad.A}x${lad.H}` : p.ladrillo}`, nombreLad, 'und', area * u.ladrillos * fl),
      mat('cemento', 'Cemento Portland tipo I', 'bls', vm * m.cemento),
      mat('arena', 'Arena gruesa', 'm³', vm * m.arena),
      mat('agua', 'Agua', 'm³', vm * m.agua),
    ],
    detalle: `${u.ladrillos.toFixed(2)} lad/m² · mortero ${u.mortero.toFixed(4)} m³/m² · vanos ${vanos.toFixed(2)} m²`,
    rendKey: `muro.${p.aparejo}`,
  };
}
