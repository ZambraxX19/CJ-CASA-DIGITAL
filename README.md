# Página de CJ Casa Digital

Es la página de www.cjcasadigital.com. Es un sitio estático, sin paso de compilación: Vercel publica lo que haya en la
rama `main`.

## Qué hay

- `index.html`: la página.
- `assets/css/estilos.css`: el diseño. Usa la paleta y las tipografías del manual de marca.
- `assets/js/app.js`: el cotizador "Arma tu plan", el mensaje de WhatsApp y la medición.
- `assets/fonts/` y `assets/img/`: las tipografías y el logo oficial.

`portafolios/` tiene los cinco portafolios en PDF que se enlazan en el cierre de la página. Traen los precios dentro: si cambia
un precio, hay que volver a sacarlos y reemplazarlos aquí.

## Cómo se arma el precio

Todos los precios salen del objeto `CJ_PLAN`, al inicio de `assets/js/app.js`:

- **Solo contenidos:** `porContenido` ($200.000) por cada video, carrusel o estática. De 8 a 15 al mes (Plan 8, Plan 12,
  Plan 15 y las cantidades intermedias).
- **Adicionales al mes:** estrategia del mes (`estrategia`, $250.000); manejo de la primera red (`redes.porContenido`,
  $50.000 por contenido del plan: $400.000 con 8, $600.000 con 12, $750.000 con 15) y cada red de más
  (`redes.adicional`, $300.000); pauta básica ($250.000) o completa ($1.000.000), en `pauta`; avatar con IA (`avatar`:
  $1.500.000 con hasta 4 videos y $250.000 por cada video de más).
- **Una sola vez:** Speak Pro ($800.000) o Speak Pro Max ($1.600.000), en `speak`.
- **Plan completo:** contenidos + estrategia del mes + una red + pauta básica. Da $2.500.000 con 8 contenidos,
  $3.500.000 con 12 y $4.250.000 con 15. No es un precio aparte: es la suma de esas cuatro partes.

## Cambiar un precio

Se cambia en `CJ_PLAN` y la página lo toma en el inicio, las tarjetas de planes, el cotizador, el total y el mensaje de
WhatsApp. Los valores escritos en `index.html` solo se ven si el navegador no corre JavaScript: conviene cambiarlos
también.

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
