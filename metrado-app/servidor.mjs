// Servidor local para usar la app desde el celular por la IP de la PC (misma red WiFi).
// Sin dependencias: solo Node.js. Uso:  node servidor.mjs [puerto]
// Si existen certificados/cert.pem y certificados/key.pem, también sirve por HTTPS (puerto + 363).
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = Number(process.argv[2] || process.env.PUERTO || 8080);
const PUERTO_HTTPS = PUERTO + 363; // 8080 → 8443

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
// Solo se sirven archivos de la app (nunca pruebas, servidor ni certificados).
const PRIVADO = /^\/(tests|certificados|node_modules)\/|^\/(servidor\.mjs|package(-lock)?\.json|iniciar-servidor\.bat)$/;

function atender(req, res) {
  let ruta;
  try {
    ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end('Solicitud no válida');
    return;
  }
  if (ruta.endsWith('/')) ruta += 'index.html';
  const archivo = path.normalize(path.join(RAIZ, ruta));
  if (!archivo.startsWith(RAIZ + path.sep) || PRIVADO.test(ruta) || !TIPOS[path.extname(archivo).toLowerCase()]) {
    res.writeHead(404).end('No encontrado');
    return;
  }
  fs.readFile(archivo, (err, datos) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
      return;
    }
    const ext = path.extname(archivo).toLowerCase();
    res.writeHead(200, {
      'Content-Type': TIPOS[ext] || 'application/octet-stream',
      // El service worker y el HTML siempre frescos, para que las actualizaciones lleguen.
      'Cache-Control': ext === '.html' || ruta === '/sw.js' ? 'no-cache' : 'max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(datos);
  });
}

function ipsLocales() {
  const out = [];
  for (const [nombre, lista] of Object.entries(os.networkInterfaces())) {
    for (const i of lista || []) {
      if (i.family === 'IPv4' && !i.internal) out.push({ nombre, ip: i.address });
    }
  }
  return out;
}

function avisarError(err, puerto) {
  if (err.code === 'EADDRINUSE') console.error(`\nEl puerto ${puerto} ya está en uso. Prueba: node servidor.mjs ${puerto + 1}`);
  else console.error('\nNo se pudo iniciar el servidor:', err.message);
  process.exit(1);
}

http.createServer(atender).listen(PUERTO, '0.0.0.0', () => {
  const ips = ipsLocales();
  console.log('\n  METRADO CAPECO · servidor local\n');
  console.log(`  En esta PC:       http://localhost:${PUERTO}/`);
  for (const { nombre, ip } of ips) console.log(`  En el celular:    http://${ip}:${PUERTO}/   (${nombre})`);
  if (!ips.length) console.log('  No se encontró una red. Conecta la PC al WiFi o al router.');
  console.log('\n  El celular debe estar en la misma red WiFi que esta PC.');
  console.log('  Si no abre, permite "Node.js" en el Firewall de Windows (redes privadas).');
  console.log('  Para cerrar el servidor: Ctrl + C\n');
}).on('error', (e) => avisarError(e, PUERTO));

const cert = path.join(RAIZ, 'certificados', 'cert.pem');
const key = path.join(RAIZ, 'certificados', 'key.pem');
if (fs.existsSync(cert) && fs.existsSync(key)) {
  https.createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(key) }, atender)
    .listen(PUERTO_HTTPS, '0.0.0.0', () => {
      for (const { ip } of ipsLocales()) console.log(`  Con HTTPS:        https://${ip}:${PUERTO_HTTPS}/`);
      console.log('');
    })
    .on('error', (e) => avisarError(e, PUERTO_HTTPS));
}
