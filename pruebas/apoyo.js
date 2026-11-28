// Lo común de las pruebas: Playwright y un servidor estático que sirve el sitio desde la raíz del repo.
// No va al sitio publicado (.vercelignore deja por fuera esta carpeta).
const http = require("http"), fs = require("fs"), path = require("path");
const RAIZ = path.join(__dirname, "..");
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".json": "application/json",
  ".avif": "image/avif", ".webp": "image/webp", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".webm": "video/webm" };

function playwright() {
  for (const ruta of [process.env.PLAYWRIGHT, "playwright", "/opt/node22/lib/node_modules/playwright"]) {
    if (!ruta) continue;
    try { return require(ruta); } catch (e) {}
  }
  throw new Error("No encuentro Playwright. Instálalo (npm i -g playwright) o pon su ruta en la variable PLAYWRIGHT.");
}

// Como el alojamiento: /planes/ entrega planes/index.html, /planes redirige a /planes/ y lo que no existe entrega 404.html con estado 404.
function iniciar(puerto) {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      let ruta = decodeURIComponent(req.url.split("?")[0]);
      const consulta = req.url.includes("?") ? "?" + req.url.split("?").slice(1).join("?") : "";
      let archivo = path.join(RAIZ, path.normalize(ruta));
      if (!archivo.startsWith(RAIZ)) { res.writeHead(403); res.end(); return; }
      if (fs.existsSync(archivo) && fs.statSync(archivo).isDirectory()) {
        if (!ruta.endsWith("/")) { res.writeHead(308, { Location: ruta + "/" + consulta }); res.end(); return; }
        archivo = path.join(archivo, "index.html");
      }
      if (!fs.existsSync(archivo) || archivo.includes(path.sep + "pruebas" + path.sep) || archivo.includes(path.sep + "herramientas" + path.sep) || archivo.includes(path.sep + ".git")) {
        res.writeHead(404, { "Content-Type": TIPOS[".html"] }); fs.createReadStream(path.join(RAIZ, "404.html")).pipe(res); return;
      }
      const tipo = TIPOS[path.extname(archivo)] || "application/octet-stream", peso = fs.statSync(archivo).size;
      // Peticiones por rangos (206), como las atiende el alojamiento: el video las necesita para avanzar y Safari para reproducir
      const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
      if (rango && (rango[1] || rango[2])) {
        let desde = rango[1] ? Number(rango[1]) : peso - Number(rango[2]), hasta = rango[1] && rango[2] ? Number(rango[2]) : peso - 1;
        if (desde < 0 || desde >= peso) { res.writeHead(416, { "Content-Range": "bytes */" + peso }); res.end(); return; }
        hasta = Math.min(hasta, peso - 1);
        res.writeHead(206, { "Content-Type": tipo, "Accept-Ranges": "bytes", "Content-Range": "bytes " + desde + "-" + hasta + "/" + peso, "Content-Length": hasta - desde + 1 });
        fs.createReadStream(archivo, { start: desde, end: hasta }).pipe(res); return;
      }
      res.writeHead(200, { "Content-Type": tipo, "Accept-Ranges": "bytes", "Content-Length": peso });
      fs.createReadStream(archivo).pipe(res);
    });
    s.listen(puerto, "127.0.0.1", () => ok(s));
  });
}

const PAGINAS = ["/", "/planes/", "/como-funciona/", "/otros-servicios/", "/portafolios/"];
module.exports = { playwright, iniciar, RAIZ, PAGINAS, TODAS: PAGINAS.concat(["/404.html"]) };
if (require.main === module) iniciar(Number(process.argv[2] || 4173)).then(() => console.log("http://127.0.0.1:" + (process.argv[2] || 4173) + "/"));
