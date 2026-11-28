// Pruebas del cotizador "Arma tu plan" (modelo: solo contenidos + adicionales; plan completo), con clics reales.
// El cotizador vive en /planes/ y el calendario en el inicio. Uso: node pruebas/cotizador.test.js
const { playwright, iniciar } = require("./apoyo");
const { chromium } = playwright();
const PUERTO = 4174, BASE = "http://127.0.0.1:" + PUERTO + "/";
const WA = "https://wa.me/573009867822?text=";
const resultados = [];
function ok(nombre, condicion, detalle) { resultados.push({ nombre, pasa: !!condicion, detalle: detalle || "" }); }
function igual(nombre, obtenido, esperado) { ok(nombre, obtenido === esperado, "obtenido: " + JSON.stringify(obtenido) + (obtenido === esperado ? "" : " · esperado: " + JSON.stringify(esperado))); }

async function abrir(ctx, consulta) {
  const page = await ctx.newPage();
  page._errores = []; page._externas = [];
  page.on("pageerror", (e) => page._errores.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") page._errores.push(m.text()); });
  page.on("request", (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith("data:")) page._externas.push(r.url()); });
  await page.goto(BASE + "planes/" + (consulta || ""), { waitUntil: "networkidle" });
  await page.locator("#arma-tu-plan").scrollIntoViewIfNeeded();
  return page;
}
const cuenta = async (page, tipo) => Number(await page.locator("#n-" + tipo).textContent());
const mezclaActual = async (page) => [await cuenta(page, "videos"), await cuenta(page, "carruseles"), await cuenta(page, "estaticas")].join("/");
async function leer(page) {
  await page.waitForTimeout(650); // la transición de los números
  const numero = async (sel) => Number((await page.locator(sel).textContent()).replace(/[^\d]/g, ""));
  const visible = (sel) => page.locator(sel).isVisible();
  const rotulo = (await page.locator("#r-rotulo").innerText()).trim().toUpperCase();
  const grande = await numero("#r-grande");
  const despues = (await visible("#r-despues")) ? await numero("#r-mensual") : null;
  const unaVez = (await visible("#r-unavez-fila")) ? await numero("#r-unavez") : 0;
  return {
    nombre: (await page.locator(".resumen-nombre").innerText()).replace(/\s+/g, " ").trim().toLowerCase().replace(/^p/, "P"),
    selloCompleto: await visible("#r-completo"),
    rotulo, grande, despues, unaVez,
    grandeTexto: await page.locator("#r-grande").textContent(),
    mensual: despues === null ? grande : despues,           // lo que se ve: el número grande, o el "Después, $X al mes"
    numeroGrande: rotulo + " " + grande + (despues === null ? "" : " · después " + despues + " al mes"),
    datos: await page.locator(".resumen").evaluate((r) => r.dataset.mensual + "/" + r.dataset.unaVez),
    mezcla: await page.locator("#r-mezcla").textContent(),
    barra: await numero("#pb-total"),
    rotuloBarra: await page.locator("#pb-nombre").textContent(),
    despuesBarra: (await page.locator("#pb-despues").evaluate((e) => !e.hidden)) ? (await page.locator("#pb-despues").textContent()).replace(/\s+/g, " ").trim() : "",
    falta: (await visible("#r-falta")) ? await page.locator("#r-falta").textContent() : "",
    interes: (await visible("#r-interes")) ? await page.locator("#r-interes").textContent() : "",
    lineas: (await page.locator("#r-lineas li").evaluateAll((ls) => ls.map((l) => l.querySelector("span").textContent.replace(/\s+/g, " ").trim() + " " + l.querySelector("b").textContent))).join(" | "),
    vivo: await page.locator("#r-vivo").textContent(),
    mensaje: decodeURIComponent((await page.locator("#r-wa").getAttribute("href")).replace(WA, "")),
    href: await page.locator("#r-wa").getAttribute("href"),
    hrefBarra: await page.locator("#pb-wa").getAttribute("href"),
  };
}
async function paso(page, tipo, d) {
  const b = page.locator('.pp[data-tipo="' + tipo + '"][data-d="' + d + '"]');
  await centrar(page, '.pp[data-tipo="' + tipo + '"][data-d="' + d + '"]');
  if (await b.isDisabled()) throw new Error("botón desactivado: " + tipo + " " + d);
  await b.click();
}
// Lleva los contadores a una mezcla, respetando el mínimo y el máximo como lo haría una persona.
async function mezcla(page, videos, carruseles, estaticas) {
  const meta = { videos, carruseles, estaticas };
  for (let i = 0; i < 120; i++) {
    const hay = { videos: await cuenta(page, "videos"), carruseles: await cuenta(page, "carruseles"), estaticas: await cuenta(page, "estaticas") };
    const total = hay.videos + hay.carruseles + hay.estaticas;
    const falta = Object.keys(meta).filter((t) => hay[t] < meta[t]), sobra = Object.keys(meta).filter((t) => hay[t] > meta[t]);
    if (!falta.length && !sobra.length) return;
    if (falta.length && total < 15) await paso(page, falta[0], 1);
    else if (sobra.length && total > 8) await paso(page, sobra[0], -1);
    else throw new Error("no se puede llegar a la mezcla");
  }
  throw new Error("mezcla: demasiados pasos");
}
// Centra el control antes del clic: así no queda debajo de las barras fijas.
const centrar = (page, sel) => page.locator(sel).evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
const marcar = async (page, sel) => { await centrar(page, sel); await page.locator(sel).check({ force: true }); };
const atajo = async (page, k) => { await centrar(page, '[data-atajo="' + k + '"]'); await page.locator('[data-atajo="' + k + '"]').click(); };
const completo = async (page) => { await centrar(page, "#btn-completo"); await page.locator("#btn-completo").click(); };
const caso = (n, r, mensual, unaVez, grande) => {
  igual("Caso " + n + " · mensual", r.mensual, mensual); igual("Caso " + n + " · una vez", r.unaVez, unaVez);
  igual("Caso " + n + " · cálculo interno (mensual/una vez)", r.datos, mensual + "/" + unaVez);
  if (grande) igual("Caso " + n + " · número grande", r.numeroGrande, grande);
};
const conIA = async (page, n) => { for (let i = 0; i < n; i++) { await centrar(page, "#ia-mas"); await page.locator("#ia-mas").click(); } };

(async () => {
  const servidor = await iniciar(PUERTO);
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route(/wa\.me|whatsapp\.com|facebook\.net|facebook\.com/, (r) => r.abort());
  let page, r;

  // ---------- Casos de la cuarta vuelta: videos con IA, Speak y "algo más" ----------
  page = await abrir(ctx); r = await leer(page);
  caso("A · Plan 8 solo contenidos", r, 1600000, 0, "TOTAL AL MES 1600000");
  await marcar(page, 'input[name="speak"][value="pro"]'); r = await leer(page);
  caso("B · Plan 8 + Speak Pro", r, 1600000, 800000, "TU PRIMER MES 2400000 · después 1600000 al mes");
  igual("Caso B · la barra del celular también", r.rotuloBarra + " " + r.barra + " · " + r.despuesBarra, "Primer mes 2400000 · después $1.600.000 al mes");
  ok("Caso B · la línea de Speak conserva su marca \"una vez\"", /Speak Pro una vez \$800\.000/.test(r.lineas), r.lineas);
  igual("Caso B · aria-live", r.vivo, "Plan 8. Tu primer mes: $2.400.000. Después, $1.600.000 al mes.");
  await marcar(page, 'input[name="speak"][value="ninguno"]'); r = await leer(page);
  igual("Al quitar Speak vuelve \"Total al mes\"", r.numeroGrande + " · " + r.rotuloBarra, "TOTAL AL MES 1600000 · Plan 8 · al mes");
  await page.close();

  page = await abrir(ctx); await atajo(page, "p12"); await completo(page); await marcar(page, 'input[name="speak"][value="promax"]'); r = await leer(page);
  caso("C · Plan 12 completo + Speak Pro Max", r, 3500000, 1600000, "TU PRIMER MES 5100000 · después 3500000 al mes");
  await page.close();

  page = await abrir(ctx); await conIA(page, 1); r = await leer(page);
  caso("D · Plan 8 (6 videos, 2 carruseles) con 1 video con IA", r, 1850000, 0, "TOTAL AL MES 1850000");
  igual("Caso D · desglose", r.lineas, "8 contenidos y 8 historias $1.600.000 | 1 video con IA $250.000");
  igual("Caso D · mezcla y mensaje", r.mezcla + " || " + r.mensaje, "6 videos, 1 de ellos con IA y 2 carruseles || Hola, CJ. Armé este plan en la página: Plan 8 (6 videos, 1 de ellos con IA y 2 carruseles). Mensual: $1.850.000. Quiero mi diagnóstico de 15 minutos.");
  ok("Caso D · la casilla del video con IA se distingue y trae su leyenda", (await page.locator("#fichas .ficha-t.ia").count()) === 1 && (await page.locator("#fichas .ficha-t.v").count()) === 5 && (await page.locator("#fichas-ley").isVisible()), (await page.locator("#fichas-ley").textContent()).trim());
  await page.close();

  page = await abrir(ctx); await mezcla(page, 8, 0, 0); await completo(page); await conIA(page, 4); r = await leer(page);
  caso("E · Plan 8 completo (8 videos) con 4 videos con IA", r, 3500000, 0, "TOTAL AL MES 3500000");
  igual("Caso E · sigue llamándose completo; la barra dice \"Total al mes\"", r.nombre + " · " + r.rotuloBarra, "Plan 8 completo · Total al mes");
  await page.close();

  page = await abrir(ctx); await mezcla(page, 12, 0, 0); await completo(page); await conIA(page, 6); r = await leer(page);
  caso("F · Plan 12 completo (12 videos) con 6 videos con IA", r, 5000000, 0, "TOTAL AL MES 5000000");
  igual("Caso F · mensaje", r.mensaje, "Hola, CJ. Armé este plan en la página: Plan 12 completo (12 videos, 6 de ellos con IA). Incluye estrategia del mes, manejo de Instagram y pauta básica. Mensual: $5.000.000. Quiero mi diagnóstico de 15 minutos.");
  await page.close();

  page = await abrir(ctx); await mezcla(page, 0, 0, 8); r = await leer(page);
  caso("G · 8 estáticas", r, 1600000, 0, "TOTAL AL MES 1600000");
  ok("Caso G · contador de IA desactivado, y lo dice", (await page.locator("#ia-mas").isDisabled()) && (await page.locator("#ia-menos").isDisabled()) && (await page.locator("#ia-aviso").isVisible()), "aviso: " + (await page.locator("#ia-aviso").textContent()));
  await page.close();

  page = await abrir(ctx); await conIA(page, 6);
  ok("Caso H · con 6 videos, el contador de IA llega a 6 y no pasa", (await page.locator("#n-ia").textContent()) === "6" && (await page.locator("#ia-mas").isDisabled()));
  r = await leer(page); igual("Caso H · 6 videos con IA · mensual", r.mensual, 3100000);
  await mezcla(page, 4, 4, 0); r = await leer(page);
  igual("Caso H · al bajar a 4 videos, el contador de IA baja a 4", await page.locator("#n-ia").textContent(), "4");
  igual("Caso H · y el total baja con él", r.lineas + " = " + r.mensual, "8 contenidos y 8 historias $1.600.000 | 4 videos con IA $1.000.000 = 2600000");
  await page.close();

  page = await abrir(ctx); await marcar(page, '[data-interes="página web"]'); await marcar(page, '[data-interes="automatización de procesos"]'); r = await leer(page);
  caso("I · Plan 8 + casillas \"Página web\" y \"Automatización\"", r, 1600000, 0, "TOTAL AL MES 1600000");
  igual("Caso I · el resumen lo muestra en una línea, sin precio", r.interes + " || " + r.lineas, "También me interesa: página web y automatización de procesos. || 8 contenidos y 8 historias $1.600.000");
  igual("Caso I · el mensaje termina con eso", r.mensaje, "Hola, CJ. Armé este plan en la página: Plan 8 (6 videos y 2 carruseles). Mensual: $1.600.000. Quiero mi diagnóstico de 15 minutos. También me interesa: página web y automatización de procesos.");
  for (const x of ["capacitación en IA", "portafolio y presentaciones"]) await marcar(page, '[data-interes="' + x + '"]');
  r = await leer(page);
  ok("Caso I · con las cuatro casillas el total sigue igual", r.mensual === 1600000 && /página web, automatización de procesos, capacitación en IA y portafolio y presentaciones\.$/.test(r.mensaje), r.mensaje.slice(-110));
  await page.close();

  // ---------- Los casos de la tabla anterior que siguen valiendo ----------
  page = await abrir(ctx); r = await leer(page);
  caso("1 · Plan 8, solo contenidos (estado inicial)", r, 1600000, 0);
  igual("Arranca en Plan 8 con la mezcla de ejemplo", r.nombre + " · " + (await mezclaActual(page)), "Plan 8 · 6/2/0");
  igual("Formato de pesos colombiano", r.grandeTexto, "$1.600.000");
  igual("Estado inicial: nada marcado y cero videos con IA", (await page.locator("#arma-tu-plan input:checked").evaluateAll((x) => x.map((i) => i.value).join(","))) + " · " + (await page.locator("#n-ia").textContent()), "ninguna,ninguno · 0");
  ok("Estado inicial: dice qué es el plan completo y cuánto cuesta", /plan completo: \$2\.500\.000 al mes/.test(r.falta), r.falta);
  await completo(page); r = await leer(page);
  caso("2 · Plan 8 completo", r, 2500000, 0);
  igual("\"Quiero el plan completo\" marca estrategia, Instagram y pauta básica", await page.evaluate(() => [document.getElementById("in-estrategia").checked, [...document.querySelectorAll("[data-red]:checked")].map((i) => i.dataset.red).join("+"), document.querySelector('input[name="pauta"]:checked').value].join(" · ")), "true · Instagram · basica");
  ok("El resumen lo llama \"Plan 8 completo\" y lo destaca", r.nombre === "Plan 8 completo" && r.selloCompleto && !r.falta, r.nombre);
  igual("Desglose línea por línea", r.lineas, "8 contenidos y 8 historias $1.600.000 | Estrategia del mes $250.000 | Manejo de Instagram $400.000 | Pauta básica $250.000");
  await page.close();

  page = await abrir(ctx); await atajo(page, "p12");
  igual("Atajo Plan 12 · mezcla", await mezclaActual(page), "8/2/2");
  await completo(page); r = await leer(page);
  caso("3 · Plan 12 completo", r, 3500000, 0);
  igual("Caso 3 · nombre", r.nombre, "Plan 12 completo");
  await marcar(page, 'input[name="speak"][value="pro"]'); r = await leer(page);
  caso("11 · Plan 12 completo + Speak Pro", r, 3500000, 800000);
  igual("Caso 11 · número grande", r.numeroGrande, "TU PRIMER MES 4300000 · después 3500000 al mes");
  await page.close();

  page = await abrir(ctx); await atajo(page, "p15");
  igual("Atajo Plan 15 · mezcla", await mezclaActual(page), "9/4/2");
  await completo(page); r = await leer(page);
  caso("4 · Plan 15 completo", r, 4250000, 0);
  for (const red of ["Facebook", "TikTok", "LinkedIn"]) await marcar(page, '[data-red="' + red + '"]');
  await marcar(page, 'input[name="pauta"][value="completa"]'); r = await leer(page);
  caso("8 · Plan 15 con estrategia, las 4 redes y pauta completa", r, 5900000, 0);
  igual("Caso 8 · sigue siendo completo", r.nombre, "Plan 15 completo");
  await page.close();

  page = await abrir(ctx); await mezcla(page, 6, 2, 2); await completo(page); r = await leer(page);
  caso("5 · 10 contenidos, completo", r, 3000000, 0);
  igual("Caso 5 · nombre", r.nombre, "Plan 10 completo");
  await page.close();

  page = await abrir(ctx); await atajo(page, "p12"); await marcar(page, '[data-red="Instagram"]'); r = await leer(page);
  caso("6 · Plan 12 solo contenidos + Instagram", r, 3000000, 0);
  ok("Caso 6 · no es completo y dice qué le falta", r.nombre === "Plan 12" && !r.selloCompleto && r.falta === "Te faltan la estrategia del mes y la pauta básica para el plan completo.", r.falta);
  await page.close();

  page = await abrir(ctx); await marcar(page, "#in-estrategia"); await marcar(page, '[data-red="Instagram"]'); r = await leer(page);
  igual("Con estrategia e Instagram, falta la pauta", r.falta, "Te falta la pauta básica para el plan completo.");
  await marcar(page, 'input[name="pauta"][value="completa"]'); r = await leer(page);
  caso("7 · Plan 8 con estrategia, Instagram y pauta completa", r, 3250000, 0);
  igual("Caso 7 · se llama \"Plan 8 completo\"", r.nombre, "Plan 8 completo");
  await page.close();

  page = await abrir(ctx); await mezcla(page, 0, 0, 8); r = await leer(page);
  caso("12 · 8 estáticas, solo contenidos", r, 1600000, 0);
  await page.close();

  // ---------- El manejo de la red sube con el plan ----------
  page = await abrir(ctx); await marcar(page, '[data-red="Instagram"]'); r = await leer(page);
  ok("Con 8 contenidos, Instagram cuesta $400.000", /Manejo de Instagram \$400\.000/.test(r.lineas) && (await page.locator('[data-calc="primeraRed"]').textContent()) === "$400.000", r.lineas);
  await atajo(page, "p12"); r = await leer(page);
  ok("Al pasar a 12, la línea de redes pasa a $600.000 (y el rótulo también)", /Manejo de Instagram \$600\.000/.test(r.lineas) && (await page.locator('[data-calc="primeraRed"]').textContent()) === "$600.000", r.lineas);
  await atajo(page, "p15"); await marcar(page, '[data-red="TikTok"]'); r = await leer(page);
  ok("Con 15 y dos redes: $750.000 + $300.000", /Manejo de Instagram y TikTok \$1\.050\.000/.test(r.lineas), r.lineas);
  ok("Ningún rótulo muestra la fórmula", !/por contenido/i.test(await page.locator("#arma-tu-plan").innerText()));
  await page.close();

  // ---------- Límites ----------
  page = await abrir(ctx);
  const menos = page.locator('.pp[data-d="-1"][data-tipo]'), mas = page.locator('.pp[data-d="1"][data-tipo]');
  ok("En 8, los tres botones de quitar están desactivados", (await menos.evaluateAll((bs) => bs.every((b) => b.disabled))));
  await page.evaluate(() => document.querySelectorAll('.pp[data-d="-1"][data-tipo]').forEach((b) => { b.disabled = false; b.click(); }));
  r = await leer(page);
  igual("No deja bajar de 8 (ni forzando el clic)", r.nombre + " · " + r.mensual, "Plan 8 · 1600000");
  ok("En 8, un texto lo explica", /8 es el mínimo/.test(await page.locator("#limite").textContent()), await page.locator("#limite").textContent());
  await atajo(page, "p15");
  ok("En 15, los tres botones de agregar están desactivados", (await mas.evaluateAll((bs) => bs.every((b) => b.disabled))));
  await page.evaluate(() => document.querySelectorAll('.pp[data-d="1"][data-tipo]').forEach((b) => { b.disabled = false; b.click(); }));
  r = await leer(page);
  igual("No deja subir de 15 (ni forzando el clic)", r.nombre + " · " + r.mensual, "Plan 15 · 3000000");
  ok("En 15, un texto lo explica", /15 es el máximo/.test(await page.locator("#limite").textContent()), await page.locator("#limite").textContent());
  await page.close();

  // ---------- Plan completo: se arma y se desarma ----------
  page = await abrir(ctx); await marcar(page, '[data-red="TikTok"]'); await marcar(page, 'input[name="pauta"][value="completa"]'); await completo(page); r = await leer(page);
  igual("\"Quiero el plan completo\" no quita lo que ya estaba (TikTok y pauta completa)", r.lineas, "8 contenidos y 8 historias $1.600.000 | Estrategia del mes $250.000 | Manejo de TikTok $400.000 | Pauta completa $1.000.000");
  ok("Armado, el botón se cambia por la confirmación", !(await page.locator("#btn-completo").isVisible()) && (await page.locator("#k-ok").isVisible()), await page.locator("#k-ok").textContent());
  await centrar(page, "#in-estrategia"); await page.locator("#in-estrategia").uncheck({ force: true }); r = await leer(page);
  ok("Al quitar la estrategia deja de ser completo y vuelve el botón", r.nombre === "Plan 8" && r.falta === "Te falta la estrategia del mes para el plan completo." && (await page.locator("#btn-completo").isVisible()), r.falta);
  await marcar(page, 'input[name="pauta"][value="ninguna"]'); r = await leer(page);
  igual("Pauta: las tres opciones se excluyen", r.lineas, "8 contenidos y 8 historias $1.600.000 | Manejo de TikTok $400.000");
  igual("El precio del plan completo se ve para la cantidad elegida", (await page.locator(".completo-n").innerText()).replace(/\s+/g, " ").trim(), "Plan 8 completo $2.500.000 al mes");
  await atajo(page, "p15"); await page.waitForTimeout(600);
  igual("…y cambia con la cantidad", (await page.locator(".completo-n").innerText()).replace(/\s+/g, " ").trim(), "Plan 15 completo $4.250.000 al mes");
  await page.close();

  // ---------- Mensaje de WhatsApp ----------
  page = await abrir(ctx); await atajo(page, "p12"); await completo(page); r = await leer(page);
  igual("WhatsApp 1 · plan completo", r.mensaje, "Hola, CJ. Armé este plan en la página: Plan 12 completo (8 videos, 2 carruseles y 2 estáticas). Incluye estrategia del mes, manejo de Instagram y pauta básica. Mensual: $3.500.000. Quiero mi diagnóstico de 15 minutos.");
  ok("WhatsApp 1 · el enlace va al 573009867822", r.href.startsWith(WA), r.href.slice(0, 40));
  igual("WhatsApp 1 · la barra del celular manda el mismo plan", r.hrefBarra, r.href);
  igual("La barra del celular muestra el mismo total", r.barra, r.mensual);
  igual("La barra nombra el plan completo", r.rotuloBarra, "Plan 12 completo");
  ok("aria-live anuncia el total", r.vivo === "Plan 12 completo. Total al mes: $3.500.000." && (await page.locator("#r-vivo").getAttribute("aria-live")) === "polite", r.vivo);
  await conIA(page, 3); await marcar(page, '[data-red="TikTok"]'); r = await leer(page);
  igual("Con algo de más, la barra dice \"Total al mes\"", r.rotuloBarra, "Total al mes");
  await marcar(page, 'input[name="speak"][value="promax"]'); await marcar(page, '[data-interes="página web"]'); r = await leer(page);
  igual("WhatsApp 2 · completo con videos con IA, Speak y algo más", r.mensaje, "Hola, CJ. Armé este plan en la página: Plan 12 completo (8 videos, 3 de ellos con IA, 2 carruseles y 2 estáticas). Incluye estrategia del mes, manejo de Instagram y TikTok y pauta básica. Adicionales: Speak Pro Max. Mensual: $4.550.000. Una sola vez: $1.600.000. Quiero mi diagnóstico de 15 minutos. También me interesa: página web.");
  await page.close();

  page = await abrir(ctx); r = await leer(page);
  igual("WhatsApp 3 · solo contenidos, sin la frase de adicionales", r.mensaje, "Hola, CJ. Armé este plan en la página: Plan 8 (6 videos y 2 carruseles). Mensual: $1.600.000. Quiero mi diagnóstico de 15 minutos.");
  igual("Solo contenidos: la barra dice el plan", r.rotuloBarra, "Plan 8 · al mes");
  await atajo(page, "p12"); await marcar(page, '[data-red="Instagram"]'); await marcar(page, 'input[name="pauta"][value="basica"]'); await marcar(page, 'input[name="speak"][value="pro"]'); r = await leer(page);
  igual("WhatsApp 4 · no completo: \"Adicionales\" solo con lo marcado", r.mensaje, "Hola, CJ. Armé este plan en la página: Plan 12 (8 videos, 2 carruseles y 2 estáticas). Adicionales: manejo de Instagram, pauta básica, Speak Pro. Mensual: $3.250.000. Una sola vez: $800.000. Quiero mi diagnóstico de 15 minutos.");
  await page.close();

  page = await abrir(ctx, "?utm_campaign=prueba"); r = await leer(page);
  ok("utm_campaign=prueba agrega \"Ref: prueba\" al final", r.mensaje.endsWith("Quiero mi diagnóstico de 15 minutos. Ref: prueba"), r.mensaje.slice(-60));
  await page.close();
  page = await abrir(ctx, "?utm_source=instagram"); r = await leer(page);
  ok("utm_source=instagram agrega \"Ref: instagram\"", r.mensaje.endsWith(" Ref: instagram"), r.mensaje.slice(-40));
  await page.close();
  page = await abrir(ctx); r = await leer(page);
  ok("Sin utm no hay \"Ref:\"", !/Ref:/.test(r.mensaje), r.mensaje.slice(-45));

  // ---------- Página: enlaces, tarjetas, restos de la oferta anterior ----------
  const enlaces = await page.locator('a[href*="wa.me"], a[href*="whatsapp"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  ok("Todos los enlaces a WhatsApp usan el 573009867822 (" + enlaces.length + " enlaces)", enlaces.length >= 5 && enlaces.every((h) => h.startsWith("https://wa.me/573009867822?text=")));
  igual("No hay formularios ni campos de texto", await page.locator('form, input[type="text"], input[type="email"], input[type="tel"], textarea, select').count(), 0);
  igual("Partes de Planes y precios, en orden", (await page.locator("main > section, main > nav").evaluateAll((x) => x.map((e) => e.id))).join(" "), "cabecera pestanas planes arma-tu-plan incluye start-content preguntas cierre");
  igual("Tarjetas: solo contenidos", (await page.locator("[data-plan-solo]").allTextContents()).join(" "), "$1.600.000 $2.400.000 $3.000.000");
  igual("Tarjetas: plan completo", (await page.locator("[data-plan-completo]").allTextContents()).join(" "), "$2.500.000 $3.500.000 $4.250.000");
  igual("Start Content: precio desde CJ_PLAN y su mensaje", (await page.locator(".sc-precio").innerText()).replace(/\s+/g, " ").trim() + " · " + decodeURIComponent((await page.locator("#start-content a[data-wa]").getAttribute("href")).split("text=")[1]), "$1.200.000, pago único · Hola, CJ. Quiero empezar con Start Content.");
  igual("\"¿Algo más para tu negocio?\" enlaza a Otros servicios", await page.locator('.bloque a[href="/otros-servicios/"]').innerText().then((t) => t.trim()), "Ver otros servicios");
  const html = await page.evaluate(() => document.documentElement.outerHTML);
  const restos = [/growth/i, /luces b[áa]sicas/i, /desde \$1\.000\.000/i, /clon/i, /avatar/i, /asistente de whatsapp/i, /diagn[óo]stico de procesos/i, /responder por whatsapp/i, /\$1\.500\.000/, /estrategia completa/i, /luces PRO para/i, /305\s?200\s?7745/, /\$600\.000 al mes/, /gesti[óo]n de pauta/i, /estrategia b[áa]sica/i].filter((re) => re.test(html)).map(String);
  igual("Sin restos de la oferta anterior en el HTML", restos.join(" "), "");
  igual("Preguntas, en orden", (await page.locator(".faq-b").allInnerTexts()).map((t) => t.trim()).join(" | "), "¿Tengo que salir yo en los videos? | ¿Qué es el plan completo? | ¿Cuánto tiempo me quita al mes? | ¿Ustedes publican y responden los mensajes? | ¿Necesito pagar pauta? | ¿Qué pasa si quiero más contenido? | ¿Qué garantizan? | ¿Cómo empezamos?");

  await page.locator("#planes").scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  await page.locator('[data-elegir="p12"][data-modo="completo"]').click(); await page.waitForTimeout(1500); r = await leer(page);
  igual("Tarjeta \"Elegir plan completo\" (Plan 12) carga el plan completo", r.nombre + " · " + r.mensual, "Plan 12 completo · 3500000");
  ok("…y baja hasta el cotizador", await page.evaluate(() => { const t = document.getElementById("arma-tu-plan").getBoundingClientRect().top; return t > -5 && t < 200; }));
  await page.locator('[data-elegir="p15"][data-modo="solo"]').evaluate((b) => b.click()); await page.waitForTimeout(1500); r = await leer(page);
  igual("Tarjeta \"Solo contenidos\" (Plan 15) carga solo contenidos", r.nombre + " · " + r.mensual, "Plan 15 · 3000000");

  // ---------- En celular, al tocar Speak el cambio se ve sin desplazarse ----------
  {
    const p2 = await abrir(ctx);
    await centrar(p2, 'input[name="speak"][value="pro"]'); await p2.waitForTimeout(300);
    const antes = (await p2.locator("#pb-nombre").textContent()) + " " + (await p2.locator("#pb-total").textContent());
    await p2.locator('input[name="speak"][value="pro"]').check({ force: true }); await p2.waitForTimeout(700);
    const enVista = await p2.evaluate(() => { const b = document.getElementById("plan-barra").getBoundingClientRect(), c = document.querySelector('input[name="speak"][value="pro"]').getBoundingClientRect(); return b.top < innerHeight && b.bottom <= innerHeight + 1 && c.top > 0 && c.bottom < b.top; });
    const ahora = (await p2.locator("#pb-nombre").textContent()) + " " + (await p2.locator("#pb-total").textContent()) + " · " + (await p2.locator("#pb-despues").innerText()).replace(/\s+/g, " ").trim();
    ok("Al tocar Speak Pro, la barra fija cambia a la vista, sin desplazarse", enVista && antes === "Plan 8 · al mes $1.600.000" && ahora === "Primer mes $2.400.000 · después $1.600.000 al mes", antes + "  →  " + ahora);
    await p2.close();
  }

  // ---------- Medición ----------
  await page.evaluate(() => document.querySelectorAll('a[href^="https://wa.me/"]').forEach((a) => a.addEventListener("click", (e) => e.preventDefault())));
  await page.locator("#r-wa").click();
  const capa = await page.evaluate(() => window.dataLayer.map((e) => e.event + (e.value ? ":" + e.value + ":" + e.currency : "")));
  ok("dataLayer: PageView al entrar", capa[0] === "PageView", capa.join(", "));
  ok("dataLayer: ViewContent al llegar al cotizador", capa.includes("ViewContent"));
  igual("dataLayer: PlanConfigurado una sola vez, con el total nuevo", capa.filter((e) => e.startsWith("PlanConfigurado")).join("|"), "PlanConfigurado:3500000:COP");
  igual("dataLayer: Contact con el total del plan", capa[capa.length - 1], "Contact:3000000:COP");
  ok("Con pixelId vacío no se carga nada de Meta", await page.evaluate(() => typeof window.fbq === "undefined" && !document.querySelector('script[src*="facebook"]')));
  igual("Sin peticiones a otros dominios", page._externas.join(" "), "");
  igual("Sin errores en la consola", page._errores.join(" | "), "");

  // ---------- Barra superior ----------
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await page.waitForTimeout(500);
  ok("Arriba, la barra ofrece \"Arma tu plan\"", (await page.locator("#barra-plan").isVisible()) && !(await page.locator("#barra-wa").isVisible()));
  await page.evaluate(() => { const t = document.getElementById("b2").getBoundingClientRect().top + window.scrollY; window.scrollTo({ top: t - 200, behavior: "instant" }); }); await page.waitForTimeout(500);
  ok("Con el cotizador en pantalla, el botón de la barra pasa a WhatsApp con el plan", (await page.locator("#barra-wa").isVisible()) && !(await page.locator("#barra-plan").isVisible()) && (await page.locator("#barra-wa").getAttribute("href")) === (await page.locator("#r-wa").getAttribute("href")), (await page.locator("#barra-wa").textContent()).trim());

  // ---------- Teclado ----------
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-atajo="p12"]').focus(); await page.keyboard.press("Enter");
  await page.locator("#btn-completo").focus(); await page.keyboard.press("Enter");
  await page.locator('[data-red="TikTok"]').focus(); await page.keyboard.press("Space");
  await page.locator('input[name="pauta"][value="basica"]').focus(); await page.keyboard.press("ArrowDown");
  await page.locator('.pp[data-tipo="videos"][data-d="1"]').focus(); await page.keyboard.press("Enter");
  r = await leer(page);
  await page.locator("#ia-mas").focus(); await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
  await page.locator('[data-interes="página web"]').focus(); await page.keyboard.press("Space");
  r = await leer(page);
  igual("Con teclado: Plan 13 completo + TikTok + pauta completa + 2 videos con IA + página web", r.nombre + " · " + r.mensual + " · " + r.interes, "Plan 13 completo · 5300000 · También me interesa: página web.");
  await page.close();

  // ---------- Sin JavaScript: lo que se ve es el estado inicial del modelo nuevo ----------
  const sinJs = await navegador.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  page = await sinJs.newPage(); await page.goto(BASE + "planes/", { waitUntil: "networkidle" });
  const estatico = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  ok("Sin JavaScript: Plan 8 a $1.600.000, planes completos y sin restos", /Plan 8/.test(estatico) && /TOTAL AL MES \$1\.600\.000/i.test(estatico) && /\$4\.250\.000/.test(estatico) && /\$1\.200\.000, pago único/.test(estatico) && !/growth|luces básicas|desde \$1\.000\.000|clon|avatar|asistente de whatsapp|diagnóstico de procesos/i.test(estatico));
  igual("Sin JavaScript: el enlace del plan", decodeURIComponent((await page.locator("#r-wa").getAttribute("href")).replace(WA, "")), "Hola, CJ. Armé este plan en la página: Plan 8 (6 videos y 2 carruseles). Mensual: $1.600.000. Quiero mi diagnóstico de 15 minutos.");
  await sinJs.close();

  // ---------- Calendario del inicio: interactivo ----------
  {
    const cal = async (pg) => ({
      n: await pg.locator("#cal .cal-red button.p").count(),
      presionados: await pg.locator('#cal .cal-red button[aria-pressed="true"]').count(),
      grabacion: await pg.locator("#cal .cal-red button.g").count(),
      cuenta: (await pg.locator("#cal-cuenta").innerText()).replace(/\s+/g, " ").trim(),
      aviso: (await pg.locator("#cal-aviso").textContent()).trim(),
    });
    const dia = (k) => "#cal .cal-red button:nth-child(" + (k + 1) + ")";       // k = 0 es el lunes de la semana 1
    const tocar = async (pg, k) => { await centrar(pg, dia(k)); await pg.locator(dia(k)).click(); };
    let pg = await ctx.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message)); pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await pg.goto(BASE, { waitUntil: "networkidle" });
    let c = await cal(pg);
    igual("Calendario: arranca con 8 días de publicación y 1 de grabación", c.n + "/" + c.presionados + "/" + c.grabacion + " · " + c.cuenta, "8/8/1 · 8 publicaciones al mes. Solo contenidos: $1.600.000.");
    igual("Calendario: 28 botones reales, con su etiqueta", (await pg.locator("#cal .cal-red button").count()) + " · " + (await pg.locator(dia(1)).getAttribute("aria-label")) + " · " + (await pg.locator(dia(0)).getAttribute("aria-label")) + " · " + (await pg.locator(dia(2)).getAttribute("aria-label")) + "=" + (await pg.locator(dia(2)).getAttribute("aria-pressed")), "28 · Publicación el martes de la semana 1 · Día de grabación: lunes de la semana 1 · Publicación el miércoles de la semana 1=true");
    ok("Calendario: la pista se ve antes de tocar", (await pg.locator("#cal-pista").isVisible()) && /Toca los días en que quieres publicar/.test(await pg.locator("#cal-pista").innerText()), (await pg.locator("#cal-pista").innerText()).trim());
    igual("Calendario: cursor de mano", await pg.locator(dia(1)).evaluate((b) => getComputedStyle(b).cursor), "pointer");
    await tocar(pg, 1); c = await cal(pg);
    igual("Calendario: tocar un día vacío suma una publicación y el valor", c.n + " · " + c.cuenta + " · " + (await pg.locator(dia(1)).getAttribute("aria-pressed")), "9 · 9 publicaciones al mes. Solo contenidos: $1.800.000. · true");
    await tocar(pg, 1); c = await cal(pg);
    igual("Calendario: tocar uno marcado lo quita", c.n + " · " + c.cuenta + " · " + (await pg.locator(dia(1)).getAttribute("aria-pressed")), "8 · 8 publicaciones al mes. Solo contenidos: $1.600.000. · false");
    await tocar(pg, 2); c = await cal(pg);
    igual("Calendario: no baja de 8, y una línea lo dice", c.n + " · " + c.aviso, "8 · 8 es el mínimo. Para mover un día, marca primero otro.");
    await tocar(pg, 0); c = await cal(pg);
    igual("Calendario: el día de grabación no se quita", c.grabacion + " · " + c.n + " · " + c.aviso, "1 · 8 · Este es tu único día de grabación.");
    for (const k of [1, 3, 5, 6, 7, 8, 10]) await tocar(pg, k);
    c = await cal(pg);
    igual("Calendario: llega a 15", c.n + " · " + c.cuenta + " · " + c.aviso, "15 · 15 publicaciones al mes. Solo contenidos: $3.000.000. · ");
    await tocar(pg, 12); c = await cal(pg);
    igual("Calendario: no pasa de 15, y una línea lo dice", c.n + " · " + c.aviso, "15 · 15 es el máximo. Para sumar un día, quita primero otro.");
    igual("Calendario: la línea viva es aria-live", (await pg.locator("#cal-cuenta").getAttribute("aria-live")) + "/" + (await pg.locator("#cal-aviso").getAttribute("aria-live")), "polite/polite");
    igual("Calendario: sin errores de consola", errs.join(" | "), "");
    await pg.close();

    // "Armar este plan": 9 (intermedio) y 12 (atajo)
    pg = await ctx.newPage(); await pg.goto(BASE, { waitUntil: "networkidle" });
    igual("Calendario: \"Armar este plan\" es un enlace con la cantidad", await pg.locator("#cal-armar").getAttribute("href"), "/planes/?contenidos=8#arma-tu-plan");
    await tocar(pg, 1); await centrar(pg, "#cal-armar"); await pg.locator("#cal-armar").click(); await pg.waitForURL(/planes/); await pg.waitForTimeout(1500);
    let rr = await leer(pg);
    igual("Calendario → \"Armar este plan\" con 9: Plan 9 a $1.800.000 (Plan 8 de ejemplo + 1 video)", rr.nombre + " · " + rr.grandeTexto + " · " + (await mezclaActual(pg)), "Plan 9 · $1.800.000 · 7/2/0");
    igual("Calendario → \"Armar este plan\" lleva a /planes/ con la cantidad en la dirección", pg.url().replace(BASE, "/"), "/planes/?contenidos=9#arma-tu-plan");
    ok("Calendario → \"Armar este plan\" llega al cotizador", await pg.evaluate(() => { const t = document.getElementById("arma-tu-plan").getBoundingClientRect().top; return t > -5 && t < 200; }));
    igual("Calendario → \"Armar este plan\" cuenta como plan configurado", (await pg.evaluate(() => window.dataLayer.filter((e) => e.event === "PlanConfigurado").map((e) => e.value + ":" + e.currency))).join("|"), "1800000:COP");
    await pg.goto(BASE, { waitUntil: "networkidle" });
    for (const k of [1, 3, 5, 6]) await tocar(pg, k);
    await centrar(pg, "#cal-armar"); await pg.locator("#cal-armar").click(); await pg.waitForURL(/contenidos=12/); await pg.waitForTimeout(1500); rr = await leer(pg);
    igual("Calendario → \"Armar este plan\" con 12: usa el atajo de Plan 12", rr.nombre + " · " + rr.grandeTexto + " · " + (await mezclaActual(pg)) + " · " + (await pg.locator('[data-atajo="p12"]').getAttribute("aria-pressed")), "Plan 12 · $2.400.000 · 8/2/2 · true");
    await pg.goto(BASE + "planes/?contenidos=7#arma-tu-plan", { waitUntil: "networkidle" }); rr = await leer(pg);
    igual("Una cantidad fuera de 8 a 15 en la dirección no se aplica", rr.nombre + " · " + rr.grandeTexto, "Plan 8 · $1.600.000");
    await pg.goto(BASE + "planes/?speak=pro#arma-tu-plan", { waitUntil: "networkidle" }); rr = await leer(pg);
    igual("\"Sumarlo a mi plan\" (Speak Pro) llega con Speak marcado", rr.numeroGrande + " · " + (await pg.locator('input[name="speak"]:checked').getAttribute("value")), "TU PRIMER MES 2400000 · después 1600000 al mes · pro");
    await pg.goto(BASE, { waitUntil: "networkidle" });
    igual("Los botones \"Arma tu plan\" del inicio y de la barra van al cotizador", (await pg.locator('.acciones a[href="/planes/#arma-tu-plan"]').innerText()).trim() + " → " + (await pg.locator("#barra-plan").getAttribute("href")), "Arma tu plan → /planes/#arma-tu-plan");
    await pg.close();

    // Teclado: Enter y espacio
    pg = await ctx.newPage(); await pg.goto(BASE, { waitUntil: "networkidle" });
    await pg.locator(dia(1)).focus(); await pg.keyboard.press("Enter");
    await pg.keyboard.press("Tab"); await pg.keyboard.press("Tab"); await pg.keyboard.press("Space");        // jueves de la semana 1
    c = await cal(pg);
    igual("Calendario con teclado: Enter y espacio marcan", c.n + " · " + (await pg.locator(dia(1)).getAttribute("aria-pressed")) + "/" + (await pg.locator(dia(3)).getAttribute("aria-pressed")), "10 · true/true");
    await pg.keyboard.press("Space"); c = await cal(pg);
    igual("Calendario con teclado: espacio otra vez lo quita", c.n + " · " + (await pg.locator(dia(3)).getAttribute("aria-pressed")), "9 · false");
    ok("Calendario con teclado: el foco se ve", await pg.locator(dia(3)).evaluate((b) => b === document.activeElement && getComputedStyle(b).outlineStyle !== "none" && parseFloat(getComputedStyle(b).outlineWidth) >= 2));
    await pg.locator("#cal-armar").focus(); await pg.keyboard.press("Enter"); await pg.waitForURL(/contenidos=9/); await pg.waitForTimeout(1200);
    igual("Calendario con teclado: \"Armar este plan\" con Enter", (await leer(pg)).nombre, "Plan 9");
    await pg.close();

    // Tamaño de las casillas en celular
    for (const w of [360, 390]) {
      const cx = await navegador.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true });
      const q = await cx.newPage(); await q.goto(BASE, { waitUntil: "networkidle" });
      await q.locator("#cal .cal-red").evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await q.waitForTimeout(2200);   // ya encendido
      const t = await q.locator("#cal .cal-red button").evaluateAll((bs) => { const r = bs.map((b) => b.getBoundingClientRect()); return Math.min(...r.map((x) => x.width)).toFixed(1) + "×" + Math.min(...r.map((x) => x.height)).toFixed(1); });
      ok("Calendario: cada casilla mide 44 px o más a " + w + " px", t.split("×").every((v) => parseFloat(v) >= 44), t);
      await cx.close();
    }

    // Sin JavaScript: la imagen del mes, sin nada tocable ni roto
    const sj = await navegador.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    pg = await sj.newPage(); await pg.goto(BASE, { waitUntil: "networkidle" });
    igual("Calendario sin JavaScript: la imagen del mes", (await pg.locator("#cal .cal-red").getAttribute("role")) + " · " + (await pg.locator("#cal .cal-red i").count()) + " casillas · " + (await pg.locator("#cal .cal-red i.p").count()) + " publicaciones · " + (await pg.locator("#cal .cal-red i.g").count()) + " grabación · " + (await pg.locator("#cal button").count()) + " botones visibles", "img · 28 casillas · 8 publicaciones · 1 grabación · 0 botones visibles".replace("0 botones visibles", ((await pg.locator("#cal button:visible").count()) === 0 ? (await pg.locator("#cal button").count()) : -1) + " botones visibles"));
    ok("Calendario sin JavaScript: no se ven la pista ni \"Armar este plan\"", !(await pg.locator("#cal-pista").isVisible()) && !(await pg.locator("#cal-armar").isVisible()) && (await pg.locator("#cal .cal-red i.p").first().evaluate((e) => getComputedStyle(e).backgroundColor)) === "rgb(145, 51, 231)");
    await sj.close();
  }

  // ---------- Texto: lo prohibido no aparece ----------
  page = await abrir(ctx);
  const texto = (await page.evaluate(() => document.body.innerText + " " + document.head.innerText + " " + [...document.querySelectorAll("meta[content]")].map((m) => m.content).join(" "))).replace(/\s+/g, " ");
  const prohibido = [/cupo/i, /hollywood/i, /descuento/i, /testimoni/i, /caso de éxito/i, /triplic/i, /USD/, /clientes (felices|satisfechos|atendidos)/i, /años de experiencia/i, /indistinguible/i, /viral/i, /últim[oa]s/i, /oferta/i, /\d+ ?%/, /garantizamos (ventas|resultados|seguidores)/i, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u];
  igual("Nada de lo prohibido en el texto de la página", prohibido.filter((re) => re.test(texto)).map(String).join(" "), "");
  await page.close();

  await navegador.close(); servidor.close();
  let fallos = 0;
  for (const x of resultados) { if (!x.pasa) fallos++; console.log((x.pasa ? "PASA  " : "FALLA ") + x.nombre + (x.detalle ? "  →  " + x.detalle : "")); }
  console.log("\n" + (resultados.length - fallos) + " de " + resultados.length + " pruebas pasan.");
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
