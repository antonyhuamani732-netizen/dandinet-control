import { ELEMENTOS_CONCRETO } from '../data/capeco.js';
import { mat, num } from './util.js';

// Volumen de un elemento (m³) a partir de sus dimensiones.
export function volumenElemento(elemento, dims, T, peralte) {
  const d = dims.map(num);
  if (elemento === 'losa_aligerada') {
    const fila = T.aligerado[peralte];
    if (!fila) throw new Error(`No hay datos de aligerado para h = ${peralte} cm`);
    return d[0] * d[1] * fila.concreto;
  }
  if (elemento === 'escalera') {
    const [ancho, lInc, garganta, pasos, paso, cp] = d;
    return ancho * (lInc * garganta + (pasos * paso * cp) / 2);
  }
  return d[0] * d[1] * d[2];
}

// p = { elemento, dims: [...], n, mezcla: '210' | 'ciclopeo', peralte }
export function calcConcreto(p, T) {
  const el = ELEMENTOS_CONCRETO[p.elemento];
  if (!el) throw new Error(`Elemento desconocido: ${p.elemento}`);
  const n = num(p.n) || 1;
  const volumen = volumenElemento(p.elemento, p.dims, T, p.peralte) * n;
  const f = 1 + num(T.concreto.desperdicio) / 100;
  const materiales = [];

  if (p.mezcla === 'ciclopeo' && el.ciclopeo) {
    const c = T.concreto.ciclopeo[el.ciclopeo];
    const piedra = el.ciclopeo === 'cimiento' ? ['piedra_grande', 'Piedra grande 8"'] : ['piedra_mediana', 'Piedra mediana 4"'];
    materiales.push(
      mat('cemento', 'Cemento Portland tipo I', 'bls', volumen * c.cemento * f),
      mat('hormigon', 'Hormigón', 'm³', volumen * c.hormigon * f),
      mat(piedra[0], piedra[1], 'm³', volumen * c.piedra * f),
      mat('agua', 'Agua', 'm³', volumen * c.agua * f),
    );
  } else {
    const c = T.concreto.fc[p.mezcla];
    if (!c) throw new Error(`No hay dosificación para f'c = ${p.mezcla}`);
    materiales.push(
      mat('cemento', 'Cemento Portland tipo I', 'bls', volumen * c.cemento * f),
      mat('arena', 'Arena gruesa', 'm³', volumen * c.arena * f),
      mat('piedra', 'Piedra chancada 1/2"', 'm³', volumen * c.piedra * f),
      mat('agua', 'Agua', 'm³', volumen * c.agua * f),
    );
  }

  let detalle = '';
  if (p.elemento === 'losa_aligerada') {
    const fila = T.aligerado[p.peralte];
    const area = num(p.dims[0]) * num(p.dims[1]) * n;
    const fl = 1 + num(T.aligerado.desperdicioLadrillo) / 100;
    materiales.push(mat(`ladrillo_techo_${fila.altoLadrillo}`, `Ladrillo de techo 30×30×${fila.altoLadrillo}`, 'und', area * fila.ladrillo * fl));
    detalle = `Área de losa ${area.toFixed(2)} m² · ${fila.concreto} m³/m²`;
  }

  return { cantidad: volumen, und: 'm³', materiales, detalle, rendKey: `concreto.${p.elemento}` };
}
