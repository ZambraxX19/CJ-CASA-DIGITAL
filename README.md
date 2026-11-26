# Página de CJ Casa Digital

Es la página de www.cjcasadigital.com. Es un sitio estático, sin paso de compilación: Vercel publica lo que haya en la
rama `main`.

## Qué hay

- `index.html`: la página.
- `assets/css/estilos.css`: el diseño. Usa la paleta y las tipografías del manual de marca.
- `assets/js/app.js`: el cotizador "Arma tu plan", el mensaje de WhatsApp y la medición.
- `assets/fonts/` y `assets/img/`: las tipografías y el logo oficial.
- `portafolios/`: los cinco portafolios en PDF que se enlazan al final de la página.

## Cambiar un precio

Todos los precios salen del objeto `CJ_PLAN`, al inicio de `assets/js/app.js`. Se cambia ahí y la página lo toma en el
inicio, las tarjetas de planes, el cotizador, el total y el mensaje de WhatsApp. Los valores escritos en `index.html`
solo se ven si el navegador no corre JavaScript: conviene cambiarlos también.

Los PDF de `portafolios/` traen los precios dentro. Si cambia un precio, hay que volver a sacarlos.

## Cambiar el WhatsApp

`CJ_PLAN.whatsapp` en `assets/js/app.js`, y los enlaces `https://wa.me/…` de `index.html`.

## Medición de Meta

Está lista y apagada. Se enciende poniendo el número del píxel en `CJ_CONFIG.pixelId`, al inicio de
`assets/js/app.js`. Mide la visita, la llegada al cotizador, la primera vez que alguien arma un plan y cada clic a
WhatsApp.

Si un enlace trae `utm_campaign` o `utm_source`, el mensaje de WhatsApp termina con "Ref: <valor>", para saber de qué
campaña llegó cada persona.

## Pendiente

En el pie de `index.html` hay un comentario `PENDIENTE` donde van la razón social, el NIT, la política de tratamiento
de datos y los términos.
