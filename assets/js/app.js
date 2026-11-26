/* CJ Casa Digital · landing · sin dependencias */

/* Medición: con pixelId vacío no se carga nada de Meta. Los eventos igual quedan en window.dataLayer. */
const CJ_CONFIG = { pixelId: "" };

/* Todo el cálculo del cotizador sale de aquí. Para cambiar un precio, cámbialo solo en este objeto:
   la página (inicio, tarjetas de planes, rótulos del cotizador, total y mensaje de WhatsApp) lo toma de aquí.
   Los valores escritos en index.html son solo lo que se ve si el navegador no corre JavaScript.

   Cómo se arma el precio: solo los contenidos cuestan `porContenido` cada uno, y encima se suma lo que la persona marque.
   "Plan completo" = contenidos + estrategia del mes + manejo de una red + pauta básica
   (Plan 8: $2.500.000 · Plan 12: $3.500.000 · Plan 15: $4.250.000). */
const CJ_PLAN = {
  whatsapp: "573052007745",
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
  avatar: { precio: 1500000, videosIncluidos: 4, videoAdicional: 250000 },
  speak: {                  // una sola vez
    pro:    { nombre: "Speak Pro", precio: 800000 },
    promax: { nombre: "Speak Pro Max", precio: 1600000 }
  },
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
    if (e.videos) partes.push(cuantos(e.videos, "video", "videos"));
    if (e.carruseles) partes.push(cuantos(e.carruseles, "carrusel", "carruseles"));
    if (e.estaticas) partes.push(cuantos(e.estaticas, "estática", "estáticas"));
    return enLista(partes);
  }

  /* ---------- Estado y cálculo ---------- */
  var ORDEN_REDES = ["Instagram", "Facebook", "TikTok", "LinkedIn"];
  var inicial = P.atajos[P.inicial];
  var estado = {
    videos: inicial.videos, carruseles: inicial.carruseles, estaticas: inicial.estaticas,
    estrategia: false, redes: [], pauta: "ninguna",
    avatar: false, avatarVideos: P.avatar.videosIncluidos, speak: "ninguno"
  };

  function total(e) { return e.videos + e.carruseles + e.estaticas; }
  function precioSolo(n) { return P.porContenido * n; }
  function precioPrimeraRed(n) { return P.redes.porContenido * n; }
  function precioCompleto(n) { return precioSolo(n) + P.estrategia + precioPrimeraRed(n) + P.pauta.basica.precio; }

  /* Deja el estado dentro de las reglas: avatar solo con 4 videos o más y sin pasar de los videos del plan. */
  function normalizar(e) {
    if (e.videos < P.avatar.videosIncluidos) e.avatar = false;
    e.avatarVideos = Math.max(P.avatar.videosIncluidos, Math.min(e.avatarVideos, Math.max(e.videos, P.avatar.videosIncluidos)));
    if (!e.avatar) e.avatarVideos = P.avatar.videosIncluidos;
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

    if (e.avatar) {
      var extra = Math.max(0, e.avatarVideos - P.avatar.videosIncluidos);
      var avatar = P.avatar.precio + P.avatar.videoAdicional * extra;
      mensual += avatar;
      lineas.push({ id: "avatar", texto: "Avatar con IA, " + cuantos(e.avatarVideos, "video", "videos"), valor: avatar });
      otros.push("avatar con IA (" + cuantos(e.avatarVideos, "video", "videos") + ")");
    }
    if (P.speak[e.speak]) {
      unaVez += P.speak[e.speak].precio;
      lineas.push({ id: "speak", texto: P.speak[e.speak].nombre, valor: P.speak[e.speak].precio, unaVez: true });
      otros.push(P.speak[e.speak].nombre);
    }

    var completo = falta.length === 0;
    return {
      total: n, base: "Plan " + n, completo: completo, nombre: "Plan " + n + (completo ? " completo" : ""),
      mezcla: mezclaTexto(e), contenidos: contenidos, precioCompleto: precioCompleto(n), primeraRed: precioPrimeraRed(n),
      lineas: lineas, incluye: incluye, otros: otros, falta: falta,
      mensual: mensual, unaVez: unaVez, primerMes: mensual + unaVez,
      conAdicionalesAlMes: mensual > contenidos,
      completoJusto: completo && mensual === precioCompleto(n)   // el plan completo tal cual, sin nada de más
    };
  }

  /* ---------- WhatsApp ---------- */
  var referencia = (function () {
    try {
      var q = new URLSearchParams(window.location.search);
      var v = q.get("utm_campaign") || q.get("utm_source") || "";
      return v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 80);
    } catch (err) { return ""; }
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
    var clave = e.videos + "-" + e.carruseles + "-" + e.estaticas;
    if (clave === fichasAntes) return;
    var antes = fichasAntes ? fichasAntes.split("-").map(Number) : null;
    fichasAntes = clave;
    var html = "", orden = ["videos", "carruseles", "estaticas"];
    orden.forEach(function (tipo, i) {
      for (var k = 0; k < e[tipo]; k++) {
        var nueva = antes && k >= antes[i] ? " nueva" : "";
        html += '<span class="ficha-t ' + TIPOS[tipo][0] + nueva + '"><svg class="ic" aria-hidden="true"><use href="#' + TIPOS[tipo][1] + '"/></svg></span>';
      }
    });
    caja.innerHTML = html;
    caja.setAttribute("aria-label", c.mezcla);
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

    var avatarSi = estado.videos >= P.avatar.videosIncluidos;
    if ($("in-avatar")) { $("in-avatar").checked = estado.avatar; $("in-avatar").disabled = !avatarSi; }
    if ($("env-avatar")) $("env-avatar").classList.toggle("no", !avatarSi);
    if ($("av-aviso")) $("av-aviso").hidden = avatarSi;
    if ($("sub-avatar")) $("sub-avatar").hidden = !estado.avatar;
    texto("n-avatar", String(estado.avatarVideos));
    if ($("av-menos")) $("av-menos").disabled = estado.avatarVideos <= P.avatar.videosIncluidos;
    if ($("av-mas")) $("av-mas").disabled = estado.avatarVideos >= estado.videos;

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
    ponerPesos($("r-mensual"), c.mensual);
    ponerPesos($("r-primer"), c.primerMes);
    if ($("r-unavez-fila")) $("r-unavez-fila").hidden = !c.unaVez;
    texto("r-unavez", pesos(c.unaVez));
    texto("r-vivo", c.nombre + ". Total al mes: " + pesos(c.mensual) + "." + (c.unaVez ? " Una sola vez: " + pesos(c.unaVez) + "." : ""));

    // Barra del celular y enlaces de WhatsApp con el plan
    texto("pb-nombre", c.completoJusto ? c.nombre : (c.conAdicionalesAlMes ? "Total al mes" : c.base + " · al mes"));
    ponerPesos($("pb-total"), c.mensual);
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
      avatar: P.avatar.precio, avatarVideo: P.avatar.videoAdicional,
      speakPro: P.speak.pro.precio, speakProMax: P.speak.promax.precio
    };
    todos("[data-p]").forEach(function (el) { var k = el.getAttribute("data-p"); if (k in mapa) el.textContent = pesos(mapa[k]); });
    todos("[data-plan-solo]").forEach(function (el) { el.textContent = pesos(precioSolo(Number(el.getAttribute("data-plan-solo")))); });
    todos("[data-plan-completo]").forEach(function (el) { el.textContent = pesos(precioCompleto(Number(el.getAttribute("data-plan-completo")))); });
    todos('[data-n="avatarIncluidos"]').forEach(function (el) { el.textContent = P.avatar.videosIncluidos; });
    var general = enlaceWa(P.mensajeGeneral);
    todos("a[data-wa]:not([data-plan-wa])").forEach(function (a) { a.href = general; });
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
    if ($("in-avatar")) $("in-avatar").addEventListener("change", function () { estado.avatar = $("in-avatar").checked; cambio(); });
    todos('input[name="speak"]').forEach(function (i) {
      i.addEventListener("change", function () { if (i.checked) { estado.speak = i.value; cambio(); } });
    });
    if ($("av-menos")) $("av-menos").addEventListener("click", function () { estado.avatarVideos -= 1; cambio(); });
    if ($("av-mas")) $("av-mas").addEventListener("click", function () { if (estado.avatarVideos < estado.videos) { estado.avatarVideos += 1; cambio(); } });

    // Tarjetas de planes: cargan el plan en el cotizador y bajan hasta él
    todos("[data-elegir]").forEach(function (b) {
      b.addEventListener("click", function () {
        ponerPlan(b.getAttribute("data-elegir"), b.getAttribute("data-modo")); cambio();
        var destino = $("cotizador"), titulo = $("cot-tit");
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
    var revs = todos(".rev"), cal = $("cal"), barra = $("plan-barra"), inicio = $("inicio"), cot = $("cotizador");
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
        }, { threshold: 0.35 });
        verCal.observe(cal);
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

  function arrancar() {
    try { rotulos(); pintar(); eventos(); preguntas(); }
    finally { movimiento(); }
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", arrancar); else arrancar();

  /* Para las pruebas automáticas */
  window.CJ = { plan: P, estado: estado, calcular: calcular, pintar: pintar, pesos: pesos, mensaje: function () { return conReferencia(mensajePlan(estado, calcular(estado))); } };
})();
