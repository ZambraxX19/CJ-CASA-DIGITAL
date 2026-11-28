#!/usr/bin/env python3
"""Monta una captura REAL (del sitio, de la portada de un PDF o de un cuadro de un video de CJ) sobre una pantalla
que viene encendida y lisa (verde muy oscuro) en una foto. No inventa nada: solo deforma la captura en perspectiva
al cuadrilátero de la pantalla y la funde con el brillo y el grano de la foto.

    python3 herramientas/montaje.py <foto.png> <salida.png> --pantalla x0,y0,x1,y1=captura.png [--pantalla …] [--control carpeta]

`x0,y0,x1,y1` es la zona de la foto donde está la pantalla (holgada); adentro se busca el cuadrilátero exacto.
Con --control deja, por pantalla, la pantalla ya montada vuelta a enderezar al lado de la captura original, al 100 %.
No se publica (.vercelignore). Usa OpenCV y Pillow.
"""
import argparse, pathlib, sys
import cv2, numpy as np


def mascara_pantalla(foto, zona):
    """La pantalla encendida es verde muy oscuro (el verde gana al rojo y al azul); el marco del aparato tira a azul o gris."""
    x0, y0, x1, y1 = zona
    b, g, r = [foto[y0:y1, x0:x1, i].astype(np.int16) for i in range(3)]
    m = ((g - r >= 12) & (g - b >= 3) & (g < 80) & (r < 30)).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))   # poco: un mueble oscuro detrás no se debe pegar a la pantalla
    m = cv2.medianBlur(m, 5)   # borde parejo, sin dientes
    n, etiquetas, datos, _ = cv2.connectedComponentsWithStats(m)
    if n < 2: return None
    mayor = int(etiquetas[(y1 - y0) // 2, (x1 - x0) // 2])   # la pantalla es lo que hay en el centro de la zona
    if mayor == 0: return None
    llena = np.zeros(foto.shape[:2], np.uint8)
    llena[y0:y1, x0:x1][etiquetas == mayor] = 255
    return llena


def cuadrilatero(mascara):
    """Las cuatro esquinas de la pantalla: se ajusta una recta a cada lado (con los puntos del tramo central,
    para que las esquinas redondas no la tuerzan) y se cruzan. Orden: arriba-izq, arriba-der, abajo-der, abajo-izq."""
    contorno = max(cv2.findContours(mascara, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], key=cv2.contourArea)
    casco = cv2.convexHull(contorno)
    # Primera aproximación: los puntos del casco más hacia cada diagonal (sirve para pantallas casi derechas)
    pts = casco.reshape(-1, 2).astype(np.float32); suma, resta = pts[:, 0] + pts[:, 1], pts[:, 0] - pts[:, 1]
    esquinas = np.array([pts[np.argmin(suma)], pts[np.argmax(resta)], pts[np.argmax(suma)], pts[np.argmin(resta)]], np.float32)
    # Se mide sobre el casco convexo, punto a punto: así la muesca de un celular no tuerce el lado de arriba
    lleno = np.zeros_like(mascara); cv2.drawContours(lleno, [casco], -1, 255, -1)
    todo = max(cv2.findContours(lleno, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], key=cv2.contourArea).reshape(-1, 2).astype(np.float32)
    def cruce(r1, r2):
        (p1, d1), (p2, d2) = r1, r2
        t = np.linalg.solve(np.array([d1, -d2]).T, p2 - p1)[0]; return p1 + d1 * t
    for holgura in (0.10, 0.05, 0.03):   # tres pasadas, cada una más estricta, partiendo de las esquinas de la anterior
        rectas = []
        for i in range(4):
            a, b = esquinas[i], esquinas[(i + 1) % 4]; d = b - a; largo = np.linalg.norm(d); d /= largo
            t = (todo - a) @ d; dist = np.abs((todo - a) @ np.array([-d[1], d[0]]))
            cerca = todo[(t > 0.22 * largo) & (t < 0.78 * largo) & (dist < holgura * largo + 4)]
            if len(cerca) < 8: raise ValueError("no encontré un lado de la pantalla")
            vx, vy, px, py = cv2.fitLine(cerca, cv2.DIST_HUBER, 0, 0.01, 0.01).ravel()
            rectas.append((np.array([px, py]), np.array([vx, vy])))
        esquinas = np.array([cruce(rectas[3], rectas[0]), cruce(rectas[0], rectas[1]), cruce(rectas[1], rectas[2]), cruce(rectas[2], rectas[3])], np.float32)
    return esquinas


def encajar(captura, proporcion):
    """Lleva la captura a la proporción de la pantalla sin deformarla: recorta lo que sobra (desde arriba y al centro)
    si la diferencia es poca; si es mucha, la centra y rellena con el color de su borde."""
    h, w = captura.shape[:2]; actual = w / h
    if abs(actual / proporcion - 1) < 0.12:
        if actual > proporcion: nw = round(h * proporcion); x = (w - nw) // 2; return captura[:, x:x + nw]
        return captura[:round(w / proporcion)]
    borde = np.median(np.concatenate([captura[0], captura[-1], captura[:, 0], captura[:, -1]]), axis=0)
    if actual < proporcion:
        nw = round(h * proporcion); lienzo = np.full((h, nw, 3), borde, np.uint8); x = (nw - w) // 2; lienzo[:, x:x + w] = captura
    else:
        nh = round(w / proporcion); lienzo = np.full((nh, w, 3), borde, np.uint8); y = (nh - h) // 2; lienzo[y:y + h] = captura
    return lienzo


def montar(foto, zona, captura, control=None, nombre="pantalla"):
    mascara = mascara_pantalla(foto, zona)
    if mascara is None: raise ValueError("no encontré la pantalla en la zona")
    q = cuadrilatero(mascara)
    ancho = (np.linalg.norm(q[1] - q[0]) + np.linalg.norm(q[2] - q[3])) / 2
    alto = (np.linalg.norm(q[3] - q[0]) + np.linalg.norm(q[2] - q[1])) / 2
    cap = encajar(captura, ancho / alto)
    # Primero se reduce con cuidado a unas 2 veces el tamaño de la pantalla y después se deforma: así el texto no se rompe
    tw, th = int(round(ancho * 2)), int(round(alto * 2))
    cap2 = cv2.resize(cap, (tw, th), interpolation=cv2.INTER_AREA if cap.shape[1] > tw else cv2.INTER_CUBIC)
    H = cv2.getPerspectiveTransform(np.float32([[0, 0], [tw, 0], [tw, th], [0, th]]), q)
    puesta = cv2.warpPerspective(cap2, H, (foto.shape[1], foto.shape[0]), flags=cv2.INTER_AREA).astype(np.float32)

    original = foto.astype(np.float32)
    dentro = cv2.erode(mascara, np.ones((3, 3), np.uint8)) > 0
    base = np.median(original[dentro], axis=0)
    # Lo que la foto trae sobre el vidrio (reflejo, viñeta): la variación suave de brillo de la pantalla lisa
    suave = cv2.GaussianBlur(original, (0, 0), 14) - base
    # El grano de la foto, medido en la misma pantalla
    grano = float(np.std((original - cv2.GaussianBlur(original, (0, 0), 2))[dentro]))
    rng = np.random.default_rng(7)
    ruido = cv2.GaussianBlur(rng.normal(0, 1, foto.shape[:2]).astype(np.float32), (0, 0), 0.7); ruido *= grano / max(float(ruido.std()), 1e-6)
    puesta = cv2.GaussianBlur(puesta, (0, 0), 0.45) + suave * 0.9 + ruido[..., None]
    # Borde suave, por dentro de la máscara real (respeta las esquinas redondas y la muesca del celular)
    alfa = cv2.GaussianBlur(cv2.erode(mascara, np.ones((3, 3), np.uint8)).astype(np.float32) / 255, (0, 0), 1.1)[..., None]
    salida = np.clip(original * (1 - alfa) + puesta * alfa, 0, 255).astype(np.uint8)

    if control:
        # La pantalla montada, vuelta a enderezar, junto a la captura tal como se montó (misma escala): se comparan al 100 %
        cw, ch = int(round(ancho)), int(round(alto))
        Hinv = cv2.getPerspectiveTransform(q, np.float32([[0, 0], [cw, 0], [cw, ch], [0, ch]]))
        enderezada = cv2.warpPerspective(salida, Hinv, (cw, ch), flags=cv2.INTER_CUBIC)
        ref = cv2.resize(cap, (cw, ch), interpolation=cv2.INTER_AREA)
        g1, g2 = [cv2.cvtColor(x, cv2.COLOR_BGR2GRAY).astype(np.float32) for x in (enderezada, ref)]
        m = 6; a, b = g1[m:-m, m:-m], g2[m:-m, m:-m]
        corr = float(np.corrcoef(a.ravel(), b.ravel())[0, 1])
        pathlib.Path(control).mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(pathlib.Path(control) / f"{nombre}-control.png"), np.hstack([enderezada, np.full((ch, 12, 3), 255, np.uint8), ref]))
        x0, y0, x1, y1 = zona
        cv2.imwrite(str(pathlib.Path(control) / f"{nombre}-en-la-foto.png"), salida[y0:y1, x0:x1])
        print(f"  {nombre}: esquinas {q.round(1).tolist()} · {cw}×{ch} px · proporción {ancho / alto:.3f} · parecido con la captura {corr:.3f} · grano {grano:.2f}")
    return salida


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("foto"); p.add_argument("salida"); p.add_argument("--pantalla", action="append", required=True); p.add_argument("--control")
    o = p.parse_args()
    foto = cv2.imread(o.foto)
    for k, par in enumerate(o.pantalla, 1):
        zona, captura = par.split("=", 1)
        try: foto = montar(foto, tuple(map(int, zona.split(","))), cv2.imread(captura), o.control, pathlib.Path(o.salida).stem + f"-{k}")
        except Exception as e: print(f"  NO SE MONTÓ la pantalla {k} ({e}): queda lisa");
    cv2.imwrite(o.salida, foto)
