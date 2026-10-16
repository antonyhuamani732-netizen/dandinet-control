/**
 * PRUEBA LOCAL DEL CUADRE (sin Google)
 * --------------------------------------------------------------------------
 * Carga los MISMOS archivos .gs de la carpeta backend en una máquina virtual
 * de Node y ejecuta la migración y el motor con migracion.json. Después compara
 * el resultado contra esperado.json.
 *
 * Uso (Node 18+, o el Node que trae VS Code):
 *   node pruebas-local/cuadre.js "<ruta a la carpeta build>"
 * Sin Node instalado, con VS Code:
 *   ELECTRON_RUN_AS_NODE=1 "<ruta>/Code.exe" pruebas-local/cuadre.js "<build>"
 */
process.env.TZ = 'America/Lima';
const fs = require('fs'), path = require('path'), vm = require('vm');

const raiz = path.join(__dirname, '..');
const build = process.argv[2] || path.join(raiz, '..', 'MACROS EXCEL', 'CONTROL 2026 v2 - fuentes', 'build');
const J = JSON.parse(fs.readFileSync(path.join(build, 'migracion.json'), 'utf8'));
const E = JSON.parse(fs.readFileSync(path.join(build, 'esperado.json'), 'utf8'));

// ---- 1. cargar los .gs en un contexto aislado (como el entorno global de Apps Script)
const ctx = vm.createContext({ console, Date, Math, JSON, Object, Array, String, Number, parseInt, parseFloat, isNaN });
for (const f of ['Esquema.gs', 'Config.gs', 'Utils.gs', 'Motor.gs', 'Migracion.gs']) {
  vm.runInContext(fs.readFileSync(path.join(raiz, 'backend', f), 'utf8'), ctx, { filename: f });
}
const G = (expr) => vm.runInContext(expr, ctx);

let fallos = 0;
const check = (ok, txt) => { if (!ok) fallos++; console.log((ok ? '  OK    ' : '  FALLO ') + txt); };

// ---- 2. utilidades básicas
console.log('\n== Utilidades ==');
check(G(`txtFecha(fechaVence(aDia('2026-02-01'), 30))`) === '28/02/2026', 'fechaVence ajusta febrero (día 30 → 28/02)');
check(G(`r2(2.675)`) === 2.68 && G(`r2(0.1+0.2)`) === 0.3, 'redondeo a 2 decimales');
check(G(`docValido('01234567') && docValido('20123456789') && !docValido('104849128') && !docValido('30123456789')`), 'validación DNI/RUC');
check(G(`telefonoValido('987654321') && !telefonoValido('888888888') && !telefonoValido('9123456789')`), 'validación de celular');
check(G(`aDia(new Date(2026,7,4)) === aDia('2026-08-04') && aDia('04/08/2026') === aDia('2026-08-04')`), 'fechas Date / texto equivalentes');
check(G(`soles(18975.5)`) === 'S/ 18,975.50', 'formato soles');

// ---- 3. construir filas desde migracion.json
console.log('\n== Migración (construir filas) ==');
G('_cfgFijar({})');
ctx.J = J;
G(`var R = construirFilasMigracion(J, 'admin@dandinet.pe')`);
const F = G('R.filas');
for (const t of ['Clientes', 'Servicios', 'Cargos', 'Pagos', 'PagosDet', 'PPPoE', 'HistorialEstados', 'HistPPPoE', 'Planes', 'Listas', 'Config', 'Usuarios'])
  console.log(`  ${t.padEnd(18)} ${String(F[t].length).padStart(5)} filas`);
const cC = G('ESQUEMA.Clientes.cols');
const dniCero = F.Clientes.find(r => /^0\d{7}$/.test(r[cC.indexOf('DNI_RUC')]));
check(!!dniCero, 'el DNI que empieza con 0 conserva el cero inicial (texto)');
check(F.Config.find(r => r[0] === 'UltRecibo')[1] === '115', 'UltRecibo = 115 (el siguiente será R-000116)');
check(F.ClientesPriv.length === F.Clientes.length && !cC.includes('CLAVE_WIFI'), 'claves WiFi separadas en ClientesPriv');
const claves = new Set(F.Cargos.map(r => r[1]));
check(claves.size === F.Cargos.length, 'clave única ID_SERV|AAAA-MM|CONCEPTO sin repetidos');

// ---- 4. cuadre contra esperado.json
console.log('\n== Cuadre contra esperado.json (corte ' + E.fecha_cache + ', día de vencimiento = 1) ==');
ctx.E = E;
G(`var T = {}; ['Clientes','Servicios','Cargos','PagosDet','PPPoE','ResumenCliente','Pagos'].forEach(function(t){ T[t] = tablaMem(t, R.filas[t]); });`);
const res = G('compararCuadre(T, E)');
for (const l of res.lineas) {
  check(l[0] === 'OK', `${l[1]}: esperado ${l[2]} | obtenido ${l[3]}${l[4] ? '  → ' + l[4] : ''}`);
}
console.log('\n  ' + (res.cuadra ? '✅ CUADRA: el motor reproduce el Excel al centavo' : '❌ NO CUADRA'));

// ---- 5. foto del sistema a la fecha de hoy (configuración real: día de vencimiento 4)
console.log('\n== Estado al día de hoy (día de vencimiento real = 4) ==');
G(`var T2 = {}; ['Clientes','Servicios','Cargos','PagosDet','PPPoE','ResumenCliente'].forEach(function(t){ T2[t] = tablaMem(t, construirFilasMigracion(J,'').filas[t]); });`);
const hoy = G('calcularMotor(T2, {})');
console.log('  ' + JSON.stringify(hoy));
console.log('  (Ojo: los pagos posteriores al 04/08/2026 no están en migracion.json, así que esta deuda está inflada.)');

console.log('\n== Avisos de migración (pendientes heredados) ==');
G('R.avisos').forEach((a, i) => console.log(`  ${String(i + 1).padStart(2)}. ${a}`));

console.log(`\n${fallos === 0 ? 'TODO OK' : fallos + ' FALLO(S)'}`);
process.exit(fallos ? 1 : 0);
