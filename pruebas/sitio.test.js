// Pruebas del sitio completo: páginas, menú y pie, enlaces, direcciones viejas, referencia de campaña, sin JavaScript,
// desbordes, contraste y lo fijo de abajo en celular. Uso: node pruebas/sitio.test.js
const fs = require("fs"), path = require("path");
const { playwright, iniciar, RAIZ, PAGINAS, TODAS } = require("./apoyo");
const { chromium } = playwright();
const PUERTO = 4181, BASE = "http://127.0.0.1:" + PUERTO;
const WA = "https://wa.me/573052007745?text=";
const ARCHIVO = { "/": "index.html", "/planes/": "planes/index.html", "/como-funciona/": "como-funciona/index.html", "/otros-servicios/": "otros-servicios/index.html", "/portafolios/": "portafolios/index.html", "/404.html": "404.html" };
const resultados = [];
function ok(nombre, condicion, detalle) { resultados.push({ nombre, pasa: !!condicion, detalle: detalle == null ? "" : String(detalle) }); }
function igual(nombre, obtenido, esperado) { ok(nombre, obtenido === esperado, "obtenido: " + JSON.stringify(obtenido) + (obtenido === esperado ? "" : " · esperado: " + JSON.stringify(esperado))); }
const leer = (ruta) => fs.readFileSync(path.join(RAIZ, ARCHIVO[ruta]), "utf8");
const mensaje = (href) => decodeURIComponent(href.replace(WA, ""));
// Espera a que la página deje de moverse (los saltos a un ancla van con desplazamiento suave).
async function quieta(page) { let antes = -1; for (let i = 0; i < 40; i++) { const y = await page.evaluate(() => Math.round(scrollY)); if (y === antes) return; antes = y; await page.waitForTimeout(150); } }

function vigilar(page) {
  page._errores = []; page._externas = []; page._fallidas = [];
  page.on("pageerror", (e) => page._errores.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") page._errores.push(m.text()); });
  page.on("request", (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith("data:")) page._externas.push(r.url()); });
  page.on("requestfailed", (r) => page._fallidas.push(r.url()));
  page.on("response", (r) => { if (r.status() >= 400) page._fallidas.push(r.status() + " " + r.url()); });
  return page;
}

(async () => {
  const servidor = await iniciar(PUERTO);
  const navegador = await chromium.launch();
  const nuevo = async (ancho, alto, extra) => {
    const ctx = await navegador.newContext(Object.assign({ viewport: { width: ancho, height: alto || 844 }, isMobile: ancho < 700, hasTouch: ancho < 700 }, extra || {}));
    await ctx.route(/wa\.me|whatsapp\.com|facebook\.(net|com)/, (r) => r.abort());
    return ctx;
  };

  // ---------- 1. Bloques compartidos: cabecera, cierre y pie idénticos en las seis páginas ----------
  const bloque = (html, nombre) => {
    const m = html.match(new RegExp("<!-- ===== BLOQUE COMPARTIDO · " + nombre + " ·[\\s\\S]*?<!-- ===== FIN DEL BLOQUE COMPARTIDO · " + nombre + " ===== -->"));
    return m ? m[0].replace(/ aria-current="page"/g, "") : null;
  };
  for (const nombre of ["CABECERA", "CIERRE", "PIE"]) {
    const fuente = bloque(leer("/"), nombre);
    ok("Bloque " + nombre + ": existe en index.html (la fuente)", !!fuente && fuente.length > 300, fuente ? fuente.length + " caracteres" : "no está");
    for (const ruta of TODAS.slice(1)) igual("Bloque " + nombre + " idéntico en " + ARCHIVO[ruta], bloque(leer(ruta), nombre) === fuente, true);
  }
  for (const ruta of TODAS) {
    const html = leer(ruta), actuales = [...html.matchAll(/<a href="([^"]+)" aria-current="page"/g)].map((m) => m[1]);
    igual("Página actual marcada en el menú y en el pie · " + ruta, actuales.join(" "), ruta === "/404.html" ? "" : ruta + " " + ruta);
  }
  ok("El menú va escrito en el HTML, no lo inyecta el JavaScript", !/menu-lista|<nav/.test(fs.readFileSync(path.join(RAIZ, "assets/js/app.js"), "utf8")));

  // ---------- 2. Cada página: carga, consola, red, h1, título, descripción, canónica, imágenes ----------
  const titulos = {}, descripciones = {};
  const enlaces = new Set();
  for (const ancho of [360, 768, 1280]) {
    const ctx = await nuevo(ancho, ancho < 700 ? 780 : 900);
    for (const ruta of TODAS) {
      const page = vigilar(await ctx.newPage());
      const resp = await page.goto(BASE + ruta, { waitUntil: "networkidle" });
      await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(300);
      const d = await page.evaluate(() => ({
        ancho: document.documentElement.scrollWidth, vista: document.documentElement.clientWidth, h1: [...document.querySelectorAll("h1")].map((h) => h.innerText.replace(/\s+/g, " ").trim()),
        lang: document.documentElement.lang, titulo: document.title, desc: (document.querySelector('meta[name="description"]') || {}).content || "",
        canon: (document.querySelector('link[rel="canonical"]') || {}).href || "", og: ["og:title", "og:description", "og:image"].every((p) => document.querySelector('meta[property="' + p + '"]')),
        imgs: [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt") || !i.getAttribute("width") || !i.getAttribute("height") || !i.naturalWidth).length,
        salto: (document.querySelector(".salto") || {}).hash === "#principal" && !!document.getElementById("principal"),
        niveles: (() => { let antes = 0, malos = 0; document.querySelectorAll("h1,h2,h3,h4").forEach((h) => { const n = Number(h.tagName[1]); if (n > antes + 1) malos++; antes = n; }); return malos; })(),
        enlaces: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
      }));
      const marca = ruta + " a " + ancho + " px";
      ok("Carga " + marca + ": 200, sin errores de consola, sin fallidas ni otros dominios", resp.status() === 200 && !page._errores.length && !page._fallidas.length && !page._externas.length, [resp.status()].concat(page._errores, page._fallidas, page._externas).join(" | "));
      ok("Sin desborde horizontal · " + marca, d.ancho <= d.vista, d.ancho + " de " + d.vista);
      if (ancho === 360) {
        igual("Un solo h1 · " + ruta, d.h1.length, 1);
        ok("lang es-CO, imágenes con alt y medidas, enlace para saltar al contenido, encabezados en orden · " + ruta, d.lang === "es-CO" && d.imgs === 0 && d.salto && d.niveles === 0, [d.lang, "imágenes malas " + d.imgs, "salto " + d.salto, "saltos de nivel " + d.niveles].join(" · "));
        ok("Etiquetas para compartir · " + ruta, d.og);
        if (ruta !== "/404.html") {
          igual("Canónica · " + ruta, d.canon, "https://www.cjcasadigital.com" + ruta);
          titulos[ruta] = d.titulo; descripciones[ruta] = d.desc;
          ok("Título y descripción con largo razonable · " + ruta, d.titulo.length >= 20 && d.titulo.length <= 65 && d.desc.length >= 60 && d.desc.length <= 160, d.titulo.length + " y " + d.desc.length + " caracteres");
        }
        d.enlaces.forEach((e) => enlaces.add(ruta + " → " + e));
      }
      await page.close();
    }
    await ctx.close();
  }
  igual("Títulos únicos en las cinco páginas", new Set(Object.values(titulos)).size, 5);
  igual("Descripciones únicas en las cinco páginas", new Set(Object.values(descripciones)).size, 5);

  // ---------- 3. Todos los enlaces internos y sus anclas llevan a algo que existe ----------
  {
    const ctx = await nuevo(1280, 900); const page = await ctx.newPage();
    const destinos = {};   // dirección sin ancla → { estado, ids }
    let internos = 0; const rotos = [], otros = new Set();
    for (const par of enlaces) {
      const [origen, href] = par.split(" → ");
      if (/^(https:\/\/wa\.me\/573052007745\?text=|mailto:cjcasadigital@gmail\.com$|https:\/\/www\.cjcasadigital\.com\/$)/.test(href)) continue;
      if (!href.startsWith("/") && !href.startsWith("#")) { otros.add(href); continue; }
      internos++;
      const url = new URL(href, BASE + origen), sinAncla = url.pathname;
      if (!destinos[sinAncla]) {
        if (/\.pdf$/.test(sinAncla)) { const r = await page.request.get(BASE + sinAncla); destinos[sinAncla] = { estado: r.status(), ids: [], tipo: r.headers()["content-type"], peso: (await r.body()).length }; }
        else { const r = await page.goto(BASE + sinAncla, { waitUntil: "domcontentloaded" }); destinos[sinAncla] = { estado: r.status(), ids: await page.evaluate(() => [...document.querySelectorAll("[id]")].map((e) => e.id)) }; }
      }
      const dst = destinos[sinAncla];
      if (dst.estado !== 200 || (url.hash && !dst.ids.includes(decodeURIComponent(url.hash.slice(1))))) rotos.push(par + " (" + dst.estado + ")");
    }
    ok("Todos los enlaces internos y anclas llevan a algo que existe (" + internos + " enlaces en las seis páginas)", internos >= 80 && !rotos.length, rotos.join(" | "));
    igual("No hay enlaces a otros sitios fuera de WhatsApp, el correo y la dirección propia", [...otros].join(" "), "");
    const pdfs = Object.keys(destinos).filter((k) => /\.pdf$/.test(k)).sort();
    igual("Los cinco PDF siguen en su dirección", pdfs.join(" "), "/portafolios/cj-planes-de-contenido.pdf /portafolios/cj-portafolio-general.pdf /portafolios/cj-scale-ai.pdf /portafolios/cj-speak.pdf /portafolios/cj-start-content.pdf");
    for (const k of pdfs) ok("PDF abre: " + k, destinos[k].estado === 200 && /pdf/.test(destinos[k].tipo) && destinos[k].peso > 50000, destinos[k].estado + " · " + Math.round(destinos[k].peso / 1024) + " KB");
    // Cada PDF en la página de su tema, además de Portafolios y el pie
    const principal = (ruta) => leer(ruta).split('<main id="principal">')[1].split("<!-- ===== BLOQUE COMPARTIDO · CIERRE")[0];
    ok("PDF en su contexto: Planes de contenido y Start Content en /planes/", /cj-planes-de-contenido\.pdf/.test(principal("/planes/")) && /cj-start-content\.pdf/.test(principal("/planes/")));
    ok("PDF en su contexto: Speak, Scale AI y Portafolio general en /otros-servicios/", ["cj-speak.pdf", "cj-scale-ai.pdf", "cj-portafolio-general.pdf"].every((f) => principal("/otros-servicios/").includes(f)));
    igual("Portafolios: los cinco con \"Abrir PDF\" y el enlace a su página", (principal("/portafolios/").match(/Abrir PDF/g) || []).length + " · " + [...principal("/portafolios/").matchAll(/class="enlace-ir" href="([^"]+)"/g)].map((m) => m[1]).join(" "), "5 · / /planes/ /planes/#arma-tu-plan /otros-servicios/#speak /planes/#start-content");
    igual("Pie: los cinco PDF", (leer("/").split("BLOQUE COMPARTIDO · PIE")[1].match(/\.pdf"/g) || []).length, 5);
    // 404 y archivos para buscadores
    const perdida = await page.goto(BASE + "/una/direccion/que-no-existe", { waitUntil: "networkidle" });
    ok("Una dirección que no existe entrega la 404, con su menú y sus enlaces desde la raíz", perdida.status() === 404 && (await page.locator("h1").innerText()).trim().toUpperCase() === "ESTA PÁGINA NO EXISTE" && (await page.locator('main a[href="/"]').count()) === 1 && (await page.locator(".marca img").first().evaluate((i) => i.naturalWidth > 0)));
    ok("La 404 no se indexa", /<meta name="robots" content="noindex">/.test(leer("/404.html")));
    const mapa = fs.readFileSync(path.join(RAIZ, "sitemap.xml"), "utf8"), robots = fs.readFileSync(path.join(RAIZ, "robots.txt"), "utf8");
    igual("sitemap.xml: las cinco páginas", [...mapa.matchAll(/<loc>https:\/\/www\.cjcasadigital\.com([^<]*)<\/loc>/g)].map((m) => m[1]).join(" "), PAGINAS.join(" "));
    ok("robots.txt apunta al sitemap", /Sitemap: https:\/\/www\.cjcasadigital\.com\/sitemap\.xml/.test(robots));
    const sinBarra = await page.goto(BASE + "/planes", { waitUntil: "domcontentloaded" });
    igual("/planes (sin barra final) termina en /planes/", page.url().replace(BASE, ""), "/planes/");
    await ctx.close();
  }

  // ---------- 4. Direcciones de cuando era una sola página ----------
  {
    const ctx = await nuevo(390, 844); const page = vigilar(await ctx.newPage());
    const viejas = { cotizador: "/planes/#arma-tu-plan", planes: "/planes/#planes", contenido: "/planes/#contenido", incluye: "/planes/#incluye", preguntas: "/planes/#preguntas",
      ia: "/otros-servicios/", como: "/como-funciona/#proceso", problema: "/como-funciona/", giro: "/como-funciona/", treinta: "/como-funciona/#proceso" };
    for (const [vieja, nueva] of Object.entries(viejas)) {
      await page.goto(BASE + "/planes/", { waitUntil: "domcontentloaded" });   // para que cada una sea una navegación completa
      await page.goto(BASE + "/#" + vieja, { waitUntil: "networkidle" });
      const destino = page.url().replace(BASE, ""), id = nueva.split("#")[1];
      ok("/#" + vieja + " → " + nueva, destino === nueva && (!id || (await page.locator("#" + id).count()) === 1), destino);
    }
    await page.goto(BASE + "/planes/", { waitUntil: "domcontentloaded" });
    await page.goto(BASE + "/?utm_campaign=promo#cotizador", { waitUntil: "networkidle" });
    igual("Una dirección vieja con campaña conserva la campaña", page.url().replace(BASE, ""), "/planes/?utm_campaign=promo#arma-tu-plan");
    await page.goto(BASE + "/#inicio", { waitUntil: "networkidle" });
    igual("/#inicio y las anclas que siguen en el inicio no se mueven", page.url().replace(BASE, ""), "/#inicio");
    igual("Sin errores al reenviar", page._errores.join(" | "), "");
    await ctx.close();
    // Sin JavaScript no hay reenvío: el inicio conserva esos id, sobre el bloque que lleva a la página nueva
    const sj = await nuevo(390, 844, { javaScriptEnabled: false }); const p2 = await sj.newPage();
    await p2.goto(BASE + "/#cotizador", { waitUntil: "networkidle" });
    const estan = await p2.evaluate((ids) => ids.filter((id) => { const e = document.getElementById(id); if (!e) return false; const cerca = e.closest("li, section"); return !!cerca.querySelector('a[href^="/planes/"], a[href^="/otros-servicios/"], a[href^="/como-funciona/"]'); }), Object.keys(viejas));
    igual("Sin JavaScript: los id viejos siguen en el inicio, junto al enlace a su página nueva", estan.length, Object.keys(viejas).length);
    await sj.close();
  }

  // ---------- 5. Menú: escritorio y hamburguesa del celular, con teclado ----------
  {
    const ctx = await nuevo(1280, 900); const page = await ctx.newPage();
    await page.goto(BASE + "/como-funciona/", { waitUntil: "networkidle" });
    igual("Menú de escritorio: cuatro ítems y el botón", (await page.locator(".menu-lista a:visible").evaluateAll((as) => as.map((a) => a.innerText.trim() + "→" + a.getAttribute("href")))).join(" · ") + " · [" + (await page.locator("#barra-plan").innerText()).trim() + "→" + (await page.locator("#barra-plan").getAttribute("href")) + "]",
      "Planes y precios→/planes/ · Cómo funciona→/como-funciona/ · Otros servicios→/otros-servicios/ · Portafolios→/portafolios/ · [Arma tu plan→/planes/#arma-tu-plan]");
    ok("Menú de escritorio: sin hamburguesa, y la página actual resaltada", !(await page.locator("#menu-btn").isVisible()) && (await page.locator('.menu-lista a[aria-current="page"]').innerText()).trim() === "Cómo funciona");
    igual("La barra queda fija al bajar", await page.evaluate(async () => { window.scrollTo(0, 1500); await new Promise((r) => setTimeout(r, 200)); return Math.round(document.getElementById("barra").getBoundingClientRect().top); }), 0);
    await page.locator('.menu-lista a[href="/portafolios/"]').click(); await page.waitForURL(/portafolios/);
    igual("Un clic del menú lleva a la página", page.url().replace(BASE, ""), "/portafolios/");
    await ctx.close();
  }
  for (const ancho of [360, 390]) {
    const ctx = await nuevo(ancho, 780); const page = vigilar(await ctx.newPage());
    await page.goto(BASE + "/otros-servicios/", { waitUntil: "networkidle" });
    const barra = await page.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const l = r(".barra .marca img"), c = r("#barra-plan"), b = r("#menu-btn");
      return { logo: Math.round(l.width), orden: l.right <= c.left && c.right <= b.left, cabe: b.right <= innerWidth - 8, boton: Math.round(b.width) + "×" + Math.round(b.height), cta: Math.round(c.height) }; });
    ok("Celular " + ancho + " px: logo de 100 px o más, \"Arma tu plan\" visible sin abrir el menú y hamburguesa a la derecha", barra.logo >= 100 && barra.orden && barra.cabe && barra.boton === "44×44" && barra.cta >= 44, JSON.stringify(barra));
    if (ancho !== 390) { await ctx.close(); continue; }
    const estado = () => page.evaluate(() => ({ abierto: document.getElementById("menu-btn").getAttribute("aria-expanded"), rotulo: document.getElementById("menu-btn").getAttribute("aria-label"),
      visible: getComputedStyle(document.getElementById("menu")).display !== "none", inerte: document.querySelector("main").hasAttribute("inert") && document.querySelector("footer").hasAttribute("inert"),
      foco: (document.activeElement.innerText || document.activeElement.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim(), enBarra: document.getElementById("barra").contains(document.activeElement) }));
    let e = await estado();
    ok("Hamburguesa: cerrado al cargar", e.abierto === "false" && !e.visible && e.rotulo === "Abrir el menú", JSON.stringify(e));
    await page.locator("#menu-btn").focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(350); e = await estado();
    ok("Hamburguesa: Enter lo abre, cambia el rótulo y deja inerte el resto de la página", e.abierto === "true" && e.visible && e.rotulo === "Cerrar el menú" && e.inerte, JSON.stringify(e));
    igual("Menú del celular: siete ítems con su línea", (await page.locator(".menu-lista a").evaluateAll((as) => as.map((a) => a.querySelector("b").innerText + " (" + a.querySelector("span").innerText + ")"))).join(" · "),
      "Inicio (Qué hacemos y por dónde empezar) · Planes y precios (Planes desde $1.600.000 al mes) · Arma tu plan (Escoge y mira el precio) · Cómo funciona (Un día de grabación al mes) · Otros servicios (Página web, automatización, IA y Speak) · Portafolios (Los cinco PDF para leer o reenviar) · Preguntas (Tiempo, pauta, garantía y cómo empezar)");
    igual("Menú del celular: al final, Arma tu plan y WhatsApp", (await page.locator(".menu-fin a").evaluateAll((as) => as.map((a) => a.innerText.trim()))).join(" · "), "Arma tu plan · Escríbenos por WhatsApp");
    ok("Menú del celular: ocupa la pantalla debajo de la barra y marca la página actual", await page.evaluate(() => { const r = document.getElementById("menu").getBoundingClientRect(); return r.left === 0 && Math.round(r.right) === innerWidth && Math.round(r.bottom) === innerHeight && Math.round(r.top) === Math.round(document.getElementById("barra").getBoundingClientRect().bottom); }) && (await page.locator('.menu-lista a[aria-current="page"] b').innerText()) === "Otros servicios");
    await page.keyboard.press("Tab"); e = await estado();
    ok("Hamburguesa: Tab entra al menú por el primer ítem", e.foco.startsWith("Inicio"), e.foco);
    const recorrido = [e.foco.split(" Qué")[0]]; let fuera = 0;
    for (let i = 0; i < 14; i++) { await page.keyboard.press("Tab"); e = await estado(); if (!e.enBarra) fuera++; recorrido.push(e.foco.slice(0, 22)); }
    ok("Hamburguesa: el foco no sale del menú mientras está abierto (da la vuelta)", fuera === 0 && recorrido.filter((x) => x.startsWith("Inicio")).length === 2, recorrido.join(" › "));
    await page.locator("#menu-btn").focus(); await page.keyboard.press("Shift+Tab"); e = await estado();
    ok("Hamburguesa: Mayús+Tab desde el botón va al logo y sigue dentro", e.enBarra, e.foco);
    await page.keyboard.press("Escape"); await page.waitForTimeout(200); e = await estado();
    ok("Hamburguesa: Escape lo cierra, devuelve el foco al botón y la página deja de estar inerte", e.abierto === "false" && !e.visible && e.foco === "Abrir el menú" && !e.inerte, JSON.stringify(e));
    await page.keyboard.press("Space"); await page.waitForTimeout(250);
    ok("Hamburguesa: la barra espaciadora también abre", (await estado()).abierto === "true");
    await page.locator("#menu-btn").click(); await page.waitForTimeout(200);
    ok("Hamburguesa: el mismo botón cierra", (await estado()).abierto === "false");
    await page.locator("#menu-btn").click(); await page.locator('.menu-lista a[href="/planes/#preguntas"]').click(); await page.waitForURL(/planes\/#preguntas/); await page.waitForLoadState("networkidle"); await quieta(page);
    ok("Menú del celular: \"Preguntas\" lleva a /planes/#preguntas y la sección queda a la vista, debajo de las barras", await page.evaluate(() => { const t = document.getElementById("preguntas").getBoundingClientRect().top; return t >= 100 && t < 260; }), await page.evaluate(() => Math.round(document.getElementById("preguntas").getBoundingClientRect().top)));
    await page.locator("#menu-btn").click(); await page.locator('.menu-lista a[href="/planes/#arma-tu-plan"]').click(); await page.waitForTimeout(900);
    ok("Menú del celular: un ancla de la misma página cierra el menú y baja", (await estado()).abierto === "false" && page.url().endsWith("#arma-tu-plan"));
    igual("Menú: sin errores de consola", page._errores.join(" | "), "");
    await ctx.close();
  }

  // ---------- 6. Fijo abajo en celular: barra del plan en /planes/, WhatsApp en las demás. Un solo número ----------
  {
    const ctx = await nuevo(390, 844); const numeros = new Set();
    for (const ruta of TODAS) {
      const page = await ctx.newPage(); await page.goto(BASE + ruta, { waitUntil: "networkidle" });
      const antes = await page.evaluate(() => { const f = document.getElementById("wa-flota"); return f ? getComputedStyle(f).visibility : "no hay"; });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.5)); await page.waitForTimeout(600);
      const d = await page.evaluate(() => { const v = (e) => !!e && getComputedStyle(e).visibility === "visible" && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().bottom <= innerHeight + 1 && e.getBoundingClientRect().top > innerHeight - 120;
        return { barra: document.querySelectorAll(".plan-barra").length, flota: document.querySelectorAll(".wa-flota").length, barraVisible: v(document.querySelector(".plan-barra")), flotaVisible: v(document.querySelector(".wa-flota")),
          alto: document.querySelector(".wa-flota") ? Math.round(document.querySelector(".wa-flota").getBoundingClientRect().height) : 0, wa: [...document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"]')].map((a) => a.getAttribute("href")) }; });
      d.wa.forEach((h) => numeros.add((h.match(/wa\.me\/(\d+)/) || [0, "otro: " + h])[1]));
      if (ruta === "/planes/") ok("Fijo abajo en /planes/: la barra del plan, sin botón flotante", d.barra === 1 && d.flota === 0 && d.barraVisible, JSON.stringify(d).slice(0, 90));
      else ok("Fijo abajo en " + ruta + ": WhatsApp flotante (aparece al bajar), sin barra del plan", d.barra === 0 && d.flota === 1 && antes === "hidden" && d.flotaVisible && d.alto >= 44, antes + " → " + JSON.stringify(d).slice(0, 90));
      if (ruta === "/") igual("WhatsApp flotante: su mensaje y su nombre accesible", mensaje(await page.locator("#wa-flota").getAttribute("href")) + " · " + (await page.locator("#wa-flota").getAttribute("aria-label")), "Hola, CJ. Vi la página y quiero mi diagnóstico de 15 minutos. · Escríbenos por WhatsApp");
      await page.close();
    }
    igual("Un solo número de WhatsApp en todo el sitio", [...numeros].join(" "), "573052007745");
    await ctx.close();
    const esc = await nuevo(1280, 900); const p2 = await esc.newPage(); await p2.goto(BASE + "/", { waitUntil: "networkidle" }); await p2.evaluate(() => window.scrollTo(0, 1200)); await p2.waitForTimeout(400);
    ok("En escritorio no hay botón flotante", !(await p2.locator("#wa-flota").isVisible()));
    await esc.close();
  }

  // ---------- 7. La referencia de campaña no se pierde al navegar ----------
  {
    const ctx = await nuevo(390, 844); const page = vigilar(await ctx.newPage());
    await page.goto(BASE + "/?utm_campaign=noviembre&utm_source=instagram", { waitUntil: "networkidle" });
    ok("Con campaña, los enlaces de WhatsApp del inicio ya llevan la referencia", mensaje(await page.locator(".acciones a[data-wa]").getAttribute("href")).endsWith(" Ref: noviembre"));
    await page.locator('.busca[href="/planes/"]').click(); await page.waitForURL(/\/planes\/$/); await page.waitForLoadState("networkidle");
    igual("Del inicio a /planes/ por una tarjeta: el plan sigue llevando la referencia", mensaje(await page.locator("#r-wa").getAttribute("href")), "Hola, CJ. Armé este plan en la página: Plan 8 (6 videos y 2 carruseles). Mensual: $1.600.000. Quiero mi diagnóstico de 15 minutos. Ref: noviembre");
    await page.goto(BASE + "/otros-servicios/", { waitUntil: "networkidle" });
    ok("…y también los \"Háblanos\" de Otros servicios", mensaje(await page.locator("#ia .serv a").first().getAttribute("href")) === "Hola, CJ. Quiero una página web para mi negocio. Ref: noviembre");
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.locator("#cal .cal-red button:nth-child(2)").evaluate((b) => { b.scrollIntoView({ block: "center" }); b.click(); });
    await page.locator("#cal-armar").evaluate((a) => a.click()); await page.waitForURL(/contenidos=9/); await page.waitForLoadState("networkidle"); await page.waitForTimeout(700);
    igual("Del calendario al cotizador: cantidad y referencia", mensaje(await page.locator("#r-wa").getAttribute("href")), "Hola, CJ. Armé este plan en la página: Plan 9 (7 videos y 2 carruseles). Mensual: $1.800.000. Quiero mi diagnóstico de 15 minutos. Ref: noviembre");
    await page.goto(BASE + "/planes/?utm_source=facebook", { waitUntil: "networkidle" });
    ok("Una campaña nueva reemplaza la anterior", mensaje(await page.locator("#r-wa").getAttribute("href")).endsWith(" Ref: facebook"));
    igual("Referencia: sin errores de consola", page._errores.join(" | "), "");
    const otra = await ctx.newPage(); await otra.goto(BASE + "/planes/", { waitUntil: "networkidle" });
    ok("Otra visita (otra pestaña) sin campaña no hereda la referencia", !/Ref:/.test(mensaje(await otra.locator("#r-wa").getAttribute("href"))));
    // Si el navegador no deja guardar, la página no se rompe
    const cerrado = await nuevo(390, 844); await cerrado.addInitScript(() => { Object.defineProperty(window, "sessionStorage", { get() { throw new Error("bloqueado"); } }); });
    const p3 = vigilar(await cerrado.newPage()); await p3.goto(BASE + "/planes/?utm_campaign=prueba", { waitUntil: "networkidle" });
    ok("Sin permiso para guardar en el navegador: no hay errores y la referencia de la dirección sirve", !p3._errores.length && mensaje(await p3.locator("#r-wa").getAttribute("href")).endsWith(" Ref: prueba"), p3._errores.join(" | "));
    await cerrado.close(); await ctx.close();
  }

  // ---------- 8. Inicio: tarjetas, tres pasos, precios desde CJ_PLAN, medición ----------
  {
    const ctx = await nuevo(390, 844); const page = vigilar(await ctx.newPage()); await page.goto(BASE + "/", { waitUntil: "networkidle" });
    igual("Inicio: titular con precio", (await page.locator(".desde").innerText()).replace(/\s+/g, " ").trim() + " / " + (await page.locator(".desde-2").innerText()).replace(/\s+/g, " ").trim(), "Planes desde $1.600.000 al mes / Plan completo desde $2.500.000");
    igual("Inicio: las cinco tarjetas son enlaces y llevan a su página", (await page.locator(".buscas a.busca").evaluateAll((as) => as.map((a) => a.getAttribute("href")))).join(" "), "/planes/ /planes/#start-content /otros-servicios/#speak /otros-servicios/ /portafolios/");
    igual("Inicio: textos de las tarjetas", (await page.locator(".busca-t").evaluateAll((ts) => ts.map((t) => t.innerText.replace(/\s+/g, " ").trim()))).join(" | "),
      "Quiero contenido para mis redes cada mes Plan 8, 12 o 15 · desde $1.600.000 al mes | Quiero empezar con algo pequeño Start Content · 3 videos y 1 hecho con IA en 15 días · $1.200.000, pago único | Quiero perderle el miedo a la cámara Speak · 4 u 8 clases virtuales · desde $800.000 | Página web, automatización o IA para mi negocio Se cotiza en el diagnóstico | Quiero ver los portafolios en PDF 5 documentos para leer o reenviar");
    ok("Inicio: toda la tarjeta se puede tocar", await page.locator(".busca").evaluateAll((as) => as.every((a) => { const r = a.getBoundingClientRect(), li = a.parentElement.getBoundingClientRect(); return r.width >= li.width - 1 && r.height >= 88 && r.height >= li.height - 1; })));
    const orden = await page.evaluate(() => { const y = (s) => Math.round(document.querySelector(s).getBoundingClientRect().top + scrollY); return { boton: y(".acciones"), tarjetas: y("#buscas"), calendario: y("#cal"), alto: innerHeight }; });
    ok("Inicio en celular: titular, precio y botones en la primera pantalla; tarjetas antes del calendario", orden.boton < orden.alto && orden.tarjetas < orden.calendario, JSON.stringify(orden));
    await page.locator('.busca[href="/planes/#start-content"]').click(); await page.waitForURL(/start-content/); await page.waitForLoadState("networkidle"); await quieta(page);
    ok("Tarjeta \"algo pequeño\" llega a Start Content, a la vista", await page.evaluate(() => { const t = document.getElementById("start-content").getBoundingClientRect().top; return t >= 100 && t < 260; }));
    const precios = await page.evaluate(() => { const P = window.CJ.plan, f = window.CJ.pesos; return { sc: document.querySelector('#start-content [data-p="startContent"]').textContent === f(P.startContent.precio), valor: P.startContent.precio }; });
    ok("Start Content sale de CJ_PLAN.startContent", precios.sc && precios.valor === 1200000);
    await page.goto(BASE + "/otros-servicios/", { waitUntil: "networkidle" });
    igual("Otros servicios: las cuatro tarjetas de IA", (await page.locator("#ia .serv h3").allInnerTexts()).join(" | "), "Página web | Automatización de procesos | Capacitación en IA para tu equipo | Portafolio y presentaciones");
    igual("Otros servicios: cada \"Háblanos\" abre WhatsApp con su mensaje", (await page.locator("#ia .serv a").evaluateAll((as) => as.map((a) => decodeURIComponent(a.href.split("text=")[1])))).join(" | "), "Hola, CJ. Quiero una página web para mi negocio. | Hola, CJ. Quiero automatizar un proceso de mi negocio. | Hola, CJ. Quiero una capacitación en IA para mi equipo. | Hola, CJ. Quiero un portafolio o una presentación para mi negocio.");
    igual("Speak: precios desde CJ_PLAN.speak, y \"Sumarlo a mi plan\" lleva la opción", (await page.locator(".speak").evaluateAll((ls) => ls.map((l) => l.querySelector("h3").innerText + " · " + l.querySelector(".speak-d").innerText + " · " + l.querySelector(".speak-p").innerText.replace(/\s+/g, " ").trim() + " → " + l.querySelector("a").getAttribute("href")))).join(" | "),
      "SPEAK PRO · 4 clases · $800.000, una vez → /planes/?speak=pro#arma-tu-plan | SPEAK PRO MAX · 8 clases · $1.600.000, una vez → /planes/?speak=promax#arma-tu-plan");
    igual("Speak: mensaje de WhatsApp", mensaje(await page.locator("#speak a[data-wa]").getAttribute("href")), "Hola, CJ. Quiero saber más de Speak, las clases para hablar frente a cámara.");
    const capa = await page.evaluate(() => window.dataLayer.map((e) => e.event).join(","));
    ok("Medición igual en todas las páginas: PageView, sin píxel cargado", capa === "PageView" && (await page.evaluate(() => typeof window.fbq === "undefined")), capa);
    await page.goto(BASE + "/como-funciona/", { waitUntil: "networkidle" });
    igual("Cómo funciona: una sola lista de siete pasos", (await page.locator("#proceso .pasos li").evaluateAll((ls) => ls.map((l) => l.innerText.replace(/\s+/g, " ").trim()))).join(" | "),
      "1 Diagnóstico de 15 minutos, gratis | 2 Estrategia: el mensaje y los temas del mes | 3 Guiones: cada video y cada texto, escritos | 4 Preparación: dos sesiones antes de grabar | 5 Grabación: un solo día, con dirección | 6 Edición y diseño de cada pieza | 7 Entrega con una ronda de ajustes");
    igual("Cómo funciona: su siguiente paso es ver los planes", (await page.locator("#garantia .sig a").innerText()).trim() + " → " + (await page.locator("#garantia .sig a").getAttribute("href")), "Ver los planes → /planes/");
    igual("Páginas sin cotizador: sin errores de consola", page._errores.join(" | "), "");
    await ctx.close();
  }

  // ---------- 9. Planes y precios: pestañas pegadas arriba ----------
  for (const ancho of [390, 1280]) {
    const ctx = await nuevo(ancho, ancho < 700 ? 844 : 900); const page = await ctx.newPage(); await page.goto(BASE + "/planes/", { waitUntil: "networkidle" });
    igual("Pestañas de /planes/ · " + ancho + " px", (await page.locator("#pestanas a").evaluateAll((as) => as.map((a) => a.innerText.trim() + a.getAttribute("href")))).join(" "), "Planes#planes Arma tu plan#arma-tu-plan Qué incluye#incluye Start Content#start-content Preguntas#preguntas");
    await page.locator('#pestanas a[href="#incluye"]').evaluate((a) => a.click()); await page.waitForTimeout(300); await quieta(page); await page.waitForTimeout(300);
    const d = await page.evaluate(() => { const b = document.getElementById("barra").getBoundingClientRect(), p = document.getElementById("pestanas").getBoundingClientRect(), s = document.getElementById("incluye").getBoundingClientRect(), f = document.querySelector(".plan-barra").getBoundingClientRect();
      return { pegadas: Math.round(p.top) === Math.round(b.bottom), seccion: Math.round(s.top - p.bottom), actual: (document.querySelector('#pestanas a[aria-current]') || {}).innerText, alto: Math.round(p.height), libre: Math.round((getComputedStyle(document.querySelector(".plan-barra")).display === "none" ? innerHeight : f.top) - p.bottom), vista: innerHeight }; });
    ok("Pestañas · " + ancho + " px: pegadas debajo de la barra, llevan a la sección sin taparla y marcan dónde vas", d.pegadas && d.seccion >= 0 && d.seccion < 40 && d.actual === "Qué incluye" && d.libre > d.vista * 0.6, JSON.stringify(d));
    await ctx.close();
  }

  // ---------- 10. Sin JavaScript: las cinco páginas se navegan y se leen completas ----------
  for (const ancho of [390, 1280]) {
    const ctx = await nuevo(ancho, 844, { javaScriptEnabled: false });
    for (const ruta of PAGINAS) {
      const page = await ctx.newPage(); await page.goto(BASE + ruta, { waitUntil: "networkidle" });
      const d = await page.evaluate(() => ({
        ocultos: [...document.querySelectorAll("main .rev, main h1, main h2, main p, main li")].filter((e) => !e.closest("[hidden]") && (getComputedStyle(e).opacity !== "1" || getComputedStyle(e).visibility !== "visible")).length,
        menu: [...document.querySelectorAll(".menu-lista a, .barra noscript a, a.menu-btn")].filter((a) => a.getClientRects().length).length, pie: [...document.querySelectorAll(".pie-col a")].filter((a) => a.getClientRects().length).length,
        boton: !!document.querySelector("button.menu-btn") && getComputedStyle(document.querySelector("button.menu-btn")).display !== "none",
        faq: [...document.querySelectorAll(".faq-p")].filter((p) => p.getBoundingClientRect().height < 20).length, flota: !document.querySelector(".wa-flota") || getComputedStyle(document.querySelector(".wa-flota")).visibility === "visible" || innerWidth >= 1000 }));
      ok("Sin JavaScript · " + ruta + " a " + ancho + " px: todo el texto visible, menú alcanzable y pie completo", d.ocultos === 0 && d.menu >= 1 && d.pie === 12 && !d.boton && d.faq === 0 && d.flota, JSON.stringify(d));
      if (ancho === 390 && ruta === "/") {
        await page.locator(".barra a.menu-btn").click(); await page.waitForTimeout(1300);
        ok("Sin JavaScript en celular: el botón de menú lleva al mapa del pie", page.url().endsWith("#mapa") && (await page.evaluate(() => document.getElementById("mapa").getBoundingClientRect().top < innerHeight)));
        await page.locator('.pie-col a[href="/como-funciona/"]').evaluate((e) => e.click()); await page.waitForURL(/como-funciona/);
        ok("Sin JavaScript: se navega de una página a otra", (await page.locator("h1").innerText()).length > 10);
      }
      await page.close();
    }
    await ctx.close();
  }

  // ---------- 11. Sin desbordes de 320 a 1920 px, con el cotizador en su estado más cargado ----------
  for (const ancho of [320, 360, 375, 390, 414, 430, 600, 768, 1000, 1024, 1280, 1440, 1920]) {
    const ctx = await nuevo(ancho, 850); const malos = [];
    for (const ruta of TODAS) {
      const page = await ctx.newPage(); await page.goto(BASE + ruta, { waitUntil: "networkidle" });
      if (ruta === "/planes/") await page.evaluate(() => { const clic = (s) => document.querySelectorAll(s).forEach((e) => e.click());
        clic('[data-atajo="p15"]'); clic("#btn-completo"); clic('[data-red="Facebook"], [data-red="TikTok"], [data-red="LinkedIn"]'); clic('input[name="pauta"][value="completa"]');
        for (let i = 0; i < 9; i++) clic("#ia-mas"); clic("[data-interes]"); clic('input[name="speak"][value="promax"]'); clic(".faq-b"); });
      if (ruta === "/" ) await page.evaluate(() => document.querySelectorAll("#cal .cal-red button:not(.p):not(.g)").forEach((b, k) => { if (k < 8) b.click(); }));
      if (ancho < 1000) { await page.evaluate(() => document.getElementById("menu-btn").click()); await page.waitForTimeout(150); const m = await page.evaluate(() => { const p = document.getElementById("menu"); return p.scrollWidth > p.clientWidth + 1 ? "menú" : ""; }); if (m) malos.push(ruta + " " + m); await page.evaluate(() => document.getElementById("menu-btn").click()); }
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => {
        const vista = document.documentElement.clientWidth, fuera = [];
        document.querySelectorAll("body *").forEach((el) => {
          if (el.closest(".oculto, .sr, .salto, symbol, .pestanas ul, [hidden], .menu") || el.tagName === "INPUT") return;
          const c = el.getBoundingClientRect(); if (!c.width || !c.height) return;
          if (c.right > vista + 0.5 || c.left < -0.5) fuera.push(el.tagName.toLowerCase() + "." + (el.className.baseVal == null ? el.className : el.className.baseVal));
        });
        document.querySelectorAll(".caja:not(.pestanas ul), .bloque, .completo, .op, .resumen, .resumen-nombre, .resumen-total, .plan, .plan-precios, .pie-datos, .pie-col, .serv, .servs, .busca, .tres li, .franja, .speak, .sc-caja, .giro, .garantia, .garantia-linea, .no-incluye, .chip, .atajo, .btn, .contador, .ia-linea, .plan-barra-t, .barra-in, .pasos li, .lista li, .faq-b, .cal-pie").forEach((c) => {
          const rc = c.getBoundingClientRect(); if (!rc.width) return;
          c.querySelectorAll("*").forEach((el) => { if (el.closest(".sr, [hidden], .menu") || el.tagName === "INPUT") return; const r = el.getBoundingClientRect(); if (r.width && r.height && (r.right > rc.right + 1 || r.left < rc.left - 1)) fuera.push("se sale de ." + c.className.split(" ")[0] + ": " + (el.textContent || "").trim().slice(0, 20)); });
        });
        document.querySelectorAll("h1, h2, h3, p, strong, b, dd, li, a, button, output").forEach((el) => { if (el.closest(".sr, .oculto, .salto, .pestanas ul, [hidden], .menu")) return;
          if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== "inline" && el.clientWidth > 0) fuera.push("texto más ancho que su caja: " + (el.textContent || "").trim().slice(0, 20)); });
        return { doc: document.documentElement.scrollWidth, vista, fuera: [...new Set(fuera)].slice(0, 6) };
      });
      if (r.doc > r.vista || r.fuera.length) malos.push(ruta + " " + r.doc + "/" + r.vista + " " + r.fuera.join(" ; "));
      await page.close();
    }
    ok("Sin desbordes a " + ancho + " px en las seis páginas", !malos.length, malos.join(" | "));
    await ctx.close();
  }

  // ---------- 12. Teclado: el foco se ve y nada fijo lo tapa ----------
  {
    const ctx = await nuevo(390, 844); const tapados = [], sinFoco = []; let total = 0;
    for (const ruta of PAGINAS) {
      const page = await ctx.newPage(); await page.goto(BASE + ruta, { waitUntil: "networkidle" });
      await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
      await page.evaluate(() => window.scrollTo(0, 700)); await page.waitForTimeout(500);   // con lo fijo de abajo ya visible
      await page.keyboard.press("Tab");
      const n = await page.evaluate(() => [...document.querySelectorAll("a[href], button, input")].filter((e) => !e.disabled && e.getClientRects().length && getComputedStyle(e).visibility === "visible").length);
      for (let i = 0; i < n + 2; i++) {
        const f = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null;
          const mostrado = e.tagName === "INPUT" ? e.nextElementSibling : e, r = mostrado.getBoundingClientRect(), c = getComputedStyle(mostrado);
          const arriba = Math.max(...[...document.querySelectorAll(".barra, .pestanas")].map((x) => x.getBoundingClientRect()).filter((x) => x.top <= 70 || x.top === document.getElementById("barra").getBoundingClientRect().bottom).map((x) => x.bottom));
          const fijo = document.querySelector(".plan-barra.ver, .wa-flota.ver"), fr = fijo ? fijo.getBoundingClientRect() : null;
          const enBarra = !!e.closest(".barra, .pestanas, .plan-barra, .wa-flota, .salto");
          const tapado = !enBarra && (r.top < arriba - 1 || (fr && r.bottom > fr.top + 1 && r.right > fr.left && r.left < fr.right) || r.bottom > innerHeight + 1);
          return { quien: (e.innerText || e.getAttribute("aria-label") || e.name || e.id || e.tagName).replace(/\s+/g, " ").trim().slice(0, 26), tapado, foco: c.outlineStyle !== "none" && parseFloat(c.outlineWidth) >= 2 }; });
        if (f) { total++; if (f.tapado) tapados.push(ruta + " «" + f.quien + "»"); if (!f.foco) sinFoco.push(ruta + " «" + f.quien + "»"); }
        await page.keyboard.press("Tab");
      }
      await page.close();
    }
    ok("Con teclado en celular: ningún elemento con foco queda tapado por las barras fijas (" + total + " paradas)", total > 150 && !tapados.length, tapados.slice(0, 8).join(" | "));
    ok("Con teclado: el foco siempre se ve", !sinFoco.length, sinFoco.slice(0, 8).join(" | "));
    const p = await ctx.newPage(); await p.goto(BASE + "/planes/", { waitUntil: "networkidle" }); await p.keyboard.press("Tab");
    const salto = await p.evaluate(() => { const e = document.activeElement, r = e.getBoundingClientRect(); return e.className + " · " + e.innerText.trim() + " · " + (r.top >= 0 && r.height >= 40); });
    await p.keyboard.press("Enter"); await p.waitForTimeout(300);
    ok("Lo primero con Tab es \"Saltar al contenido\", se ve y lleva al contenido", salto === "salto · Saltar al contenido · true" && p.url().endsWith("#principal"), salto);
    await ctx.close();
  }

  // ---------- 13. Contraste, medido sobre el render ----------
  {
    const medir = () => {
      const num = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
      const sobre = (a, b) => ({ r: a.r * a.a + b.r * (1 - a.a), g: a.g * a.a + b.g * (1 - a.a), b: a.b * a.a + b.b * (1 - a.a), a: 1 });
      const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const fondo = (el) => { const capas = []; for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== "none" && /gradient/.test(s.backgroundImage)) return null; const c = num(s.backgroundColor); if (c.a > 0) { capas.push(c); if (c.a === 1) break; } }
        let base = { r: 1, g: 18, b: 11, a: 1 }; for (let i = capas.length - 1; i >= 0; i--) base = sobre(capas[i], base); return base; };
      const pares = {}, malos = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.textContent.trim()) continue;
        const el = n.parentElement; if (!el || el.closest(".sr, .oculto, script, style, noscript, [hidden], .salto")) continue;
        const s = getComputedStyle(el); if (s.visibility !== "visible" || !el.getClientRects().length) continue;
        let opaco = 1; for (let e = el; e; e = e.parentElement) opaco *= parseFloat(getComputedStyle(e).opacity); if (opaco < 0.99) continue;   // lo desactivado o a medio aparecer
        const f = fondo(el); if (!f) continue;
        const t = sobre(num(s.color), f), l1 = lum(t), l2 = lum(f), razon = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const px = parseFloat(s.fontSize), grande = px >= 24 || (px >= 18.66 && parseInt(s.fontWeight, 10) >= 700), minimo = grande ? 3 : 4.5;
        const clave = s.color + " sobre rgb(" + [f.r, f.g, f.b].map(Math.round).join(",") + ")" + (grande ? " (grande)" : "");
        if (!pares[clave] || razon < pares[clave]) pares[clave] = Math.round(razon * 100) / 100;
        if (razon < minimo) malos.push(n.textContent.trim().slice(0, 24) + " " + razon.toFixed(2) + " " + clave);
      }
      return { pares, malos: [...new Set(malos)].slice(0, 8) };
    };
    let minimo = 99, cuantos = new Set();
    for (const ancho of [390, 1280]) {
      const ctx = await nuevo(ancho, 844);
      for (const ruta of TODAS) {
        const page = await ctx.newPage(); await page.goto(BASE + ruta, { waitUntil: "networkidle" });
        await page.addStyleTag({ content: ".js .rev{opacity:1!important;transform:none!important}*{transition:none!important;animation:none!important}" });
        if (ruta === "/planes/") await page.evaluate(() => { document.querySelector('[data-atajo="p12"]').click(); document.getElementById("btn-completo").click(); document.getElementById("ia-mas").click(); document.querySelector('input[name="speak"][value="pro"]').click(); document.querySelector('[data-interes]').click(); document.querySelectorAll(".faq-b").forEach((b) => b.click()); });
        if (ruta === "/") await page.evaluate(() => { document.getElementById("cal").classList.add("on"); document.querySelector("#cal .cal-red button:nth-child(2)").click(); });
        if (ancho < 1000) await page.evaluate(() => document.getElementById("menu-btn").click());
        await page.waitForTimeout(700);
        const r = await page.evaluate(medir);
        if (ancho < 1000) { await page.evaluate(() => document.getElementById("menu-btn").click()); await page.waitForTimeout(100); const r2 = await page.evaluate(medir); Object.assign(r.pares, r2.pares); r.malos = r.malos.concat(r2.malos); }
        Object.entries(r.pares).forEach(([k, v]) => { cuantos.add(k); if (v < minimo) minimo = v; });
        ok("Contraste AA · " + ruta + " a " + ancho + " px (" + Object.keys(r.pares).length + " pares de texto y fondo)", !r.malos.length, r.malos.join(" | "));
        await page.close();
      }
      await ctx.close();
    }
    ok("Contraste: el par más bajo de todo el sitio pasa (" + cuantos.size + " pares distintos; mínimo " + minimo + ":1)", minimo >= 3);
  }

  await navegador.close(); servidor.close();
  let fallos = 0;
  for (const x of resultados) { if (!x.pasa) fallos++; console.log((x.pasa ? "PASA  " : "FALLA ") + x.nombre + (x.detalle ? "  →  " + x.detalle.slice(0, 600) : "")); }
  console.log("\n" + (resultados.length - fallos) + " de " + resultados.length + " pruebas pasan.");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
