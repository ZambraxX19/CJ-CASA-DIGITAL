/* CJ Casa Digital · landing · sin dependencias */

/* Medición: con pixelId vacío no se carga nada de Meta. Los eventos igual quedan en window.dataLayer. */
const CJ_CONFIG = { pixelId: "" };

/* Todo el cálculo del cotizador sale de aquí. Para cambiar un precio, cámbialo solo en este objeto:
   la página (inicio, tarjetas de planes, rótulos del cotizador, total y mensaje de WhatsApp) lo toma de aquí.
   Los valores escritos en index.html son solo lo que se ve si el navegador no corre JavaScript. */
const CJ_PLAN = {
  whatsapp: "573052007745",
  cuotaFija: 500000,        // parte fija de cualquier plan, al mes
  porContenido: 250000,     // cada video, carrusel o estática, al mes
  minimo: 8,
  maximo: 15,
  atajos: {
    g8:  { videos: 6, carruseles: 2, estaticas: 0 },
    g12: { videos: 8, carruseles: 2, estaticas: 2 },
    g15: { videos: 9, carruseles: 4, estaticas: 2 }
  },
  inicial: "g12",
  redes: { primera: 600000, adicional: 400000 },                       // manejo de redes, al mes
  pauta: 1000000,                                                      // gestión de pauta, desde, al mes
  avatar: { precio: 1500000, videosIncluidos: 4, videoAdicional: 250000 }, // al mes
  luces: 250000,                                                       // luces PRO, al mes
  estrategia: 1200000,                                                 // una sola vez
  speak: {                                                             // una sola vez
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
    redes: [], pauta: false, avatar: false, avatarVideos: P.avatar.videosIncluidos,
    luces: false, estrategia: false, speak: "ninguno"
  };

  function total(e) { return e.videos + e.carruseles + e.estaticas; }

  /* Deja el estado dentro de las reglas: avatar solo con 4 videos o más y sin pasar de los videos del plan; luces solo si hay videos. */
  function normalizar(e) {
    if (e.videos < P.avatar.videosIncluidos) e.avatar = false;
    e.avatarVideos = Math.max(P.avatar.videosIncluidos, Math.min(e.avatarVideos, Math.max(e.videos, P.avatar.videosIncluidos)));
    if (!e.avatar) e.avatarVideos = P.avatar.videosIncluidos;
    if (e.videos < 1) e.luces = false;
    e.redes = ORDEN_REDES.filter(function (r) { return e.redes.indexOf(r) > -1; });
    return e;
  }

  function calcular(e) {
    var n = total(e);
    var lineas = [];      // desglose: { texto, valor, unaVez }
    var adicionales = []; // nombres para el mensaje de WhatsApp
    var plan = P.cuotaFija + P.porContenido * n;
    var mensual = plan;
    var unaVez = 0;
    lineas.push({ id: "plan", texto: cuantos(n, "contenido", "contenidos") + " y " + cuantos(n, "historia", "historias"), valor: plan });

    if (e.redes.length) {
      var redes = P.redes.primera + P.redes.adicional * (e.redes.length - 1);
      mensual += redes;
      lineas.push({ id: "redes", texto: "Manejo de " + enLista(e.redes), valor: redes });
      adicionales.push("manejo de " + enLista(e.redes));
    }
    if (e.pauta) {
      mensual += P.pauta;
      lineas.push({ id: "pauta", texto: "Gestión de pauta (desde)", valor: P.pauta });
      adicionales.push("gestión de pauta");
    }
    if (e.avatar) {
      var extra = Math.max(0, e.avatarVideos - P.avatar.videosIncluidos);
      var avatar = P.avatar.precio + P.avatar.videoAdicional * extra;
      mensual += avatar;
      lineas.push({ id: "avatar", texto: "Avatar con IA, " + cuantos(e.avatarVideos, "video", "videos"), valor: avatar });
      adicionales.push("avatar con IA (" + cuantos(e.avatarVideos, "video", "videos") + ")");
    }
    if (e.luces) {
      mensual += P.luces;
      lineas.push({ id: "luces", texto: "Luces PRO", valor: P.luces });
      adicionales.push("luces PRO");
    }
    if (e.estrategia) {
      unaVez += P.estrategia;
      lineas.push({ id: "estrategia", texto: "Estrategia completa", valor: P.estrategia, unaVez: true });
      adicionales.push("estrategia completa");
    }
    if (P.speak[e.speak]) {
      unaVez += P.speak[e.speak].precio;
      lineas.push({ id: "speak", texto: P.speak[e.speak].nombre, valor: P.speak[e.speak].precio, unaVez: true });
      adicionales.push(P.speak[e.speak].nombre);
    }
    return { total: n, nombre: "Growth " + n, mezcla: mezclaTexto(e), plan: plan, lineas: lineas, adicionales: adicionales,
             mensual: mensual, unaVez: unaVez, primerMes: mensual + unaVez,
             conAdicionalesAlMes: mensual > plan,   // el total ya no es solo el plan: el rótulo pasa a "Total al mes"
             desde: !!e.pauta };                    // la gestión de pauta es "desde": el total también
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
    if (c.adicionales.length) m += " Adicionales: " + c.adicionales.join(", ") + ".";
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

  function pintar() {
    normalizar(estado);
    var c = calcular(estado);
    var n = c.total;

    // Contadores y sus límites
    ["videos", "carruseles", "estaticas"].forEach(function (tipo) {
      var salida = $("n-" + tipo); if (salida) salida.textContent = estado[tipo];
      todos('.pp[data-tipo="' + tipo + '"]').forEach(function (b) {
        var paso = Number(b.getAttribute("data-d"));
        b.disabled = paso < 0 ? (estado[tipo] <= 0 || n <= P.minimo) : (n >= P.maximo);
      });
    });
    var limite = $("limite");
    if (limite) {
      var texto = "De " + P.minimo + " a " + P.maximo + " contenidos al mes. Cambiar la mezcla no cambia el precio.";
      if (n <= P.minimo) texto = P.minimo + " es el mínimo. Para cambiar la mezcla, suma una pieza y luego quita otra.";
      if (n >= P.maximo) texto = P.maximo + " es el máximo. Para cambiar la mezcla, quita una pieza y luego suma otra.";
      if (limite.textContent !== texto) limite.textContent = texto;
      limite.classList.toggle("tope", n <= P.minimo || n >= P.maximo);
    }
    todos("[data-atajo]").forEach(function (b) {
      var a = P.atajos[b.getAttribute("data-atajo")];
      b.setAttribute("aria-pressed", String(a.videos === estado.videos && a.carruseles === estado.carruseles && a.estaticas === estado.estaticas));
    });
    pintarFichas(estado, c);
    if ($("m-nombre")) $("m-nombre").textContent = c.nombre + ":";
    if ($("m-trae")) $("m-trae").textContent = c.lineas[0].texto + " al mes";

    // Adicionales
    todos("[data-red]").forEach(function (i) { i.checked = estado.redes.indexOf(i.getAttribute("data-red")) > -1; });
    if ($("in-pauta")) $("in-pauta").checked = estado.pauta;
    if ($("in-estrategia")) $("in-estrategia").checked = estado.estrategia;
    todos('input[name="speak"]').forEach(function (i) { i.checked = i.value === estado.speak; });

    var avatarSi = estado.videos >= P.avatar.videosIncluidos;
    if ($("in-avatar")) { $("in-avatar").checked = estado.avatar; $("in-avatar").disabled = !avatarSi; }
    if ($("env-avatar")) $("env-avatar").classList.toggle("no", !avatarSi);
    if ($("av-aviso")) $("av-aviso").hidden = avatarSi;
    if ($("sub-avatar")) $("sub-avatar").hidden = !estado.avatar;
    if ($("n-avatar")) $("n-avatar").textContent = estado.avatarVideos;
    if ($("av-menos")) $("av-menos").disabled = estado.avatarVideos <= P.avatar.videosIncluidos;
    if ($("av-mas")) $("av-mas").disabled = estado.avatarVideos >= estado.videos;

    var lucesSi = estado.videos > 0;
    if ($("in-luces")) { $("in-luces").checked = estado.luces; $("in-luces").disabled = !lucesSi; }
    if ($("env-luces")) $("env-luces").classList.toggle("no", !lucesSi);
    if ($("lu-aviso")) $("lu-aviso").hidden = lucesSi;

    // Resultado
    if ($("r-nombre")) $("r-nombre").textContent = c.nombre;
    if ($("r-mezcla")) $("r-mezcla").textContent = c.mezcla;
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
    if ($("r-mensual-desde")) $("r-mensual-desde").hidden = !c.desde;
    if ($("r-primer-desde")) $("r-primer-desde").hidden = !c.desde;
    if ($("r-unavez-fila")) $("r-unavez-fila").hidden = !c.unaVez;
    if ($("r-unavez")) $("r-unavez").textContent = pesos(c.unaVez);
    if ($("r-pauta-nota")) $("r-pauta-nota").hidden = !estado.pauta;
    var vivo = $("r-vivo");
    if (vivo) {
      var dicho = c.nombre + ". Total al mes: " + (c.desde ? "desde " : "") + pesos(c.mensual) + "." + (c.unaVez ? " Una sola vez: " + pesos(c.unaVez) + "." : "");
      if (vivo.textContent !== dicho) vivo.textContent = dicho;
    }

    // Barra del celular y enlaces de WhatsApp con el plan
    if ($("pb-nombre")) $("pb-nombre").textContent = (c.conAdicionalesAlMes ? "Total al mes" : c.nombre + " · al mes") + (c.desde ? " · desde" : "");
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
      desde: P.cuotaFija + P.porContenido * P.minimo,
      redesPrimera: P.redes.primera, redesAdicional: P.redes.adicional, pauta: P.pauta,
      avatar: P.avatar.precio, avatarVideo: P.avatar.videoAdicional, luces: P.luces, estrategia: P.estrategia,
      speakPro: P.speak.pro.precio, speakProMax: P.speak.promax.precio
    };
    todos("[data-p]").forEach(function (el) { var k = el.getAttribute("data-p"); if (k in mapa) el.textContent = pesos(mapa[k]); });
    todos("[data-plan-precio]").forEach(function (el) { el.textContent = pesos(P.cuotaFija + P.porContenido * Number(el.getAttribute("data-plan-precio"))); });
    todos('[data-n="avatarIncluidos"]').forEach(function (el) { el.textContent = P.avatar.videosIncluidos; });
    var general = enlaceWa(P.mensajeGeneral);
    todos("a[data-wa]:not([data-plan-wa])").forEach(function (a) { a.href = general; });
  }

  /* ---------- Eventos del cotizador ---------- */
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
    todos("[data-red]").forEach(function (i) {
      i.addEventListener("change", function () {
        var red = i.getAttribute("data-red"), pos = estado.redes.indexOf(red);
        if (i.checked && pos < 0) estado.redes.push(red);
        if (!i.checked && pos > -1) estado.redes.splice(pos, 1);
        cambio();
      });
    });
    [["in-pauta", "pauta"], ["in-avatar", "avatar"], ["in-luces", "luces"], ["in-estrategia", "estrategia"]].forEach(function (par) {
      var i = $(par[0]); if (!i) return;
      i.addEventListener("change", function () { estado[par[1]] = i.checked; cambio(); });
    });
    todos('input[name="speak"]').forEach(function (i) {
      i.addEventListener("change", function () { if (i.checked) { estado.speak = i.value; cambio(); } });
    });
    if ($("av-menos")) $("av-menos").addEventListener("click", function () { estado.avatarVideos -= 1; cambio(); });
    if ($("av-mas")) $("av-mas").addEventListener("click", function () { if (estado.avatarVideos < estado.videos) { estado.avatarVideos += 1; cambio(); } });

    // "Elegir este plan": carga el plan en el cotizador y sube hasta él
    todos("[data-elegir]").forEach(function (b) {
      b.addEventListener("click", function () {
        ponerAtajo(b.getAttribute("data-elegir")); cambio();
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
  function ponerAtajo(clave) {
    var a = P.atajos[clave]; if (!a) return;
    estado.videos = a.videos; estado.carruseles = a.carruseles; estado.estaticas = a.estaticas;
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

  /* ---------- Entradas, calendario y barra del celular ---------- */
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
