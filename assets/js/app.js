/* CJ Casa Digital · sitio · sin dependencias
   Un solo archivo para todas las páginas: cada parte revisa si su bloque existe antes de actuar
   (el cotizador solo está en /planes/, el calendario solo en el inicio). */

/* Medición: con pixelId vacío no se carga nada de Meta. Los eventos igual quedan en window.dataLayer. */
const CJ_CONFIG = { pixelId: "" };

/* Todo el cálculo del cotizador sale de aquí. Para cambiar un precio, cámbialo solo en este objeto:
   el sitio (inicio, menú, tarjetas de planes, rótulos del cotizador, total, Start Content, Speak y mensaje de WhatsApp) lo toma de aquí.
   Los valores escritos en index.html son solo lo que se ve si el navegador no corre JavaScript.

   Cómo se arma el precio: solo los contenidos cuestan `porContenido` cada uno, y encima se suma lo que la persona marque.
   "Plan completo" = contenidos + estrategia del mes + manejo de una red + pauta básica
   (Plan 8: $2.500.000 · Plan 12: $3.500.000 · Plan 15: $4.250.000).
   Lo de "¿Algo más para tu negocio?" (página web, automatización, capacitación, portafolio) no tiene precio aquí:
   se cotiza en el diagnóstico y solo viaja en el mensaje de WhatsApp. */
const CJ_PLAN = {
  whatsapp: "573009867822",
  porContenido: 200000,     // cada video, carrusel o estática, al mes
  minimo: 8,
  maximo: 15,
  atajos: {                 // mezclas de ejemplo
    p8:  { videos: 6, carruseles: 2, estaticas: 0 },
    p12: { videos: 8, carruseles: 2, estaticas: 2 },
    p15: { videos: 9, carruseles: 4, estaticas: 2 }
  },
  inicial: "p8",            // la página arranca en Plan 8, solo contenidos
  estrategia: 250000,       // estrategia del mes
  redes: {
    porContenido: 50000,    // manejo de la primera red: este valor por cada contenido del plan
    adicional: 300000,      // cada red de más
    delPlanCompleto: "Instagram" // la red que marca "Quiero el plan completo"
  },
  pauta: {                  // la inversión en anuncios va aparte
    basica:   { nombre: "Pauta básica", precio: 250000 },
    completa: { nombre: "Pauta completa", precio: 1000000 }
  },
  videoConIA: 250000,       // cada video del plan que se haga con IA, al mes (la persona escoge cuántos, desde uno)
  speak: {                  // una sola vez
    pro:    { nombre: "Speak Pro", precio: 800000 },
    promax: { nombre: "Speak Pro Max", precio: 1600000 }
  },
  startContent: { nombre: "Start Content", precio: 1200000 },   // pago único: 3 videos y 1 hecho con IA en 15 días. No entra al cotizador
  mensajeGeneral: "Hola, CJ. Vi la página y quiero mi diagnóstico de 15 minutos."
};

(function () {
  "use strict";

  var P = CJ_PLAN;
  var d = document;
  var $ = function (id) { return d.getElementById(id); };
  var todos = function (sel, raiz) { return Array.prototype.slice.call((raiz || d).querySelectorAll(sel)); };
  var sinMovimiento = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Medición ---------- */
  window.dataLayer = window.dataLayer || [];
  function evento(nombre, datos, personalizado) {
    var fila = { event: nombre };
    for (var k in (datos || {})) fila[k] = datos[k];
    window.dataLayer.push(fila);
    if (typeof window.fbq === "function") window.fbq(personalizado ? "trackCustom" : "track", nombre, datos || {});
  }
  if (CJ_CONFIG.pixelId) {
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, d, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", CJ_CONFIG.pixelId);
  }
  evento("PageView");

  /* ---------- Utilidades de texto ---------- */
  function pesos(n) { return "$" + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function enLista(partes) {
    if (partes.length < 2) return partes.join("");
    var ultima = partes[partes.length - 1];
    var y = /^h?i/i.test(ultima) ? " e " : " y ";
    return partes.slice(0, -1).join(", ") + y + ultima;
  }
  function cuantos(n, uno, varios) { return n + " " + (n === 1 ? uno : varios); }
  function mezclaTexto(e) {
    var partes = [];
    if (e.videos) partes.push(cuantos(e.videos, "video", "videos") + (e.videosIA ? ", " + e.videosIA + " de ellos con IA" : ""));
    if (e.carruseles) partes.push(cuantos(e.carruseles, "carrusel", "carruseles"));
    if (e.estaticas) partes.push(cuantos(e.estaticas, "estática", "estáticas"));
    return enLista(partes);
  }

  /* ---------- Estado y cálculo ---------- */
  var ORDEN_REDES = ["Instagram", "Facebook", "TikTok", "LinkedIn"];
  var inicial = P.atajos[P.inicial];
  var estado = {
    videos: inicial.videos, carruseles: inicial.carruseles, estaticas: inicial.estaticas,
    videosIA: 0,             // cuántos de los videos del plan se hacen con IA
    estrategia: false, redes: [], pauta: "ninguna", speak: "ninguno",
    interes: []              // otros servicios que le interesan: no cambian el total
  };

  function total(e) { return e.videos + e.carruseles + e.estaticas; }
  function precioSolo(n) { return P.porContenido * n; }
  function precioPrimeraRed(n) { return P.redes.porContenido * n; }
  function precioCompleto(n) { return precioSolo(n) + P.estrategia + precioPrimeraRed(n) + P.pauta.basica.precio; }

  /* Deja el estado dentro de las reglas: los videos con IA no pasan de los videos del plan. */
  function normalizar(e) {
    e.videosIA = Math.max(0, Math.min(e.videosIA, e.videos));
    if (!P.pauta[e.pauta]) e.pauta = "ninguna";
    e.redes = ORDEN_REDES.filter(function (r) { return e.redes.indexOf(r) > -1; });
    return e;
  }

  function calcular(e) {
    var n = total(e);
    var lineas = [];     // desglose del resumen: { id, texto, valor, unaVez }
    var incluye = [];    // las tres cosas del plan completo que están marcadas (para el mensaje)
    var otros = [];      // lo demás que esté marcado
    var falta = [];      // lo que falta para el plan completo
    var contenidos = precioSolo(n);
    var mensual = contenidos;
    var unaVez = 0;
    lineas.push({ id: "plan", texto: cuantos(n, "contenido", "contenidos") + " y " + cuantos(n, "historia", "historias"), valor: contenidos });
    if (e.videosIA) {
      var conIA = P.videoConIA * e.videosIA;
      mensual += conIA;
      lineas.push({ id: "ia", texto: cuantos(e.videosIA, "video con IA", "videos con IA"), valor: conIA });
    }

    if (e.estrategia) {
      mensual += P.estrategia;
      lineas.push({ id: "estrategia", texto: "Estrategia del mes", valor: P.estrategia });
      incluye.push("estrategia del mes");
    } else falta.push("la estrategia del mes");

    if (e.redes.length) {
      var redes = precioPrimeraRed(n) + P.redes.adicional * (e.redes.length - 1);
      mensual += redes;
      lineas.push({ id: "redes", texto: "Manejo de " + enLista(e.redes), valor: redes });
      incluye.push("manejo de " + enLista(e.redes));
    } else falta.push("el manejo de una red");

    if (P.pauta[e.pauta]) {
      mensual += P.pauta[e.pauta].precio;
      lineas.push({ id: "pauta", texto: P.pauta[e.pauta].nombre, valor: P.pauta[e.pauta].precio });
      incluye.push(P.pauta[e.pauta].nombre.toLowerCase());
    } else falta.push("la pauta básica");

    if (P.speak[e.speak]) {
      unaVez += P.speak[e.speak].precio;
      lineas.push({ id: "speak", texto: P.speak[e.speak].nombre, valor: P.speak[e.speak].precio, unaVez: true });
      otros.push(P.speak[e.speak].nombre);
    }

    var completo = falta.length === 0;
    return {
      total: n, base: "Plan " + n, completo: completo, nombre: "Plan " + n + (completo ? " completo" : ""),
      mezcla: mezclaTexto(e), contenidos: contenidos, precioCompleto: precioCompleto(n), primeraRed: precioPrimeraRed(n),
      lineas: lineas, incluye: incluye, otros: otros, falta: falta, interes: e.interes.slice(),
      mensual: mensual, unaVez: unaVez, primerMes: mensual + unaVez,
      conAdicionalesAlMes: mensual > contenidos,
      completoJusto: completo && mensual === precioCompleto(n)   // el plan completo tal cual, sin nada de más
    };
  }

  /* ---------- WhatsApp ---------- */
  /* La referencia de campaña (utm_campaign o utm_source) se guarda mientras dure la visita, para que no se pierda
     al pasar de una página a otra: quien llega al inicio desde un anuncio y arma el plan en /planes/ sigue llevando su "Ref: …". */
  var referencia = (function () {
    var limpia = function (v) { return String(v || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 80); };
    var v = "";
    try { var q = new URLSearchParams(window.location.search); v = limpia(q.get("utm_campaign") || q.get("utm_source")); } catch (err) {}
    try {
      if (v) window.sessionStorage.setItem("cj_ref", v);
      else v = limpia(window.sessionStorage.getItem("cj_ref"));
    } catch (err) {}
    return v;
  })();
  function conReferencia(texto) { return referencia ? texto + " Ref: " + referencia : texto; }
  function enlaceWa(texto) { return "https://wa.me/" + P.whatsapp + "?text=" + encodeURIComponent(conReferencia(texto)); }
  function mensajePlan(e, c) {
    var m = "Hola, CJ. Armé este plan en la página: " + c.nombre + " (" + c.mezcla + ").";
    if (c.completo) {
      m += " Incluye " + enLista(c.incluye) + ".";
      if (c.otros.length) m += " Adicionales: " + c.otros.join(", ") + ".";
    } else if (c.incluye.length || c.otros.length) {
      m += " Adicionales: " + c.incluye.concat(c.otros).join(", ") + ".";
    }
    m += " Mensual: " + pesos(c.mensual) + ".";
    if (c.unaVez) m += " Una sola vez: " + pesos(c.unaVez) + ".";
    m += " Quiero mi diagnóstico de 15 minutos.";
    if (c.interes.length) m += " También me interesa: " + enLista(c.interes) + ".";
    return m;
  }

  /* ---------- Números que cambian con una transición corta ---------- */
  function ponerPesos(el, valor) {
    if (!el) return;
    var desde = el.hasAttribute("data-valor") ? Number(el.getAttribute("data-valor")) : valor;
    el.setAttribute("data-valor", valor);
    if (el._raf) cancelAnimationFrame(el._raf);
    if (sinMovimiento || desde === valor || !window.requestAnimationFrame) { el.textContent = pesos(valor); return; }
    var t0 = null, dur = 380;
    function paso(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / dur), suave = 1 - Math.pow(1 - k, 3);
      el.textContent = pesos(k < 1 ? Math.round((desde + (valor - desde) * suave) / 50000) * 50000 : valor);
      if (k < 1) el._raf = requestAnimationFrame(paso);
    }
    el._raf = requestAnimationFrame(paso);
  }

  /* ---------- Pintar el cotizador ---------- */
  var TIPOS = { videos: ["v", "i-video"], carruseles: ["c", "i-carrusel"], estaticas: ["e", "i-estatica"] };
  var fichasAntes = "";
  var lineasAntes = {};
  var primeraVez = true;

  function pintarFichas(e, c) {
    var caja = $("fichas"); if (!caja) return;
    var clave = e.videos + "-" + e.carruseles + "-" + e.estaticas + "-" + e.videosIA;
    if (clave === fichasAntes) return;
    var antes = fichasAntes ? fichasAntes.split("-").map(Number) : null;
    fichasAntes = clave;
    var html = "", orden = ["videos", "carruseles", "estaticas"];
    orden.forEach(function (tipo, i) {
      for (var k = 0; k < e[tipo]; k++) {
        var conIA = tipo === "videos" && k < e.videosIA;   // los videos con IA van primero, con su destello
        var nueva = antes && (k >= antes[i] || (tipo === "videos" && conIA !== (k < antes[3]))) ? " nueva" : "";
        html += '<span class="ficha-t ' + (conIA ? "ia" : TIPOS[tipo][0]) + nueva + '"><svg class="ic" aria-hidden="true"><use href="#' + (conIA ? "i-chispa" : TIPOS[tipo][1]) + '"/></svg></span>';
      }
    });
    caja.innerHTML = html;
    caja.setAttribute("aria-label", c.mezcla);
    if ($("fichas-ley")) $("fichas-ley").hidden = !e.videosIA;
  }
  function texto(id, valor) { var el = $(id); if (el && el.textContent !== valor) el.textContent = valor; }

  function pintar() {
    normalizar(estado);
    var c = calcular(estado);
    var n = c.total;

    // Contadores y sus límites
    ["videos", "carruseles", "estaticas"].forEach(function (tipo) {
      texto("n-" + tipo, String(estado[tipo]));
      todos('.pp[data-tipo="' + tipo + '"]').forEach(function (b) {
        var paso = Number(b.getAttribute("data-d"));
        b.disabled = paso < 0 ? (estado[tipo] <= 0 || n <= P.minimo) : (n >= P.maximo);
      });
    });
    var limite = $("limite");
    if (limite) {
      var aviso = "De " + P.minimo + " a " + P.maximo + " contenidos al mes. Cambiar la mezcla no cambia el precio.";
      if (n <= P.minimo) aviso = P.minimo + " es el mínimo. Para cambiar la mezcla, suma una pieza y luego quita otra.";
      if (n >= P.maximo) aviso = P.maximo + " es el máximo. Para cambiar la mezcla, quita una pieza y luego suma otra.";
      if (limite.textContent !== aviso) limite.textContent = aviso;
      limite.classList.toggle("tope", n <= P.minimo || n >= P.maximo);
    }
    todos("[data-atajo]").forEach(function (b) {
      var a = P.atajos[b.getAttribute("data-atajo")];
      b.setAttribute("aria-pressed", String(a.videos === estado.videos && a.carruseles === estado.carruseles && a.estaticas === estado.estaticas));
    });
    pintarFichas(estado, c);
    texto("m-nombre", c.base + ":");
    texto("m-trae", c.lineas[0].texto + " al mes");

    // Plan completo: su precio para esta cantidad, y si ya está armado
    texto("k-nombre", c.base + " completo");
    ponerPesos($("k-precio"), c.precioCompleto);
    if ($("completo")) $("completo").classList.toggle("listo", c.completo);
    if ($("btn-completo")) $("btn-completo").hidden = c.completo;
    if ($("k-ok")) $("k-ok").hidden = !c.completo;

    // Adicionales: cada precio ya calculado para el plan elegido
    if ($("in-estrategia")) $("in-estrategia").checked = estado.estrategia;
    todos("[data-red]").forEach(function (i) { i.checked = estado.redes.indexOf(i.getAttribute("data-red")) > -1; });
    todos('[data-calc="primeraRed"]').forEach(function (el) { ponerPesos(el, c.primeraRed); });
    todos('input[name="pauta"]').forEach(function (i) { i.checked = i.value === estado.pauta; });
    todos('input[name="speak"]').forEach(function (i) { i.checked = i.value === estado.speak; });

    todos("[data-interes]").forEach(function (i) { i.checked = estado.interes.indexOf(i.getAttribute("data-interes")) > -1; });

    // Videos con IA: de 0 a los videos del plan
    var hayVideos = estado.videos > 0;
    texto("n-ia", String(estado.videosIA));
    if ($("ia-menos")) $("ia-menos").disabled = estado.videosIA <= 0;
    if ($("ia-mas")) $("ia-mas").disabled = !hayVideos || estado.videosIA >= estado.videos;
    if ($("ia-fila")) $("ia-fila").classList.toggle("no", !hayVideos);
    if ($("ia-aviso")) $("ia-aviso").hidden = hayVideos;

    // Resultado
    texto("r-nombre", c.base);
    if ($("r-completo")) $("r-completo").hidden = !c.completo;
    if (d.querySelector(".resumen")) d.querySelector(".resumen").classList.toggle("es-completo", c.completo);
    texto("r-mezcla", c.mezcla);
    var falta = $("r-falta");
    if (falta) {
      var dicho = "";
      if (c.falta.length === 3) dicho = "Con estrategia, una red y pauta básica es el plan completo: " + pesos(c.precioCompleto) + " al mes.";
      else if (c.falta.length) dicho = (c.falta.length > 1 ? "Te faltan " : "Te falta ") + enLista(c.falta) + " para el plan completo.";
      falta.hidden = !dicho;
      if (falta.textContent !== dicho) falta.textContent = dicho;
    }
    var ul = $("r-lineas");
    if (ul) {
      var vistas = {};
      ul.innerHTML = c.lineas.map(function (l) {
        vistas[l.id] = true;
        var nueva = !primeraVez && !lineasAntes[l.id] ? ' class="nueva"' : "";
        return "<li" + nueva + "><span>" + l.texto + (l.unaVez ? " <small>una vez</small>" : "") + "</span><b>" + pesos(l.valor) + "</b></li>";
      }).join("");
      lineasAntes = vistas;
    }
    // El número grande: el total al mes o, si hay algo de una sola vez, el primer mes (y debajo, lo que sigue cada mes)
    var conUnaVez = c.unaVez > 0;
    texto("r-rotulo", conUnaVez ? "Tu primer mes" : "Total al mes");
    ponerPesos($("r-grande"), conUnaVez ? c.primerMes : c.mensual);
    if ($("r-despues")) $("r-despues").hidden = !conUnaVez;
    texto("r-mensual", pesos(c.mensual));
    if ($("r-unavez-fila")) $("r-unavez-fila").hidden = !conUnaVez;
    texto("r-unavez", pesos(c.unaVez));
    var res = d.querySelector(".resumen");
    if (res) { res.setAttribute("data-mensual", c.mensual); res.setAttribute("data-una-vez", c.unaVez); }
    var interes = $("r-interes");
    if (interes) {
      var quiere = c.interes.length ? "También me interesa: " + enLista(c.interes) + "." : "";
      interes.hidden = !quiere;
      if (interes.textContent !== quiere) interes.textContent = quiere;
    }
    texto("r-vivo", c.nombre + ". " + (conUnaVez ? "Tu primer mes: " + pesos(c.primerMes) + ". Después, " + pesos(c.mensual) + " al mes." : "Total al mes: " + pesos(c.mensual) + "."));

    // Barra del celular y enlaces de WhatsApp con el plan
    var rotuloBarra = conUnaVez ? "Primer mes" : (c.completoJusto ? c.nombre : (c.conAdicionalesAlMes ? "Total al mes" : c.base + " · al mes"));
    var barra = $("plan-barra");
    if (barra && !primeraVez && $("pb-nombre") && $("pb-nombre").textContent !== rotuloBarra && !sinMovimiento) {
      barra.classList.remove("pulso"); void barra.offsetWidth; barra.classList.add("pulso");   // que el cambio se note
    }
    texto("pb-nombre", rotuloBarra);
    ponerPesos($("pb-total"), conUnaVez ? c.primerMes : c.mensual);
    if ($("pb-despues")) $("pb-despues").hidden = !conUnaVez;
    texto("pb-mensual", pesos(c.mensual));
    var enlace = enlaceWa(mensajePlan(estado, c));
    todos("[data-plan-wa]").forEach(function (a) { a.href = enlace; });

    primeraVez = false;
    return c;
  }

  var configurado = false;
  function cambio() {
    var c = pintar();
    if (!configurado) { configurado = true; evento("PlanConfigurado", { value: c.mensual, currency: "COP" }, true); }
  }

  /* ---------- Precios y rótulos que salen de la configuración ---------- */
  function rotulos() {
    var mapa = {
      desde: precioSolo(P.minimo), desdeCompleto: precioCompleto(P.minimo),
      estrategia: P.estrategia, redAdicional: P.redes.adicional,
      pautaBasica: P.pauta.basica.precio, pautaCompleta: P.pauta.completa.precio,
      videoIA: P.videoConIA,
      speakPro: P.speak.pro.precio, speakProMax: P.speak.promax.precio, startContent: P.startContent.precio
    };
    todos("[data-p]").forEach(function (el) { var k = el.getAttribute("data-p"); if (k in mapa) el.textContent = pesos(mapa[k]); });
    todos("[data-plan-solo]").forEach(function (el) { el.textContent = pesos(precioSolo(Number(el.getAttribute("data-plan-solo")))); });
    todos("[data-plan-completo]").forEach(function (el) { el.textContent = pesos(precioCompleto(Number(el.getAttribute("data-plan-completo")))); });
    // Enlaces a WhatsApp que no llevan el plan: el mensaje general, o el propio de cada servicio (data-msg)
    todos("a[data-wa]:not([data-plan-wa])").forEach(function (a) { a.href = enlaceWa(a.getAttribute("data-msg") || P.mensajeGeneral); });
  }

  /* ---------- Acciones ---------- */
  function ponerAtajo(clave) {
    var a = P.atajos[clave]; if (!a) return;
    estado.videos = a.videos; estado.carruseles = a.carruseles; estado.estaticas = a.estaticas;
  }
  /* "Quiero el plan completo": marca lo que falte, sin quitar lo que la persona ya había escogido de más. */
  function completar() {
    estado.estrategia = true;
    if (!estado.redes.length) estado.redes = [P.redes.delPlanCompleto];
    if (!P.pauta[estado.pauta]) estado.pauta = "basica";
  }
  /* Las tarjetas de planes cargan el plan tal como lo anuncian: completo justo, o solo contenidos. */
  function ponerPlan(clave, modo) {
    ponerAtajo(clave);
    if (modo === "completo") { estado.estrategia = true; estado.redes = [P.redes.delPlanCompleto]; estado.pauta = "basica"; }
    else { estado.estrategia = false; estado.redes = []; estado.pauta = "ninguna"; }
  }

  function eventos() {
    todos(".pp[data-tipo]").forEach(function (b) {
      b.addEventListener("click", function () {
        var tipo = b.getAttribute("data-tipo"), paso = Number(b.getAttribute("data-d")), n = total(estado);
        if (paso < 0 && (estado[tipo] <= 0 || n <= P.minimo)) return;
        if (paso > 0 && n >= P.maximo) return;
        estado[tipo] += paso;
        cambio();
      });
    });
    todos("[data-atajo]").forEach(function (b) {
      b.addEventListener("click", function () { ponerAtajo(b.getAttribute("data-atajo")); cambio(); });
    });
    if ($("btn-completo")) $("btn-completo").addEventListener("click", function () {
      completar(); cambio();
      if ($("k-ok")) { $("k-ok").setAttribute("tabindex", "-1"); $("k-ok").focus({ preventScroll: true }); }
    });
    if ($("in-estrategia")) $("in-estrategia").addEventListener("change", function () { estado.estrategia = $("in-estrategia").checked; cambio(); });
    todos("[data-red]").forEach(function (i) {
      i.addEventListener("change", function () {
        var red = i.getAttribute("data-red"), pos = estado.redes.indexOf(red);
        if (i.checked && pos < 0) estado.redes.push(red);
        if (!i.checked && pos > -1) estado.redes.splice(pos, 1);
        cambio();
      });
    });
    todos('input[name="pauta"]').forEach(function (i) {
      i.addEventListener("change", function () { if (i.checked) { estado.pauta = i.value; cambio(); } });
    });
    if ($("ia-menos")) $("ia-menos").addEventListener("click", function () { if (estado.videosIA > 0) { estado.videosIA -= 1; cambio(); } });
    if ($("ia-mas")) $("ia-mas").addEventListener("click", function () { if (estado.videosIA < estado.videos) { estado.videosIA += 1; cambio(); } });
    todos("[data-interes]").forEach(function (i) {
      i.addEventListener("change", function () {
        estado.interes = todos("[data-interes]").filter(function (x) { return x.checked; }).map(function (x) { return x.getAttribute("data-interes"); });
        cambio();
      });
    });
    todos('input[name="speak"]').forEach(function (i) {
      i.addEventListener("change", function () { if (i.checked) { estado.speak = i.value; cambio(); } });
    });

    // Tarjetas de planes: cargan el plan en el cotizador y bajan hasta él
    todos("[data-elegir]").forEach(function (b) {
      b.addEventListener("click", function () {
        ponerPlan(b.getAttribute("data-elegir"), b.getAttribute("data-modo")); cambio();
        var destino = $("arma-tu-plan"), titulo = $("cot-tit");
        if (destino) destino.scrollIntoView({ behavior: sinMovimiento ? "auto" : "smooth", block: "start" });
        if (titulo) titulo.focus({ preventScroll: true });
      });
    });

    // Cada clic a WhatsApp
    d.addEventListener("click", function (ev) {
      var a = ev.target.closest ? ev.target.closest('a[href^="https://wa.me/"]') : null;
      if (a) evento("Contact", a.hasAttribute("data-plan-wa") ? { value: calcular(estado).mensual, currency: "COP" } : {});
    });
  }

  /* ---------- Calendario del inicio: cada día es un botón ----------
     La persona marca los días en que quiere publicar (de `minimo` a `maximo`) y ve cuánto vale ese mes en solo
     contenidos. "Armar este plan" es un enlace a /planes/ que lleva esa cantidad en la dirección
     (?contenidos=10) y el cotizador la lee al cargar. Sin JavaScript queda la imagen del mes. */
  var DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  /* Reparte una cantidad de contenidos: con 8, 12 o 15 usa la mezcla de ejemplo; con las intermedias,
     la mezcla de ejemplo anterior y el resto en videos (lo mismo que tocar "+" en Videos). */
  function ponerCantidad(n) {
    var base = null, cuanto = 0;
    Object.keys(P.atajos).forEach(function (k) {
      var a = P.atajos[k], t = a.videos + a.carruseles + a.estaticas;
      if (t <= n && t > cuanto) { base = k; cuanto = t; }
    });
    if (!base) return;
    ponerAtajo(base);
    estado.videos += n - cuanto;
  }
  function calendario() {
    var cal = $("cal"), red = cal ? cal.querySelector(".cal-red") : null;
    if (!red) return;
    var celdas = todos("i", red);
    if (!celdas.length) return;
    red.innerHTML = celdas.map(function (c, k) {
      var donde = DIAS[k % 7] + " de la semana " + (Math.floor(k / 7) + 1);
      var orden = c.style.getPropertyValue("--n"), estilo = orden ? ' style="--n:' + orden + '"' : "";
      if (c.classList.contains("g")) return '<button type="button" class="g" data-grabacion' + estilo + ' aria-label="Día de grabación: ' + donde + '">' + c.innerHTML + "</button>";
      var marcado = c.classList.contains("p");
      return '<button type="button"' + (marcado ? ' class="p"' : "") + estilo + ' aria-pressed="' + marcado + '" aria-label="Publicación el ' + donde + '"></button>';
    }).join("");
    red.setAttribute("role", "group");
    red.setAttribute("aria-label", "Días de publicación del mes");
    if ($("cal-pista")) $("cal-pista").hidden = false;
    if ($("cal-pie")) $("cal-pie").hidden = false;
    cal.classList.add("viva");

    function cuantas() { return red.querySelectorAll("button.p").length; }
    function contar() {
      var n = cuantas();
      texto("cal-n", cuantos(n, "publicación", "publicaciones"));
      texto("cal-precio", pesos(precioSolo(n)));
      if ($("cal-armar")) $("cal-armar").setAttribute("href", "/planes/?contenidos=" + n + "#arma-tu-plan");   // el cotizador la lee al cargar
    }
    function avisar(dicho) {
      var aviso = $("cal-aviso"); if (!aviso) return;
      aviso.textContent = "";            // para que se vuelva a anunciar aunque sea el mismo aviso
      aviso.textContent = dicho;
    }
    red.addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest("button") : null;
      if (!b || !red.contains(b)) return;
      cal.classList.add("despierta");        // desde el primer toque, la respuesta es inmediata
      if (b.hasAttribute("data-grabacion")) { avisar("Este es tu único día de grabación."); return; }
      var n = cuantas(), marcado = b.classList.contains("p");
      if (marcado && n <= P.minimo) { avisar(P.minimo + " es el mínimo. Para mover un día, marca primero otro."); return; }
      if (!marcado && n >= P.maximo) { avisar(P.maximo + " es el máximo. Para sumar un día, quita primero otro."); return; }
      b.classList.toggle("p", !marcado);
      b.setAttribute("aria-pressed", String(!marcado));
      cal.classList.add("tocado");
      avisar("");
      contar();
    });
    contar();
  }

  /* ---------- Lo que llega en la dirección de /planes/ ----------
     ?contenidos=10 (del calendario del inicio) y ?speak=pro o ?speak=promax ("Sumarlo a mi plan", en Otros servicios). */
  function deLaDireccion() {
    if (!$("arma-tu-plan")) return false;
    var q, hubo = false;
    try { q = new URLSearchParams(window.location.search); } catch (err) { return false; }
    var n = parseInt(q.get("contenidos"), 10);
    if (n >= P.minimo && n <= P.maximo) { ponerCantidad(n); hubo = true; }
    var sp = q.get("speak");
    if (sp && P.speak.hasOwnProperty(sp)) { estado.speak = sp; hubo = true; }
    return hubo;
  }

  /* ---------- Menú del celular ----------
     El menú está escrito en el HTML. Aquí solo se abre y se cierra: botón, Escape, y el foco no sale del menú mientras está abierto. */
  function menu() {
    var barra = $("barra"), boton = $("menu-btn"), panel = $("menu");
    if (!barra || !boton || !panel) return;
    var fuera = todos("main, footer, .plan-barra, .wa-flota, .salto");
    var ancho = window.matchMedia ? window.matchMedia("(min-width: 1000px)") : null;
    function abierto() { return boton.getAttribute("aria-expanded") === "true"; }
    function poner(abrir, devolverFoco) {
      boton.setAttribute("aria-expanded", String(abrir));
      boton.setAttribute("aria-label", abrir ? "Cerrar el menú" : "Abrir el menú");
      barra.classList.toggle("abierta", abrir);
      d.documentElement.classList.toggle("menu-abierto", abrir);
      fuera.forEach(function (el) { if (abrir) el.setAttribute("inert", ""); else el.removeAttribute("inert"); });
      if (abrir) panel.scrollTop = 0;
      if (!abrir && devolverFoco) boton.focus();
    }
    boton.addEventListener("click", function () { poner(!abierto()); });
    panel.addEventListener("click", function (ev) {       // un enlace a esta misma página (un ancla) cierra el menú
      if (ev.target.closest && ev.target.closest("a")) poner(false);
    });
    d.addEventListener("keydown", function (ev) {
      if (!abierto()) return;
      if (ev.key === "Escape") { ev.preventDefault(); poner(false, true); return; }
      if (ev.key !== "Tab") return;
      var focos = todos("a[href], button:not([disabled])", barra).filter(function (el) { return el.getClientRects().length > 0; });
      if (!focos.length) return;
      var primero = focos[0], ultimo = focos[focos.length - 1], aqui = d.activeElement;
      if (!barra.contains(aqui)) { ev.preventDefault(); primero.focus(); }
      else if (ev.shiftKey && aqui === primero) { ev.preventDefault(); ultimo.focus(); }
      else if (!ev.shiftKey && aqui === ultimo) { ev.preventDefault(); primero.focus(); }
    });
    if (ancho) {
      var alCambiar = function () { if (ancho.matches && abierto()) poner(false); };
      if (ancho.addEventListener) ancho.addEventListener("change", alCambiar); else if (ancho.addListener) ancho.addListener(alCambiar);
    }
  }

  /* ---------- Pestañas de /planes/: marcan en qué parte de la página vas ---------- */
  function pestanas() {
    var nav = $("pestanas");
    if (!nav || !("IntersectionObserver" in window)) return;
    var lista = nav.querySelector("ul"), enlaces = todos("a", nav), a_la_vista = {};
    var partes = enlaces.map(function (a) { return $(a.getAttribute("href").slice(1)); });
    function marcar() {
      var actual = null;
      partes.forEach(function (parte, k) { if (parte && a_la_vista[parte.id] && !actual) actual = enlaces[k]; });
      enlaces.forEach(function (a) {
        if (a === actual) {
          if (a.getAttribute("aria-current") !== "location") {
            a.setAttribute("aria-current", "location");
            if (lista && lista.scrollWidth > lista.clientWidth) lista.scrollTo({ left: Math.max(0, a.offsetLeft - 20), behavior: sinMovimiento ? "auto" : "smooth" });
          }
        } else a.removeAttribute("aria-current");
      });
      if (!actual && lista && lista.scrollLeft) lista.scrollTo({ left: 0, behavior: "auto" });
    }
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) { a_la_vista[en.target.id] = en.isIntersecting; });
      marcar();
    }, { rootMargin: "-30% 0px -65% 0px", threshold: 0 });
    partes.forEach(function (parte) { if (parte) obs.observe(parte); });
  }

  /* ---------- Videos ----------
     Sin JavaScript funcionan con los controles del navegador. Aquí se agrega el botón grande de reproducir,
     que al reproducir uno se pausen los demás, y la medición. El video no se pide hasta que la persona reproduce (preload="none"). */
  function videos() {
    var lista = todos("video[data-video]");
    lista.forEach(function (v) {
      var boton = v.parentNode.querySelector(".vid-play"), medido = false;
      if (boton) {
        boton.hidden = false;
        v.controls = false;   // hasta reproducir, el único control es el botón grande (menos paradas para el teclado)
        boton.addEventListener("click", function () {
          v.controls = true;
          var promesa = v.play();
          if (promesa && promesa.catch) promesa.catch(function () {});
          v.focus({ preventScroll: true });
        });
      }
      v.addEventListener("play", function () {
        if (boton) boton.hidden = true;
        v.controls = true;
        lista.forEach(function (otro) { if (otro !== v && !otro.paused) otro.pause(); });
        if (!medido) { medido = true; evento("VideoReproducido", { content_name: v.getAttribute("data-video") }, true); }
      });
    });
  }

  /* ---------- Preguntas ---------- */
  function preguntas() {
    todos(".faq-b").forEach(function (b) {
      var panel = $(b.getAttribute("aria-controls"));
      b.addEventListener("click", function () {
        var abrir = b.getAttribute("aria-expanded") !== "true";
        b.setAttribute("aria-expanded", String(abrir));
        if (panel) panel.classList.toggle("abierta", abrir);
      });
    });
  }

  /* ---------- Entradas, calendario y barras ---------- */
  function movimiento() {
    var revs = todos(".rev"), cal = $("cal"), cot = $("arma-tu-plan");
    var inicio = $("inicio") || $("cabecera");                 // el primer bloque de la página
    var barra = $("plan-barra"), flota = $("wa-flota");        // lo fijo de abajo en celular: uno u otro, según la página
    if (!("IntersectionObserver" in window)) {
      revs.forEach(function (el) { el.classList.add("visto"); });
      if (cal) cal.classList.add("on");
      if (cot) evento("ViewContent", { content_name: "Arma tu plan" });
      return;
    }
    var ver = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("visto"); ver.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    revs.forEach(function (el) { ver.observe(el); });

    if (cal) {
      if (sinMovimiento) cal.classList.add("on");
      else {
        var verCal = new IntersectionObserver(function (entradas) {
          if (entradas[0].isIntersecting) { cal.classList.add("on"); verCal.disconnect(); }
        }, { threshold: 0.25 });
        verCal.observe(cal.querySelector(".cal-red") || cal);
      }
    }
    if (barra && inicio) {
      var enlaceBarra = barra.querySelector("a");
      new IntersectionObserver(function (entradas) {
        var mostrar = !entradas[0].isIntersecting;
        barra.classList.toggle("ver", mostrar);
        barra.setAttribute("aria-hidden", String(!mostrar));
        if (enlaceBarra) enlaceBarra.tabIndex = mostrar ? 0 : -1;
      }, { threshold: 0 }).observe(inicio);
    }
    if (flota && inicio) {
      new IntersectionObserver(function (entradas) { flota.classList.toggle("ver", !entradas[0].isIntersecting); }, { threshold: 0 }).observe(inicio);
    }
    if (cot) {
      var verCot = new IntersectionObserver(function (entradas) {
        if (entradas[0].isIntersecting) { evento("ViewContent", { content_name: "Arma tu plan" }); verCot.disconnect(); }
      }, { threshold: 0.12 });
      verCot.observe(cot);
      // Mientras el cotizador está en pantalla, el botón de la barra superior no manda a donde ya estás: pasa a WhatsApp
      var botonPlan = $("barra-plan"), botonWa = $("barra-wa");
      if (botonPlan && botonWa) {
        new IntersectionObserver(function (entradas) {
          var dentro = entradas[0].isIntersecting;
          botonPlan.hidden = dentro; botonWa.hidden = !dentro;
        }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 }).observe(cot);
      }
    }
  }

  /* Llegar con un ancla (/planes/#preguntas): al terminar de cargar las fuentes la página se acomoda y la sección
     queda unos píxeles corrida. Se vuelve a ubicar, salvo que la persona ya haya empezado a moverse. */
  function anclaExacta() {
    var id = (location.hash || "").slice(1), movio = false, veces = 0;
    if (!id) return;
    function marca() { movio = true; }
    ["wheel", "touchstart", "keydown", "pointerdown"].forEach(function (ev) { window.addEventListener(ev, marca, { once: true, passive: true }); });
    function ubicar() {
      var destino = d.getElementById(id);
      if (!destino || movio || veces > 3) return;
      veces++;
      destino.scrollIntoView({ behavior: "auto", block: "start" });
    }
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(ubicar).catch(function () {});
    if (d.readyState === "complete") ubicar(); else window.addEventListener("load", function () { ubicar(); setTimeout(ubicar, 300); });
  }

  function arrancar() {
    try {
      rotulos();
      if (deLaDireccion()) cambio(); else pintar();   // llegar con una cantidad o con Speak ya es armar el plan
      eventos(); preguntas(); calendario(); videos();
    }
    finally { menu(); pestanas(); movimiento(); anclaExacta(); }
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", arrancar); else arrancar();

  /* Para las pruebas automáticas */
  window.CJ = { plan: P, estado: estado, calcular: calcular, pintar: pintar, pesos: pesos, mensaje: function () { return conReferencia(mensajePlan(estado, calcular(estado))); } };
})();
