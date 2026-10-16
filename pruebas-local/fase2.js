/**
 * PRUEBAS DE ACEPTACIÓN DE LA FASE 2 EN LA PC (sin Google)
 * --------------------------------------------------------------------------
 * Carga TODO backend/*.gs en el simulador de Google Sheets y corre los MISMOS pasos
 * de backend/Pruebas.gs que después se corren en Google (correrPruebasEnGoogle).
 *
 * Uso:  node pruebas-local/fase2.js
 */
process.env.TZ = 'America/Lima';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { crearGoogle } = require('./google-mock');

const raiz = path.join(__dirname, '..');
const build = process.argv[2] || path.join(raiz, '..', 'MACROS EXCEL', 'CONTROL 2026 v2 - fuentes', 'build');

const google = crearGoogle({ usuario: 'dandinetcontrolclientes@gmail.com' });
const ctx = vm.createContext(Object.assign({ console, Date, Math, JSON, Object, Array, String, Number, parseInt,
  parseFloat, isNaN, encodeURIComponent, Error }, google.G));
for (const f of fs.readdirSync(path.join(raiz, 'backend')).filter((x) => x.endsWith('.gs')).sort()) {
  vm.runInContext(fs.readFileSync(path.join(raiz, 'backend', f), 'utf8'), ctx, { filename: f });
}
google.subirArchivo('migracion.json', fs.readFileSync(path.join(build, 'migracion.json'), 'utf8'));
google.subirArchivo('esperado.json', fs.readFileSync(path.join(build, 'esperado.json'), 'utf8'));

const t0 = Date.now();
const P = ctx.correrTodasLasPruebas_();
console.log(P.log.join('\n'));
console.log(`\n${P.fallos === 0 ? '✅ TODO OK' : '❌ ' + P.fallos + ' FALLO(S)'}: ${P.total - P.fallos}/${P.total} verificaciones en ${P.casos.length} casos · ${Date.now() - t0} ms`);
check = google.candadoLibre();
if (!check) console.log('❌ el candado quedó tomado');
process.exit(P.fallos || !check ? 1 : 0);
