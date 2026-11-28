// Capturas de página completa de las seis páginas en celular (390) y escritorio (1440), el menú del celular abierto,
// y las medidas de cada página: cuántas pantallas mide, cuánto pesa, cuántas peticiones hace y LCP y CLS de laboratorio.
// Uso: node pruebas/capturas.js [carpeta de salida] [carpeta del sitio, por defecto la raíz del repo]
const fs = require("fs"), path = require("path"), http = require("http");
const { playwright, iniciar, TODAS } = require("./apoyo");
const { chromium } = playwright();
const SALIDA = process.argv[2] || path.join(__dirname, "capturas");
const OTRA = process.argv[3];   // para medir otra copia del sitio (por ejemplo, la versión anterior)
const PUERTO = 4182, BASE = "http://127.0.0.1:" + PUERTO;
const nombre = (ruta) => ruta.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace("404-html", "404") || "inicio";
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".woff2": "font/woff2", ".pdf": "application/pdf" };
const servirOtra = (raiz) => new Promise((ok) => { const s = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); if (u.endsWith("/")) u += "index.html"; const f = path.join(raiz, u);
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": TIPOS[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); }); s.listen(PUERTO, "127.0.0.1", () => ok(s)); });

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const servidor = OTRA ? await servirOtra(OTRA) : await iniciar(PUERTO);
  const rutas = OTRA ? ["/"] : TODAS;
  const navegador = await chromium.launch();
  const medidas = [];
  for (const v of [{ n: "celular", w: 390, h: 844 }, { n: "escritorio", w: 1440, h: 900 }]) {
    const ctx = await navegador.newContext({ viewport: { width: v.w, height: v.h }, isMobile: v.n === "celular", hasTouch: v.n === "celular" });
    await ctx.addInitScript(() => { window.__lcp = 0; window.__cls = 0;
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch (e) {} });
    for (const ruta of rutas) {
      const page = await ctx.newPage(); const pedidos = new Set();
      page.on("request", (r) => { if (r.url().startsWith(BASE)) pedidos.add(new URL(r.url()).pathname); });
      await page.goto(BASE + ruta, { waitUntil: "networkidle" }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SALIDA, v.n + "-" + nombre(ruta) + "-primera-pantalla.png") });
      const m = await page.evaluate(() => ({ lcp: Math.round(window.__lcp), cls: Math.round(window.__cls * 1000) / 1000 }));
      await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo({ top: 0, behavior: "instant" }); });
      await page.waitForTimeout(2400);
      const alto = await page.evaluate(() => document.documentElement.scrollHeight);
      // Peso: lo que pesa en disco cada archivo que pidió la página (sin compresión del servidor)
      let peso = 0; const peticiones = pedidos.size;
      for (const u of pedidos) { let f = path.join(OTRA || path.join(__dirname, ".."), decodeURIComponent(u)); if (u.endsWith("/")) f = path.join(f, "index.html"); if (fs.existsSync(f)) peso += fs.statSync(f).size; }
      medidas.push({ pagina: ruta, vista: v.n, pantallas: Math.round(alto / v.h * 10) / 10, alto, pesoKB: Math.round(peso / 102.4) / 10, peticiones, lcpMs: m.lcp, cls: m.cls });
      await page.addStyleTag({ content: ".plan-barra,.wa-flota{display:none!important}" });   // lo fijo de abajo taparía una franja de la captura larga
      await page.screenshot({ path: path.join(SALIDA, v.n + "-" + nombre(ruta) + ".png"), fullPage: true });
      await page.close();
    }
    if (v.n === "celular" && !OTRA) {
      const page = await ctx.newPage(); await page.goto(BASE + "/planes/", { waitUntil: "networkidle" });
      await page.locator("#menu-btn").click(); await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SALIDA, "celular-menu-abierto.png") });
      await page.locator("#menu-btn").click();
      await page.locator("#b2").evaluate((e) => e.scrollIntoView({ block: "start", behavior: "instant" })); await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(SALIDA, "celular-planes-con-barras.png") });
      await page.goto(BASE + "/otros-servicios/", { waitUntil: "networkidle" }); await page.evaluate(() => window.scrollTo({ top: 1500, behavior: "instant" })); await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(SALIDA, "celular-whatsapp-flotante.png") });
      await page.close();
    }
    await ctx.close();
  }
  await navegador.close(); servidor.close();
  fs.writeFileSync(path.join(SALIDA, "medidas.json"), JSON.stringify(medidas, null, 1));
  console.log("Medidas de laboratorio (servidor local, sin red de por medio):");
  for (const m of medidas) console.log([m.vista.padEnd(10), m.pagina.padEnd(18), (m.pantallas + " pantallas").padEnd(15), (m.pesoKB + " KB").padEnd(10), (m.peticiones + " peticiones").padEnd(14), "LCP " + m.lcpMs + " ms", "CLS " + m.cls].join(" "));
})().catch((e) => { console.error(e); process.exit(1); });
