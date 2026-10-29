export function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function mat(clave, nombre, und, cantidad) {
  return { clave, nombre, und, cantidad };
}
