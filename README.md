# Sitio de CJ Casa Digital

Es el sitio de www.cjcasadigital.com. Es estático, sin paso de compilación ni dependencias: Vercel publica lo que haya
en la rama `main`.

## Páginas

| Dirección | Archivo | Qué tiene |
|---|---|---|
| `/` | `index.html` | Titular con precio, calendario que se puede tocar, los cinco atajos "¿Qué buscas?" y cómo funciona en tres pasos |
| `/planes/` | `planes/index.html` | Los tres planes, **Arma tu plan** (el cotizador), qué incluye, Start Content y las preguntas |
| `/como-funciona/` | `como-funciona/index.html` | Por qué sales tú, el proceso del mes en siete pasos y la garantía |
| `/otros-servicios/` | `otros-servicios/index.html` | IA para tu negocio (página web, automatización, capacitación, portafolio y presentaciones) y Speak |
| `/portafolios/` | `portafolios/index.html` | Los cinco PDF, cada uno con su resumen. Los PDF están en esa misma carpeta y no cambian de dirección |
| (lo que no exista) | `404.html` | Página de "no existe", con el mismo menú |

Además: `sitemap.xml` y `robots.txt` (si se agrega una página, se agrega al `sitemap.xml`), `assets/css/estilos.css`
(el diseño, con la paleta y las tipografías del manual de marca), `assets/js/app.js` (un solo archivo para todas las
páginas), `assets/fonts/` y `assets/img/`.

Todas las direcciones terminan en barra (`/planes/`). `vercel.json` solo dice eso (`"trailingSlash": true`): quien
escriba `/planes` llega a `/planes/`. Todos los enlaces y los recursos van con la ruta desde la raíz (`/assets/…`,
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

## Cambiar el WhatsApp

`CJ_PLAN.whatsapp` en `assets/js/app.js`, y los enlaces `https://wa.me/…` escritos en los HTML (son el respaldo sin
JavaScript). Hay un solo número en todo el sitio.

## Medición de Meta

Está lista y apagada, igual en todas las páginas. Se enciende poniendo el número del píxel en `CJ_CONFIG.pixelId`, al
inicio de `assets/js/app.js`. Mide la visita a cada página, la llegada al cotizador, la primera vez que alguien arma un
plan y cada clic a WhatsApp. Con el píxel apagado, esos eventos quedan en `window.dataLayer`.

## Pruebas

Están en `pruebas/` y no se publican (`.vercelignore`). Usan Playwright con Chromium: si no está instalado como módulo,
se pone su ruta en la variable `PLAYWRIGHT`. Levantan solas un servidor local desde la raíz.

```
node pruebas/cotizador.test.js   # el cotizador de /planes/ y el calendario del inicio: precios, estados, mensajes
node pruebas/sitio.test.js       # menú y pie idénticos, enlaces y anclas, direcciones viejas, referencia de campaña,
                                 # hamburguesa con teclado, sin JavaScript, desbordes de 320 a 1920 px, contraste, PDF
node pruebas/capturas.js salida/ # capturas de cada página en celular y escritorio, y cuánto mide y pesa cada una
node pruebas/apoyo.js 4173       # solo el servidor, para ver el sitio en http://127.0.0.1:4173/
```

## Pendiente

En el pie hay un comentario `PENDIENTE` donde van la razón social, el NIT, la política de tratamiento de datos y los
términos. No hay página "Nosotros": queda reservada para cuando haya contenido.
