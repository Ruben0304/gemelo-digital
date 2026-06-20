#!/usr/bin/env python3
"""Renderiza los .puml del cap2 vía el servidor PlantUML (sin Java local).
Inlina el !include _estilo_cujae.puml y codifica con el esquema de PlantUML.
Uso: python render.py [archivo.puml]  (sin args: renderiza todos)
"""
import sys, zlib, os, glob, urllib.request, ssl

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "tesis", "recursos", "figuras"))

# .puml -> nombre final de figura en la tesis
MAP = {
    "fig_casos_uso": "fig6_diagrama_casos_uso",
    "fig_actividades_generacion": "fig7_diagrama_actividades",
    "fig_arquitectura_ncapas": "fig8_arquitectura_ncapas",
    "fig_cliente_servidor": "fig9_patron_cliente_servidor",
    "fig_flujo_operativo": "fig10_diagrama_flujo_datos",
    "fig_patron_repositorio": "fig11_patron_repositorio",
    "fig_flujo_generacion": "fig12_flujo_prediccion_generacion",
    "fig_flujo_consumo": "fig13_flujo_prediccion_consumo",
    "fig_db_fisico": "fig14_db_fisico",
}

def inline_includes(text):
    out = []
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("!include"):
            inc = s.split(None, 1)[1].strip()
            p = os.path.join(HERE, inc)
            with open(p, encoding="utf-8") as f:
                out.append(inline_includes(f.read()))
        else:
            out.append(line)
    return "\n".join(out)

def _enc6(b):
    if b < 10: return chr(48 + b)
    b -= 10
    if b < 26: return chr(65 + b)
    b -= 26
    if b < 26: return chr(97 + b)
    b -= 26
    return '-' if b == 0 else ('_' if b == 1 else '?')

def _append3(b1, b2, b3):
    c1 = b1 >> 2
    c2 = ((b1 & 0x3) << 4) | (b2 >> 4)
    c3 = ((b2 & 0xF) << 2) | (b3 >> 6)
    c4 = b3 & 0x3F
    return _enc6(c1 & 0x3F) + _enc6(c2 & 0x3F) + _enc6(c3 & 0x3F) + _enc6(c4 & 0x3F)

def plantuml_encode(text):
    data = zlib.compress(text.encode("utf-8"), 9)[2:-4]  # raw deflate
    res = []
    for i in range(0, len(data), 3):
        b1 = data[i]
        b2 = data[i + 1] if i + 1 < len(data) else 0
        b3 = data[i + 2] if i + 2 < len(data) else 0
        res.append(_append3(b1, b2, b3))
    return "".join(res)

def render(puml_path):
    stem = os.path.splitext(os.path.basename(puml_path))[0]
    target = MAP.get(stem, stem)
    with open(puml_path, encoding="utf-8") as f:
        text = inline_includes(f.read())
    enc = plantuml_encode(text)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    for fmt, ext in (("png", "png"), ("svg", "svg")):
        url = f"https://www.plantuml.com/plantuml/{fmt}/{enc}"
        dst = os.path.join(OUT, f"{target}.{ext}")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
            with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
                body = r.read()
            with open(dst, "wb") as fo:
                fo.write(body)
            print(f"OK  {stem:32s} -> {target}.{ext}  ({len(body)} bytes, url {len(url)} chars)")
        except Exception as e:
            print(f"ERR {stem:32s} {fmt}: {e}")

if __name__ == "__main__":
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(HERE, "fig_*.puml")))
    os.makedirs(OUT, exist_ok=True)
    for p in files:
        render(p)
