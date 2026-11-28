// Pruebas de imágenes y videos: huecos con alt y medidas, archivos en sus tres formatos, pesos por página y por archivo,
// que el video no se pida antes de reproducir, que reproduzca, sin JavaScript, teclado, LCP y CLS de laboratorio.
// Uso: node pruebas/medios.test.js
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const { playwright, iniciar, RAIZ, PAGINAS, TODAS } = require("./apoyo");
const { chromium } = playwright();
const PUERTO = 4183, BASE = "http://127.0.0.1:" + PUERTO;
const resultados = [];
function ok(nombre, condicion, detalle) { resultados.push({ nombre, pasa: !!condicion, detalle: detalle == null ? "" : String(detalle) }); }
function igual(nombre, obtenido, esperado) { ok(nombre, obtenido === esperado, "obtenido: " + JSON.stringify(obtenido) + (obtenido === esperado ? "" : " · esperado: " + JSON.stringify(esperado))); }

// Topes del plan visual. Por archivo (KB), según el ancho que lleva en el nombre; por página (KB transferidos), sin reproducir video.
const TOPE_ARCHIVO = { 480: { avif: 15, webp: 25 }, 800: { avif: 40, webp: 60 }, 1200: { avif: 90, webp: 150 }, 220: { avif: 10, webp: 14 }, 400: { avif: 20, webp: 28 }, 640: { avif: 40, webp: 56 }, 960: { webp: 60 } };
const TOPE_VIDEO_MB = { webm: 2.5, mp4: 4 };
const TOPE_PAGINA = { celular: { "/": 450, "/planes/": 140, "/como-funciona/": 300, "/otros-servicios/": 250, "/portafolios/": 200 },
                      escritorio: { "/": 450, "/planes/": 230, "/como-funciona/": 300, "/otros-servicios/": 350, "/portafolios/": 200 } };
const enDisco = (ruta) => { let f = path.join(RAIZ, decodeURIComponent(ruta)); if (ruta.endsWith("/")) f = path.join(f, "index.html"); return f; };
// Lo que viaja por la red: los textos van comprimidos por el alojamiento (se estima con gzip); imágenes, fuentes y video, tal cual.
const transferido = (ruta) => { const f = enDisco(ruta); if (!fs.existsSync(f)) return 0; return /\.(html|css|js|xml|txt|svg)$/.test(f) ? zlib.gzipSync(fs.readFileSync(f)).length : fs.statSync(f).size; };

(async () => {
  const servidor = await iniciar(PUERTO);
  const navegador = await chromium.launch();
  const VISTAS = { celular: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, escritorio: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
  const bajar = (page) => page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 70)); }
    document.querySelectorAll(".tira").forEach((t) => t.scrollTo({ left: 2000, behavior: "instant" })); await new Promise((r) => setTimeout(r, 400)); window.scrollTo({ top: 0, behavior: "instant" }); });

  // ---------- 1. Archivos: existen, abren y están bajo su tope ----------
  {
    const imgs = fs.readdirSync(path.join(RAIZ, "assets/img/sitio")).map((f) => "assets/img/sitio/" + f).concat(fs.readdirSync(path.join(RAIZ, "assets/img/portadas")).map((f) => "assets/img/portadas/" + f));
    const pasados = imgs.filter((f) => { const m = /-(\d+)-v\d+\.(avif|webp|jpg)$/.exec(f); const tope = m && (TOPE_ARCHIVO[m[1]] || {})[m[2]]; return tope && fs.statSync(path.join(RAIZ, f)).size / 1024 > tope; });
    ok("Ninguna imagen pasa su tope de peso (" + imgs.length + " archivos)", imgs.length >= 100 && !pasados.length, pasados.map((f) => f + " " + Math.round(fs.statSync(path.join(RAIZ, f)).size / 1024) + " KB").join(" | "));
    igual("Todos los medios llevan la versión en el nombre (la caché larga de vercel.json depende de eso)", imgs.concat(fs.readdirSync(path.join(RAIZ, "assets/video"))).filter((f) => !/-v\d+\.\w+$/.test(f)).join(" "), "");
    const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, "vercel.json"), "utf8"));
    ok("vercel.json: caché larga solo para las carpetas de medios con versión", vercel.headers.length === 1 && vercel.headers[0].source === "/assets/(img/sitio|img/portadas|video)/(.*)" && /immutable/.test(vercel.headers[0].headers[0].value) && vercel.trailingSlash === true);
    for (const f of fs.readdirSync(path.join(RAIZ, "assets/video")).sort()) { const mb = fs.statSync(path.join(RAIZ, "assets/video", f)).size / 1048576; ok("Video bajo su tope: " + f, mb <= TOPE_VIDEO_MB[f.split(".").pop()], mb.toFixed(2) + " MB"); }
    ok("Lo que no se publica: pruebas y herramientas", fs.readFileSync(path.join(RAIZ, ".vercelignore"), "utf8").split("\n").filter(Boolean).join(",") === "pruebas,herramientas");
  }

  // ---------- 2. Cada página: huecos, formatos, tamaño servido, peso, LCP y CLS ----------
  const esperadas = { "/": 8, "/planes/": 1, "/como-funciona/": 3, "/otros-servicios/": 5, "/portafolios/": 5, "/404.html": 0 };
  const pesos = {};
  for (const [vista, opciones] of Object.entries(VISTAS)) {
    const ctx = await navegador.newContext(opciones);
    await ctx.addInitScript(() => { window.__lcp = null; window.__cls = 0;
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = { etiqueta: e.element ? e.element.tagName : "?", ms: Math.round(e.startTime) }; }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); } catch (e) {} });
    for (const ruta of TODAS) {
      const page = await ctx.newPage(); const pedidos = new Set(), errores = [], otros = [];
      page.on("request", (r) => { if (r.url().startsWith(BASE)) pedidos.add(new URL(r.url()).pathname); else if (!r.url().startsWith("data:")) otros.push(r.url()); });
      page.on("pageerror", (e) => errores.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
      page.on("response", (r) => { if (r.status() >= 400) errores.push(r.status() + " " + r.url()); });
      await page.goto(BASE + ruta, { waitUntil: "networkidle" }); await page.waitForTimeout(300);
      const lcp = await page.evaluate(() => window.__lcp);
      await bajar(page); await page.waitForLoadState("networkidle"); await page.waitForTimeout(500);
      const d = await page.evaluate(() => {
        const dpr = devicePixelRatio;
        return { cls: Math.round(window.__cls * 1000) / 1000, imgs: [...document.querySelectorAll("main img, footer img")].filter((i) => !i.closest(".marca")).map((i) => {
          const r = i.getBoundingClientRect(), visible = getComputedStyle(i.closest("picture") || i).display !== "none" && r.width > 0;
          return { src: (i.currentSrc || "").replace(location.origin, ""), alt: i.getAttribute("alt"), w: i.getAttribute("width"), h: i.getAttribute("height"), natural: i.naturalWidth, archivo: Number(((i.currentSrc || "").match(/-(\d+)-v\d+\.\w+$/) || [0, 0])[1]), caja: Math.round(r.width), dpr, visible,
            enlace: !!i.closest("a"), lazy: i.getAttribute("loading"), candidatos: [...(i.closest("picture") ? i.closest("picture").querySelectorAll("source") : [])].flatMap((s) => s.srcset.split(",").map((c) => c.trim().split(" ")[0])).concat([i.getAttribute("src")]).filter((u) => u && !u.startsWith("data:")),
            anchos: [...new Set([...(i.closest("picture") ? i.closest("picture").querySelectorAll("source") : [])].flatMap((s) => s.srcset.split(",").map((c) => parseInt(c.trim().split(" ")[1], 10) || 0)))].filter(Boolean).sort((a, b) => a - b) }; }) };
      });
      const marca = ruta + " · " + vista;
      igual("Huecos de imagen · " + marca, d.imgs.length, esperadas[ruta]);
      const malas = d.imgs.filter((i) => i.alt === null || !i.w || !i.h || (i.alt === "") !== i.enlace || (i.alt || "").length > 125 || /imagen de|foto de/i.test(i.alt || ""));
      ok("Cada imagen con alt (vacío solo dentro de un enlace), width y height · " + marca, !malas.length, malas.map((i) => i.src + " «" + i.alt + "»").join(" | "));
      const sinCargar = d.imgs.filter((i) => i.visible && (!i.natural || !/\.(avif|webp|jpg)$/.test(i.src)));
      ok("Las imágenes que se ven cargaron · " + marca, !sinCargar.length, sinCargar.map((i) => i.src || "(sin archivo)").join(" | "));
      // Tamaño servido: nunca por debajo de su caja (en píxeles reales) y siempre el archivo más pequeño que la cubre
      const maltamano = d.imgs.filter((i) => { if (!i.visible) return false; const falta = i.caja * i.dpr, cubre = i.anchos.find((a) => a >= falta - 1) || i.anchos[i.anchos.length - 1]; return i.archivo < Math.min(falta - 1, i.anchos[i.anchos.length - 1]) || i.archivo > cubre; });
      ok("Cada imagen llega en el archivo más pequeño que cubre su caja, nunca por debajo · " + marca, !maltamano.length, maltamano.map((i) => i.src + " para una caja de " + i.caja + "×" + i.dpr).join(" | "));
      if (vista === "celular") {
        const candidatos = [...new Set(d.imgs.flatMap((i) => i.candidatos))], faltan = [];
        for (const u of candidatos) { const r = await page.request.get(BASE + u); const tipo = r.headers()["content-type"] || ""; if (r.status() !== 200 || !tipo.startsWith("image/" + ({ jpg: "jpeg" }[u.split(".").pop()] || u.split(".").pop()))) faltan.push(u + " " + r.status()); }
        ok("Todos los archivos de cada hueco responden 200 en AVIF, WebP y JPEG · " + ruta + " (" + candidatos.length + " archivos)", !faltan.length && d.imgs.every((i) => i.candidatos.some((u) => u.endsWith(".avif")) && i.candidatos.some((u) => u.endsWith(".webp")) && i.candidatos.some((u) => u.endsWith(".jpg"))), faltan.join(" | "));
      }
      igual("Sin errores, sin fallidas y nada de otros dominios · " + marca, errores.concat(otros).join(" | "), "");
      igual("No se pide ningún video al cargar ni al bajar · " + marca, [...pedidos].filter((u) => u.startsWith("/assets/video/")).join(" "), "");
      const kb = Math.round([...pedidos].reduce((a, u) => a + transferido(u), 0) / 102.4) / 10;
      pesos[marca] = kb + " KB, " + pedidos.size + " peticiones";
      if (TOPE_PAGINA[vista][ruta]) ok("Peso transferido bajo el tope de " + TOPE_PAGINA[vista][ruta] + " KB · " + marca, kb <= TOPE_PAGINA[vista][ruta], kb + " KB en " + pedidos.size + " peticiones");
      // Única excepción, a la vista: en /planes/ desde 1000 px la imagen de la cabecera (36 KB) ocupa más área que el título
      if (ruta === "/planes/" && vista === "escritorio") ok("LCP de /planes/ en escritorio: es la imagen de la cabecera y llega rápido (laboratorio, menos de 800 ms)", lcp && lcp.ms < 800, JSON.stringify(lcp));
      else ok("Lo más grande que pinta al cargar (LCP) sigue siendo texto · " + marca, lcp && !/IMG|VIDEO|PICTURE/.test(lcp.etiqueta), JSON.stringify(lcp));
      ok("Sin saltos de diseño (CLS de 0,01 o menos) · " + marca, d.cls <= 0.01, d.cls);
      if (ruta === "/planes/") {
        const cab = [...pedidos].filter((u) => u.includes("01-planes-cabecera"));
        if (vista === "celular") igual("La imagen de la cabecera de /planes/ no se pide por debajo de 1000 px", cab.join(" "), "");
        else ok("La imagen de la cabecera de /planes/ sí se pide desde 1000 px", cab.length === 1 && /-800-v1\.avif$/.test(cab[0]), cab.join(" "));
      }
      await page.close();
    }
    await ctx.close();
  }
  {
    const ctx = await navegador.newContext({ viewport: { width: 999, height: 800 } }); const page = await ctx.newPage(); const cab = [];
    page.on("request", (r) => { if (r.url().includes("01-planes-cabecera")) cab.push(r.url()); });
    await page.goto(BASE + "/planes/", { waitUntil: "networkidle" }); await bajar(page);
    ok("A 999 px tampoco se pide ni se muestra la imagen de la cabecera", !cab.length && !(await page.locator(".cab-img").isVisible()));
    await ctx.close();
  }

  // ---------- 3. Inicio: tarjetas en 3D, tira de pasos y sección de videos ----------
  for (const [vista, opciones] of Object.entries(VISTAS)) {
    const ctx = await navegador.newContext(opciones); const page = await ctx.newPage(); await page.goto(BASE + "/", { waitUntil: "networkidle" });
    igual("Tarjetas del inicio: las cinco con su imagen 3D · " + vista, (await page.locator(".busca .busca-img img").evaluateAll((is) => is.map((i) => (i.currentSrc.match(/tarjeta-\d-[a-z-]+?(?=-\d+-v)/) || [""])[0]))).join(" "), "tarjeta-1-contenido tarjeta-2-start-content tarjeta-3-speak tarjeta-4-ia-negocio tarjeta-5-portafolios");
    const t = await page.evaluate(() => { const c = (s) => document.querySelector(s).getBoundingClientRect(); const a = c(".busca.destacada .busca-img"), b = c(".buscas-red li:nth-child(2) .busca-img"), tira = document.querySelector(".tres");
      return { destacada: Math.round(a.width) + "×" + Math.round(a.height), otra: Math.round(b.width) + "×" + Math.round(b.height), tiraDesliza: tira.scrollWidth > tira.clientWidth + 5, doc: document.documentElement.scrollWidth <= innerWidth,
        orden: [...document.querySelectorAll("main > section")].map((s) => s.id).join(" "), primera: Math.round(c(".acciones").bottom) }; });
    igual("Orden del inicio: los videos van después de los tres pasos y antes del cierre · " + vista, t.orden, "inicio como videos-ia cierre");
    if (vista === "celular") ok("Celular: la primera tarjeta va destacada (16:9, a todo el ancho), las demás con miniatura de 96 px, y los tres pasos son una tira que se desliza sin desbordar la página", t.destacada === "320×180" && t.otra === "96×96" && t.tiraDesliza && t.doc, JSON.stringify(t));
    else ok("Escritorio: las cinco tarjetas con la imagen arriba (4:3) y los tres pasos en columnas", /^2\d\d×1\d\d$/.test(t.destacada) && t.destacada === t.otra && !t.tiraDesliza, JSON.stringify(t));
    ok("La primera pantalla del inicio no cambió: titular, precio y botones entran · " + vista, t.primera < opciones.viewport.height && (await page.locator("#inicio picture").count()) === 5 && (await page.locator(".inicio-txt img, .cal img").count()) === 0, t.primera);
    await ctx.close();
  }

  // ---------- 4. Videos: no se piden antes de reproducir, reproducen, uno a la vez, medición ----------
  {
    const ctx = await navegador.newContext(VISTAS.celular); const page = await ctx.newPage(); const video = [], errores = [];
    page.on("request", (r) => { if (r.url().includes("/assets/video/")) video.push(new URL(r.url()).pathname); });
    page.on("pageerror", (e) => errores.push(e.message));
    await page.goto(BASE + "/planes/", { waitUntil: "networkidle" });
    igual("Enlace del cotizador a los videos, en pestaña nueva (el plan armado no se pierde)", await page.locator(".ia-nota a").evaluate((a) => a.innerText + " → " + a.getAttribute("href") + " " + a.target), "Mira cómo se ven → /#videos-ia _blank");
    await page.goto(BASE + "/otros-servicios/", { waitUntil: "networkidle" });
    igual("Enlace de Otros servicios a los videos", await page.locator('.ia-cab a[href="/#videos-ia"]').innerText().then((t) => t.trim()), "Ver videos hechos con IA");
    await page.locator('.ia-cab a[href="/#videos-ia"]').click(); await page.waitForURL(/#videos-ia/); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
    ok("/#videos-ia llega a la sección de videos, a la vista", await page.evaluate(() => { const t = document.getElementById("videos-ia").getBoundingClientRect().top; return t >= 0 && t < 200; }), await page.evaluate(() => Math.round(document.getElementById("videos-ia").getBoundingClientRect().top)));
    const v = await page.evaluate(() => [...document.querySelectorAll("#videos-ia video")].map((x) => ({ id: x.dataset.video, preload: x.getAttribute("preload"), inline: x.playsInline, auto: x.autoplay || x.muted || x.loop, poster: x.poster.replace(location.origin, ""), w: x.getAttribute("width"), h: x.getAttribute("height"),
      fuentes: [...x.querySelectorAll("source")].map((s) => s.getAttribute("src").split(".").pop() + ":" + s.type.split(";")[0]).join(","), nombre: document.getElementById(x.getAttribute("aria-labelledby")).innerText, desc: !!document.getElementById(x.getAttribute("aria-describedby")),
      boton: x.parentElement.querySelector(".vid-play").getAttribute("aria-label"), botonVisible: !x.parentElement.querySelector(".vid-play").hidden, respaldo: !!x.querySelector('a[href$=".mp4"]'), meta: x.closest("figure").querySelector(".vid-meta").innerText })));
    igual("Tres videos, en orden: nieve, acantilado y búnker", v.map((x) => x.id).join(" "), "nieve acantilado bunker");
    ok("Cada video: preload none, playsinline, sin reproducción automática, con cuadro de espera, medidas, WebM (AV1) primero y MP4 (H.264) después, título, descripción y enlace de respaldo", v.every((x) => x.preload === "none" && x.inline && !x.auto && /video-\w+-960-v1\.webp$/.test(x.poster) && x.w === "1280" && x.h === "720" && x.fuentes === "webm:video/webm,mp4:video/mp4" && x.nombre && x.desc && x.respaldo && x.boton === "Reproducir: " + x.nombre && x.botonVisible), JSON.stringify(v[0]));
    igual("Duraciones que se anuncian", v.map((x) => x.meta.split(" · ")[0]).join(" "), "15 s 15 s 23 s");
    const texto = await page.evaluate(() => document.documentElement.outerHTML);
    ok("La cifra y el llamado de TikTok del búnker no se repiten en ningún texto de la página", !/80\s?%|comenta IA|te explico|van a desaparecer/i.test(texto));
    ok("La sección dice que los videos están hechos con IA, y el pie lo dice de imágenes y videos", /hechos con IA/.test(await page.locator("#videos-ia .cuerpo").innerText()) && (await page.locator(".pie-ia").innerText()).trim() === "Las imágenes y los videos de este sitio los hicimos con IA.");
    igual("Precio del video con IA desde CJ_PLAN", await page.evaluate(() => document.querySelector('#videos-ia [data-p="videoIA"]').textContent === window.CJ.pesos(window.CJ.plan.videoConIA)), true);
    await page.evaluate(async () => { const s = document.getElementById("videos-ia"); for (let y = s.offsetTop; y < s.offsetTop + s.offsetHeight; y += 300) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 80)); } }); await page.waitForTimeout(800);
    igual("Antes de reproducir: cero peticiones a /assets/video/ (con los tres cuadros de espera ya a la vista)", video.join(" "), "");
    ok("Los tres cuadros de espera cargaron", await page.evaluate(async () => (await Promise.all([...document.querySelectorAll("#videos-ia video")].map((x) => new Promise((r) => { const i = new Image(); i.onload = () => r(i.naturalWidth === 960); i.onerror = () => r(false); i.src = x.poster; })))).every(Boolean)));
    const b1 = page.locator("#video-nieve .vid-play"); await b1.evaluate((b) => b.scrollIntoView({ block: "center", behavior: "instant" }));
    const cont = await b1.evaluate((b) => { const lum = (c) => { const [r, g, bl] = c.match(/[\d.]+/g).map(Number).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
      const s = getComputedStyle(b), f = lum(s.backgroundColor), i = lum(getComputedStyle(b.querySelector("svg")).fill), r = b.getBoundingClientRect(); return { razon: Math.round((Math.max(f, i) + 0.05) / (Math.min(f, i) + 0.05) * 10) / 10, lado: Math.round(r.width), aro: /rgba\(1, 18, 11/.test(s.boxShadow) }; });
    ok("Botón de reproducir: 64 px, fondo propio opaco con aro oscuro y contraste de sobra con su ícono", cont.lado === 64 && cont.aro && cont.razon >= 4.5, JSON.stringify(cont));
    await b1.click();
    const anda = async (id) => { for (let i = 0; i < 40; i++) { const t = await page.evaluate((id) => { const x = document.querySelector('video[data-video="' + id + '"]'); return x.paused ? -1 : x.currentTime; }, id); if (t > 0.4) return t; await page.waitForTimeout(250); } return 0; };
    const t1 = await anda("nieve");
    ok("El video reproduce (fuente WebM con AV1) al oprimir el botón", t1 > 0.4, "segundo " + t1);
    ok("Al reproducir, el botón grande desaparece y quedan los controles del navegador", (await b1.isHidden()) && (await page.evaluate(() => document.querySelector('video[data-video="nieve"]').controls)));
    igual("Después de reproducir: una sola fuente pedida", [...new Set(video)].join(" "), "/assets/video/cj-nieve-720-v1.webm");
    await page.locator("#video-acantilado .vid-play").evaluate((b) => { b.scrollIntoView({ block: "center", behavior: "instant" }); b.click(); });
    const t2 = await anda("acantilado");
    ok("Uno a la vez: al reproducir el segundo, el primero se pausa", t2 > 0.4 && (await page.evaluate(() => document.querySelector('video[data-video="nieve"]').paused)), "segundo " + t2);
    await page.evaluate(() => { const x = document.querySelector('video[data-video="nieve"]'); x.play(); }); await anda("nieve");
    igual("Medición: VideoReproducido una sola vez por video, con su nombre", (await page.evaluate(() => window.dataLayer.filter((e) => e.event === "VideoReproducido").map((e) => e.content_name))).join(" "), "nieve acantilado");
    igual("Los eventos de siempre no cambiaron en el inicio", (await page.evaluate(() => window.dataLayer.filter((e) => e.event !== "VideoReproducido").map((e) => e.event))).join(" "), "PageView");
    // El búnker termina antes del llamado de TikTok: dura 22,9 s y el último cuadro es negro (fundido)
    const dur = await page.evaluate(async () => { const x = document.querySelector('video[data-video="bunker"]'); x.muted = true; x.preload = "auto"; x.load(); await new Promise((r) => { x.addEventListener("loadedmetadata", r, { once: true }); setTimeout(r, 8000); });
      const d = x.duration; x.currentTime = d - 0.04; await new Promise((r) => { x.addEventListener("seeked", r, { once: true }); setTimeout(r, 8000); });
      const c = document.createElement("canvas"); c.width = 64; c.height = 36; const g = c.getContext("2d"); g.drawImage(x, 0, 0, 64, 36); const p = g.getImageData(0, 0, 64, 36).data; let s = 0; for (let i = 0; i < p.length; i += 4) s += p[i] + p[i + 1] + p[i + 2];
      return { d: Math.round(d * 10) / 10, brillo: Math.round(s / (64 * 36 * 3)) }; });
    ok("El búnker dura 22,9 s (cortado antes de \"comenta IA y te explico\") y cierra en negro", dur.d === 22.9 && dur.brillo < 12, JSON.stringify(dur));
    igual("Videos: sin errores de consola", errores.join(" | "), "");
    await ctx.close();
  }

  // ---------- 5. Teclado ----------
  {
    const ctx = await navegador.newContext(VISTAS.celular); const page = await ctx.newPage(); await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "html{scroll-behavior:auto!important}" });
    await page.locator('#como a[href="/como-funciona/"]').focus();
    const paradas = [];
    for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); paradas.push(await page.evaluate(() => { const e = document.activeElement, r = e.getBoundingClientRect(), c = getComputedStyle(e), f = document.querySelector(".wa-flota.ver"), fr = f ? f.getBoundingClientRect() : null;
      return { q: e.getAttribute("aria-label") || e.innerText.trim().slice(0, 20), foco: c.outlineStyle !== "none" && parseFloat(c.outlineWidth) >= 2, libre: r.top >= 64 && r.bottom <= innerHeight && !(fr && r.bottom > fr.top && r.right > fr.left && r.left < fr.right) }; })); }
    igual("Con teclado, después de los tres pasos: los tres botones de reproducir y el botón de la sección, sin pasar por controles ocultos", paradas.slice(0, 4).map((p) => p.q).join(" | "), "Reproducir: Sin cámara y sin equipo | Reproducir: Un corto en un acantilado | Reproducir: Un corto de ciencia ficción | Súmalos a tu plan");
    ok("…cada uno muestra el foco y nada fijo lo tapa", paradas.slice(0, 4).every((p) => p.foco && p.libre), JSON.stringify(paradas.slice(0, 4)));
    await page.locator('#video-bunker .vid-play').focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(1500);
    ok("Enter en el botón reproduce", await page.evaluate(() => !document.querySelector('video[data-video="bunker"]').paused));
    await page.locator(".tres").focus();
    const tira = await page.evaluate(async () => { const e = document.activeElement, antes = e.scrollLeft, c = getComputedStyle(e); return { es: e.classList.contains("tira"), nombre: e.getAttribute("aria-label"), foco: c.outlineStyle !== "none", antes }; });
    await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(500);
    ok("La tira de pasos se alcanza con el teclado, tiene nombre, muestra el foco y se recorre con las flechas", tira.es && tira.nombre === "Los tres pasos, en imágenes" && tira.foco && (await page.evaluate(() => document.querySelector(".tres").scrollLeft)) > tira.antes, JSON.stringify(tira));
    await ctx.close();
  }

  // ---------- 6. Sin JavaScript ----------
  {
    const ctx = await navegador.newContext(Object.assign({}, VISTAS.celular, { javaScriptEnabled: false })); const video = [];
    for (const ruta of PAGINAS) {
      const page = await ctx.newPage(); page.on("request", (r) => { if (r.url().includes("/assets/video/")) video.push(r.url()); });
      await page.goto(BASE + ruta, { waitUntil: "networkidle" });
      for (let y = 0; y < 9000; y += 500) { await page.mouse.wheel(0, 500); await page.waitForTimeout(40); }
      await page.waitForLoadState("networkidle"); await page.waitForTimeout(300);
      const d = await page.evaluate(() => ({ malas: [...document.querySelectorAll("main img")].filter((i) => getComputedStyle(i.closest("picture")).display !== "none" && i.getBoundingClientRect().right > 0 && i.getBoundingClientRect().left < innerWidth && (!i.naturalWidth || getComputedStyle(i).opacity !== "1" || getComputedStyle(i.closest(".rev") || i).opacity !== "1")).map((i) => i.currentSrc.split("/").pop()),
        videos: [...document.querySelectorAll("video")].map((x) => x.controls && x.getBoundingClientRect().height > 100 && x.parentElement.querySelector(".vid-play").hidden) }));
      ok("Sin JavaScript · " + ruta + ": las imágenes se ven", !d.malas.length, d.malas.join(" "));
      if (ruta === "/") ok("Sin JavaScript: los tres videos con su cuadro de espera y los controles del navegador, sin el botón grande, y sin pedir video", d.videos.length === 3 && d.videos.every(Boolean) && !video.length, JSON.stringify(d.videos));
      await page.close();
    }
    await ctx.close();
  }

  await navegador.close(); servidor.close();
  let fallos = 0;
  for (const x of resultados) { if (!x.pasa) fallos++; console.log((x.pasa ? "PASA  " : "FALLA ") + x.nombre + (x.detalle ? "  →  " + x.detalle.slice(0, 500) : "")); }
  console.log("\nPeso transferido por página (textos con gzip; sin reproducir video):"); for (const [k, v] of Object.entries(pesos)) console.log("  " + k.padEnd(34) + v);
  console.log("\n" + (resultados.length - fallos) + " de " + resultados.length + " pruebas pasan.");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
