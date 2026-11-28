#!/usr/bin/env python3
"""Saca los medios del sitio (imágenes, portadas de los PDF y videos) en los tamaños y formatos que se publican.

No se publica (.vercelignore) y no es un paso de compilación: se corre a mano cuando cambia una imagen, un PDF o un video.
Usa Pillow, pdftoppm y ffmpeg, que ya están instalados. Las fuentes grandes (PNG de 2k, videos en 4K) NO entran al repo:
se le pasan por carpeta.

    python3 herramientas/medios.py imagenes  <carpeta con las fuentes PNG>   # las del sitio, según la tabla IMAGENES
    python3 herramientas/medios.py portadas                                 # la página 1 de cada PDF de portafolios/
    python3 herramientas/medios.py videos    <carpeta con los videos>       # según la tabla VIDEOS
    python3 herramientas/medios.py una <fuente> <nombre> --proporcion 3:2 --anchos 480,800,1200 [--foco 0.5,0.5]
    python3 herramientas/medios.py pesos                                    # lista lo publicado y avisa lo que pasa del tope

Todos los archivos llevan la versión en el nombre (-v1). Vercel los guarda en caché un año (vercel.json), así que
cuando una imagen o un video cambia, se sube la versión (VERSION) y se cambia el nombre en el HTML.
"""
import argparse, pathlib, subprocess, sys, tempfile
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
VERSION = "v1"
DIR_IMG, DIR_PORTADAS, DIR_VIDEO = RAIZ / "assets/img/sitio", RAIZ / "assets/img/portadas", RAIZ / "assets/video"

# Calidad de partida y piso. Si un archivo pasa su tope, se baja de 5 en 5 hasta el piso.
CALIDAD = {"avif": (50, 40), "webp": (76, 68), "jpg": (78, 70)}
# Tope de peso por archivo, en KB, según el ancho (plan visual, 6.1). El JPEG solo es respaldo y no tiene tope propio.
TOPES = {480: {"avif": 15, "webp": 25}, 800: {"avif": 40, "webp": 60}, 1200: {"avif": 90, "webp": 150},
         220: {"avif": 10, "webp": 14}, 400: {"avif": 20, "webp": 28}, 640: {"avif": 40, "webp": 56}, 960: {"webp": 60}}
JPEG_DE_RESPALDO = {480: False, 800: True, 1200: False, 220: False, 400: True, 640: False}

# nombre de salida: (archivo fuente, proporción, anchos, foco x,y de 0 a 1 para el recorte)
IMAGENES = {
    "01-planes-cabecera": ("01-planes-cabecera.png", (16, 9), (800, 1200), (0.5, 0.5)),
    "02-estrategia":      ("02-estrategia.png", (3, 2), (480, 800, 1200), (0.5, 0.55)),
    "03-set":             ("03-set.png", (3, 2), (480, 800, 1200), (0.5, 0.5)),
    "04-edicion":         ("04-edicion.png", (3, 2), (480, 800, 1200), (0.5, 0.62)),
    "05-web":             ("05-web.png", (4, 3), (480, 800, 1200), (0.5, 0.5)),
    "06-automatizacion":  ("06-automatizacion.png", (4, 3), (480, 800, 1200), (0.5, 0.5)),
    "07-capacitacion":    ("07-capacitacion.png", (4, 3), (480, 800, 1200), (0.5, 0.5)),
    "08-portafolio":      ("08-portafolio.png", (4, 3), (480, 800, 1200), (0.5, 0.5)),
    "09-speak":           ("09-speak.png", (3, 2), (480, 800, 1200), (0.5, 0.5)),
    "tarjeta-1-contenido":     ("tarjeta-1-contenido.png", (4, 3), (480, 800, 1200), (0.5, 0.5)),
    "tarjeta-2-start-content": ("tarjeta-2-start-content.png", (4, 3), (480, 800), (0.5, 0.5)),
    "tarjeta-3-speak":         ("tarjeta-3-speak.png", (4, 3), (480, 800), (0.5, 0.5)),
    "tarjeta-4-ia-negocio":    ("tarjeta-4-ia-negocio.png", (4, 3), (480, 800), (0.5, 0.5)),
    "tarjeta-5-portafolios":   ("tarjeta-5-portafolios.png", (4, 3), (480, 800), (0.5, 0.5)),
}
PDFS = ["cj-portafolio-general", "cj-planes-de-contenido", "cj-scale-ai", "cj-speak", "cj-start-content"]
ANCHOS_PORTADA = (220, 400, 640)

# nombre: (archivo fuente, hasta qué segundo (None = entero), segundo del cuadro de espera)
VIDEOS = {
    "nieve":      ("copy_AA450D5D-EC15-4B85-AFAC-328A7AEB224E.mov", None, 2.6),
    "acantilado": ("copy_EBAAC85B-9F49-4C1A-8487-F9991A671773.mov", None, 0.6),
    # Se corta en 22,9 s: el cuadro siguiente abre la escena de "comenta IA y te explico", que es de TikTok.
    "bunker":     ("copy_E80DDF26-E811-4263-A5B9-88EDFFAE5385.mov", 22.9, 10.167),
}
TOPE_VIDEO_MB = {"webm": 2.5, "mp4": 4.0}


def kb(ruta): return ruta.stat().st_size / 1024

def recortar(im, proporcion, foco=(0.5, 0.5)):
    """Recorta a la proporción pedida, sin deformar, dejando el punto de foco lo más centrado que se pueda."""
    w, h = im.size; pw, ph = proporcion
    if w * ph > h * pw:   # sobra ancho
        nw = round(h * pw / ph); x = min(max(round(w * foco[0] - nw / 2), 0), w - nw); return im.crop((x, 0, x + nw, h))
    nh = round(w * ph / pw); y = min(max(round(h * foco[1] - nh / 2), 0), h - nh); return im.crop((0, y, w, y + nh))

def guardar(im, ruta, formato, tope_kb=None):
    """Guarda en el formato pedido; si pasa el tope, baja la calidad de 5 en 5 hasta el piso."""
    calidad, piso = CALIDAD[formato]
    while True:
        if formato == "avif": im.save(ruta, "AVIF", quality=calidad, speed=4)
        elif formato == "webp": im.save(ruta, "WEBP", quality=calidad, method=6)
        else: im.save(ruta, "JPEG", quality=calidad, progressive=True, optimize=True)
        if tope_kb is None or kb(ruta) <= tope_kb or calidad - 5 < piso: return calidad
        calidad -= 5

def exportar(im, carpeta, nombre, anchos, jpeg_en=None):
    carpeta.mkdir(parents=True, exist_ok=True)
    im = im.convert("RGB")
    for ancho in anchos:
        if ancho > im.size[0]: print(f"  OJO: {nombre} se amplía a {ancho} px (la fuente mide {im.size[0]})")
        chica = im.resize((ancho, round(ancho * im.size[1] / im.size[0])), Image.LANCZOS)
        formatos = ["avif", "webp"] + (["jpg"] if (jpeg_en or JPEG_DE_RESPALDO).get(ancho) else [])
        for formato in formatos:
            ruta = carpeta / f"{nombre}-{ancho}-{VERSION}.{formato}"
            tope = TOPES.get(ancho, {}).get(formato)
            calidad = guardar(chica, ruta, formato, tope)
            aviso = "  << PASA EL TOPE de %d KB" % tope if tope and kb(ruta) > tope else ""
            print(f"  {ruta.relative_to(RAIZ)}  {chica.size[0]}×{chica.size[1]}  {kb(ruta):.1f} KB  (calidad {calidad}){aviso}")

def imagenes(carpeta, solo=None):
    carpeta = pathlib.Path(carpeta)
    for nombre, (fuente, proporcion, anchos, foco) in IMAGENES.items():
        if solo and nombre not in solo: continue
        ruta = carpeta / fuente
        if not ruta.exists(): print(f"FALTA la fuente {ruta}"); continue
        print(nombre); exportar(recortar(Image.open(ruta), proporcion, foco), DIR_IMG, nombre, anchos)

def portadas():
    """La portada es la página 1 del PDF publicado: si un PDF se vuelve a sacar, se vuelve a correr esto."""
    with tempfile.TemporaryDirectory() as tmp:
        for pdf in PDFS:
            base = pathlib.Path(tmp) / pdf
            subprocess.run(["pdftoppm", "-f", "1", "-l", "1", "-r", "110", "-png", "-singlefile", str(RAIZ / "portafolios" / f"{pdf}.pdf"), str(base)], check=True)
            print(pdf); exportar(Image.open(f"{base}.png"), DIR_PORTADAS, pdf, ANCHOS_PORTADA)

def ffmpeg(*args): subprocess.run(["ffmpeg", "-v", "error", "-y", *map(str, args)], check=True)

def video(fuente, nombre, hasta=None, cuadro=1.0):
    """720p a 30 cuadros: AV1 en WebM (primera fuente) y H.264 en MP4 (Safari y iPhone). Un cuadro clave cada 2 s.
    Si se corta, cierra con un fundido corto de imagen y de sonido. El cuadro de espera va a assets/img/sitio/."""
    DIR_VIDEO.mkdir(parents=True, exist_ok=True); DIR_IMG.mkdir(parents=True, exist_ok=True)
    escala = "fps=30,scale=1280:720:force_original_aspect_ratio=increase:flags=lanczos,crop=1280:720,format=yuv420p"
    corte, vf, af = [], escala, "anull"
    if hasta:
        corte = ["-t", f"{hasta:.3f}"]
        vf += f",fade=t=out:st={hasta - 0.3:.3f}:d=0.3"; af = f"afade=t=out:st={hasta - 0.4:.3f}:d=0.4"
    webm, mp4 = DIR_VIDEO / f"cj-{nombre}-720-{VERSION}.webm", DIR_VIDEO / f"cj-{nombre}-720-{VERSION}.mp4"
    ffmpeg("-i", fuente, *corte, "-vf", vf, "-af", af, "-c:v", "libsvtav1", "-preset", "6", "-crf", "42", "-g", "60",
           "-svtav1-params", "tune=0", "-c:a", "libopus", "-b:a", "64k", "-ac", "2", "-map_metadata", "-1", webm)
    ffmpeg("-i", fuente, *corte, "-vf", vf, "-af", af, "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-maxrate", "1100k",
           "-bufsize", "2200k", "-profile:v", "high", "-g", "60", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "96k", "-ac", "2",
           "-map_metadata", "-1", mp4)
    with tempfile.TemporaryDirectory() as tmp:
        png = pathlib.Path(tmp) / "cuadro.png"
        ffmpeg("-ss", f"{cuadro:.3f}", "-i", fuente, "-frames:v", "1", "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080", png)
        print(f"cuadro de espera de {nombre} (segundo {cuadro})")
        im = Image.open(png).convert("RGB").resize((960, 540), Image.LANCZOS)
        ruta = DIR_IMG / f"video-{nombre}-960-{VERSION}.webp"; guardar(im, ruta, "webp", TOPES[960]["webp"])   # el atributo poster solo admite un archivo
        print(f"  {ruta.relative_to(RAIZ)}  {kb(ruta):.1f} KB")
    for ruta in (webm, mp4):
        mb = ruta.stat().st_size / 1048576; tope = TOPE_VIDEO_MB[ruta.suffix[1:]]
        dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(ruta)], capture_output=True, text=True).stdout.strip()
        print(f"  {ruta.relative_to(RAIZ)}  {mb:.2f} MB  {float(dur):.2f} s" + ("  << PASA EL TOPE de %.1f MB" % tope if mb > tope else ""))

def videos(carpeta, solo=None):
    for nombre, (fuente, hasta, cuadro) in VIDEOS.items():
        if solo and nombre not in solo: continue
        ruta = pathlib.Path(carpeta) / fuente
        if not ruta.exists(): print(f"FALTA la fuente {ruta}"); continue
        print(nombre); video(ruta, nombre, hasta, cuadro)

def pesos():
    malos = 0
    for carpeta in (DIR_IMG, DIR_PORTADAS, DIR_VIDEO):
        total = 0
        for ruta in sorted(carpeta.glob("*")):
            total += ruta.stat().st_size; partes = ruta.stem.split("-")
            tope = None
            if ruta.suffix in (".webm", ".mp4"): tope = TOPE_VIDEO_MB[ruta.suffix[1:]] * 1024
            elif len(partes) > 2 and partes[-2].isdigit(): tope = TOPES.get(int(partes[-2]), {}).get(ruta.suffix[1:])
            if tope and kb(ruta) > tope: malos += 1; print(f"PASA EL TOPE ({tope:.0f} KB): {ruta.relative_to(RAIZ)}  {kb(ruta):.1f} KB")
        print(f"{carpeta.relative_to(RAIZ)}: {len(list(carpeta.glob('*')))} archivos, {total / 1048576:.2f} MB")
    return malos

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="orden", required=True)
    a = sub.add_parser("imagenes"); a.add_argument("carpeta"); a.add_argument("--solo", nargs="*")
    sub.add_parser("portadas")
    a = sub.add_parser("videos"); a.add_argument("carpeta"); a.add_argument("--solo", nargs="*")
    a = sub.add_parser("una"); a.add_argument("fuente"); a.add_argument("nombre"); a.add_argument("--proporcion", default="4:3")
    a.add_argument("--anchos", default="480,800,1200"); a.add_argument("--foco", default="0.5,0.5")
    sub.add_parser("pesos")
    o = p.parse_args()
    if o.orden == "imagenes": imagenes(o.carpeta, o.solo)
    elif o.orden == "portadas": portadas()
    elif o.orden == "videos": videos(o.carpeta, o.solo)
    elif o.orden == "una":
        exportar(recortar(Image.open(o.fuente), tuple(map(int, o.proporcion.split(":"))), tuple(map(float, o.foco.split(",")))), DIR_IMG, o.nombre, tuple(map(int, o.anchos.split(","))))
    elif o.orden == "pesos": sys.exit(1 if pesos() else 0)
