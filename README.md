# Sitio de CJ Casa Digital

Es el sitio de www.cjcasadigital.com. Es estático, sin paso de compilación ni dependencias: Vercel publica lo que haya
en la rama `main`.

## Páginas

| Dirección | Archivo | Qué tiene |
|---|---|---|
| `/` | `index.html` | Titular con precio, calendario que se puede tocar, los cinco atajos "¿Qué buscas?", cómo funciona en tres pasos y los videos con IA (`/#videos-ia`) |
| `/planes/` | `planes/index.html` | Los tres planes, **Arma tu plan** (el cotizador), qué incluye, Start Content y las preguntas |
| `/como-funciona/` | `como-funciona/index.html` | Por qué sales tú, el proceso del mes en siete pasos y la garantía |
| `/otros-servicios/` | `otros-servicios/index.html` | IA para tu negocio (página web, automatización, capacitación, portafolio y presentaciones) y Speak |
| `/portafolios/` | `portafolios/index.html` | Los cinco PDF, cada uno con su resumen. Los PDF están en esa misma carpeta y no cambian de dirección |
| (lo que no exista) | `404.html` | Página de "no existe", con el mismo menú |

Además: `sitemap.xml` y `robots.txt` (si se agrega una página, se agrega al `sitemap.xml`), `assets/css/estilos.css`
(el diseño, con la paleta y las tipografías del manual de marca), `assets/js/app.js` (un solo archivo para todas las
páginas), `assets/fonts/` y `assets/img/`.

Todas las direcciones terminan en barra (`/planes/`): `vercel.json` lo dice (`"trailingSlash": true`), así que quien
escriba `/planes` llega a `/planes/`. Lo otro que trae `vercel.json` es la caché larga de los medios (ver "Imágenes y videos"). Todos los enlaces y los recursos van con la ruta desde la raíz (`/assets/…`,
`/planes/`), así que el sitio se prueba con un servidor desde la raíz, no abriendo el archivo.

## Menú, cierre y pie: de dónde se copian

El menú, el bloque de cierre ("El siguiente paso es un mensaje") y el pie están escritos en el HTML de cada página, sin
JavaScript, y son **idénticos en las seis**. La fuente es `index.html`. Cada bloque va entre dos comentarios:

```
<!-- ===== BLOQUE COMPARTIDO · CABECERA · … ===== -->   …   <!-- ===== FIN DEL BLOQUE COMPARTIDO · CABECERA ===== -->
<!-- ===== BLOQUE COMPARTIDO · CIERRE · … ===== -->     …   <!-- ===== FIN DEL BLOQUE COMPARTIDO · CIERRE ===== -->
<!-- ===== BLOQUE COMPARTIDO · PIE · … ===== -->        …   <!-- ===== FIN DEL BLOQUE COMPARTIDO · PIE ===== -->
```

Para cambiar el menú o el pie: se cambia en `index.html`, se copia el bloque entero a las otras cinco páginas y en cada
una se deja `aria-current="page"` en el enlace de esa página (una vez en el menú y otra en el pie; en `404.html`, en
ninguno). `node pruebas/sitio.test.js` avisa si un bloque quedó distinto en alguna página.

La cabecera trae también los íconos (el `<svg class="oculto">`): un ícono nuevo se agrega ahí.

Lo fijo de abajo en celular no es parte de esos bloques: `/planes/` lleva la barra del plan armado (`.plan-barra`) y
las demás el botón de WhatsApp (`.wa-flota`). Nunca los dos en la misma página.

## Cómo se arma el precio

Todos los precios salen del objeto `CJ_PLAN`, al inicio de `assets/js/app.js`:

- **Solo contenidos:** `porContenido` ($200.000) por cada video, carrusel o estática. De 8 a 15 al mes (Plan 8, Plan 12,
  Plan 15 y las cantidades intermedias).
- **Videos con IA:** `videoConIA` ($250.000) por cada video del plan que se haga con IA.
- **Adicionales al mes:** estrategia del mes (`estrategia`, $250.000); manejo de la primera red (`redes.porContenido`,
  $50.000 por contenido del plan) y cada red de más (`redes.adicional`, $300.000); pauta básica ($250.000) o completa
  ($1.000.000), en `pauta`.
- **Una sola vez:** Speak Pro ($800.000, 4 clases) o Speak Pro Max ($1.600.000, 8 clases), en `speak`. Son los mismos
  precios que se ven en Otros servicios y en la tarjeta del inicio.
- **Plan completo:** contenidos + estrategia del mes + una red + pauta básica. No es un precio aparte: es la suma.
- **Start Content:** `startContent.precio` ($1.200.000, pago único). No entra al cotizador: se muestra en `/planes/` y
  en la tarjeta del inicio.
- **Otros servicios** (página web, automatización, capacitación en IA, portafolio y presentaciones): no tienen precio.
  Se cotizan en el diagnóstico; en el cotizador son casillas que solo viajan en el mensaje de WhatsApp.

## Cambiar un precio

Se cambia en `CJ_PLAN` y el sitio lo toma en todas partes: inicio, menú del celular, tarjetas, planes, cotizador,
Start Content, Speak y el mensaje de WhatsApp. En el HTML, cada precio va en una etiqueta con `data-p="…"` (o
`data-plan-solo`, `data-plan-completo`), que `app.js` llena al cargar. El número escrito dentro de esa etiqueta solo se
ve si el navegador no corre JavaScript: conviene cambiarlo también. Los PDF de `portafolios/` traen los precios dentro:
si cambia un precio, hay que volver a sacarlos.

## Cómo se pasan cosas de una página a otra

- **Del calendario del inicio al cotizador:** "Armar este plan" es un enlace a `/planes/?contenidos=10#arma-tu-plan`.
  El cotizador lee `contenidos` (de 8 a 15) al cargar.
- **De Speak al cotizador:** "Sumarlo a mi plan" va a `/planes/?speak=pro#arma-tu-plan` (o `speak=promax`).
- **Referencia de campaña:** si alguien llega con `utm_campaign` o `utm_source`, el valor se guarda mientras dure la
  visita (`sessionStorage`) y los mensajes de WhatsApp de cualquier página terminan con "Ref: <valor>".
- **Direcciones de cuando el sitio era una sola página** (`/#cotizador`, `/#planes`, `/#ia`, `/#como`, `/#preguntas`…):
  un guion corto en el `<head>` de `index.html` las lleva a su página nueva. Sin JavaScript, el inicio conserva esos
  `id` junto al enlace a la página nueva.

## Imágenes y videos

- **Dónde están:** `assets/img/sitio/` (las fotos de las páginas, las cinco imágenes 3D de las tarjetas del inicio y el
  cuadro de espera de cada video), `assets/img/portadas/` (la página 1 de cada PDF) y `assets/video/` (los tres videos,
  cada uno en WebM con AV1 y en MP4 con H.264, a 720p).
- **Cómo se sacan:** con `herramientas/medios.py`, que no se publica. Recorta a la proporción de cada hueco y exporta
  AVIF, WebP y un JPEG de respaldo en 480, 800 y 1.200 px (portadas: 220, 400 y 640), cuidando el tope de peso de cada
  archivo. `python3 herramientas/medios.py --help` dice cómo. Las fuentes grandes (PNG de 2k, videos en 4K) no van en
  el repo.
- **Versión en el nombre:** todos terminan en `-v1`. `vercel.json` les pone caché de un año, así que **un archivo que
  cambia tiene que cambiar de nombre**: se sube `VERSION` en `herramientas/medios.py`, se vuelve a exportar y se cambia
  el nombre en el HTML. Si no, quien ya visitó el sitio sigue viendo el viejo.
- **Portadas de los PDF:** si un PDF se vuelve a sacar, `python3 herramientas/medios.py portadas`.
- **Pantallas con la marca:** las fotos 04, 05 y 08 traen una pantalla lisa y encima se monta una captura real con
  `herramientas/montaje.py` (el inicio del sitio en el portátil y el celular de la 05, la portada del portafolio
  general en la tableta de la 08 y un cuadro del video "nieve" en la 04). **La captura de la 05 muestra precios:** si
  cambia el precio "desde" o el titular del inicio, se rehace ese montaje. Igual la 08 si cambia la portada del PDF.
- **En el HTML:** cada imagen va en `<picture>` con su `srcset` y su `sizes`, y el `<img>` lleva `width`, `height` y
  `alt`. Dentro de un enlace (las tarjetas del inicio) el `alt` va vacío; en las demás describe lo que se ve. Ningún
  texto va encima de una foto. La imagen de la cabecera de `/planes/` solo existe desde 1000 px de ancho.
- **Videos:** `preload="none"`: lo único que se descarga al cargar es el cuadro de espera. El video se pide cuando la
  persona oprime reproducir. Sin JavaScript funcionan con los controles del navegador. El de "búnker" está cortado en
  el segundo 22,9, antes de un llamado que solo aplica en TikTok. La primera reproducción de cada uno queda medida como
  `VideoReproducido`.
- En el pie de todas las páginas dice que las imágenes y los videos están hechos con IA.

## Cambiar el WhatsApp

`CJ_PLAN.whatsapp` en `assets/js/app.js`, y los enlaces `https://wa.me/…` escritos en los HTML (son el respaldo sin
JavaScript). Hay un solo número en todo el sitio.

## Medición de Meta

Está lista y apagada, igual en todas las páginas. Se enciende poniendo el número del píxel en `CJ_CONFIG.pixelId`, al
inicio de `assets/js/app.js`. Mide la visita a cada página, la llegada al cotizador, la primera vez que alguien arma un
plan y cada clic a WhatsApp. Con el píxel apagado, esos eventos quedan en `window.dataLayer`.

## Pruebas

Están en `pruebas/` y no se publican (`.vercelignore`, que también deja por fuera `herramientas/`). Usan Playwright con Chromium: si no está instalado como módulo,
se pone su ruta en la variable `PLAYWRIGHT`. Levantan solas un servidor local desde la raíz.

```
node pruebas/cotizador.test.js   # el cotizador de /planes/ y el calendario del inicio: precios, estados, mensajes
node pruebas/sitio.test.js       # menú y pie idénticos, enlaces y anclas, direcciones viejas, referencia de campaña,
                                 # hamburguesa con teclado, sin JavaScript, desbordes de 320 a 1920 px, contraste, PDF
node pruebas/medios.test.js      # imágenes y videos: huecos con alt y medidas, formatos, pesos por página y por archivo,
                                 # que el video no se pida antes de reproducir y que reproduzca, sin JavaScript, LCP y CLS
node pruebas/capturas.js salida/ # capturas de cada página en celular y escritorio, y cuánto mide y pesa cada una
node pruebas/apoyo.js 4173       # solo el servidor, para ver el sitio en http://127.0.0.1:4173/
```

## Pendiente

En el pie hay un comentario `PENDIENTE` donde van la razón social, el NIT, la política de tratamiento de datos y los
términos. No hay página "Nosotros": queda reservada para cuando haya contenido.

El MP4 de los videos (lo que usan Safari y el iPhone) no se puede probar aquí: el navegador de las pruebas solo reproduce
el WebM. Hay que mirarlo una vez en un iPhone.
