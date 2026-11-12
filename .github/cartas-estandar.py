# -*- coding: utf-8 -*-
"""
Cartas legales en Estándar, desde Limitless (limitlesstcg.com)
==============================================================

Arma cartas-estandar.json (en la raíz del sitio), la base con la que la inscripción
revisa las listas de mazo, el armador busca cartas y la hoja impresa llena la columna Reg.

SE CORRE SOLO: .github/workflows/cartas.yml lo corre cada lunes en GitHub (y a mano con
«Run workflow» en la pestaña Actions del repositorio) y publica la base si cambió. A mano,
desde la carpeta del proyecto: python cartas-estandar.py (el atajo de files/ llama a este).

    python cartas-estandar.py

Tarda unos 3 minutos: pide una página por segundo, a propósito.

De dónde sale cada dato:
  - La búsqueda «format:standard» de Limitless da expansión, número, nombre y
    tipo de cada carta legal (50 por página).
  - La marca de regulación NO viene en esa lista, solo en la ficha de cada
    carta. En vez de pedir 3.400 fichas, se busca por marca («reg:H», «reg:I»…)
    y se cruza: lo que sale en «reg:J» tiene marca J. Las Energías básicas no
    llevan marca.
  - La sexta columna marca «B» los Pokémon Básicos (sale del tipo) y «A» las
    ACE SPEC (búsqueda «is:ace»): con eso la inscripción revisa que haya al
    menos un Básico y como mucho una ACE SPEC.
  - Ojo: Limitless lista solo las impresiones con marca legal. Un Entrenador
    viejo reimpreso en una expansión legal (el Ultra Ball de SVI, marca G)
    también se puede jugar, con «NA» en la expansión. Esas impresiones van en
    una lista aparte, «reimp» (set, número, nombre, categoría y su marca), que
    se arma con:

        python cartas-estandar.py --reimpresiones

    Parte de la base ya armada (no la vuelve a bajar): por cada Entrenador legal
    pide todas sus impresiones («!"Nombre"») y deja las que no son legales hoy.
    Tarda unos 6 minutos. Hay que correrlo después de cada corrida normal, que
    deja la base sin esa lista. Los Pokémon no entran: una reimpresión de
    Pokémon se revisa por nombre en la inscripción.

Las fotos de las cartas (las pide el navegador a TCGdex; aquí no se guarda ninguna):

        python cartas-estandar.py --imagenes

    agrega la tabla «imagenes» (código de expansión → ruta en TCGdex). Va al final, después de la corrida normal
    y de --reimpresiones, que rehacen el JSON sin ella. Tarda ~1 minuto.

Los nombres en castellano (para buscar y pegar listas en español):

        python cartas-estandar.py --espanol

    agrega la tabla «es» (impresión → nombre en castellano) desde TCGdex. Va después de --imagenes.

Orden completo al salir una expansión: normal → --reimpresiones → --imagenes → --espanol.

"""
import html, json, re, sys, time, urllib.parse, urllib.request
from datetime import date
from pathlib import Path

BASE = "https://limitlesstcg.com/cards?display=list&q="
MARCAS = "HIJKLM"            # las que se prueban; las que no tienen cartas se ignoran
PAUSA = 1.0
MARCAS_VIEJAS = "DEFG"    # marcas ya rotadas: sirven para etiquetar las reimpresiones
SALIDA = Path(__file__).resolve().parent.parent / "cartas-estandar.json"   # este archivo vive en <sitio>/.github/

def pagina(q, n):
    url = BASE + urllib.parse.quote(q) + "&page=" + str(n)
    req = urllib.request.Request(url, headers={"User-Agent": "ByePass (byepass.cl) - lista de cartas para inscripciones"})
    for intento in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            print("  reintento", intento + 1, e, file=sys.stderr); time.sleep(5)
    raise SystemExit("No se pudo leer " + url)

texto = lambda s: " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s)).split())

def buscar(q):
    """Todas las cartas de una búsqueda: [(set, num, nombre, tipo)]."""
    out, n, total = [], 1, None
    while True:
        t = pagina(q, n)
        if total is None:
            m = re.search(r'class="pagination" data-current="\d+" data-max="(\d+)"', t)
            total = int(m.group(1)) if m else 1
        for fila in re.findall(r"<tr data-hover.*?</tr>", t, re.S):
            c = [texto(x) for x in re.findall(r"<td[^>]*>(.*?)</td>", fila, re.S)]
            if len(c) >= 4: out.append((c[0], c[1], c[2], c[3]))
        print(f"  {q}: página {n}/{total}", file=sys.stderr)
        if n >= total: return out
        n += 1; time.sleep(PAUSA)

def categoria(tipo):
    t = tipo.lower()
    if "energy" in t: return "E"
    if any(k in t for k in ("item", "supporter", "stadium", "tool", "technical machine")): return "T"
    return "P"

if "--imagenes" in sys.argv:
    # Las fotos de las cartas no se guardan: el navegador las pide a TCGdex (https://assets.tcgdex.net/en/<serie>/<set>/<número>).
    # Acá solo se arma la tabla código de expansión → ruta, más con cuántas cifras van los números en esa expansión
    # (sv01 usa «001»; algunas viejas, «1»). Una pasada por la lista de expansiones de TCGdex, ~1 minuto.
    datos = json.loads(SALIDA.read_text(encoding="utf-8"))
    codigos = {c[0] for c in datos["cartas"]} | {c[0] for c in datos.get("reimp", [])}
    def tcgdex(ruta):
        req = urllib.request.Request("https://api.tcgdex.net/v2/en/" + ruta, headers={"User-Agent": "ByePass (byepass.cl) - fotos de cartas en el buscador"})
        for intento in range(3):
            try:
                with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read().decode("utf-8"))
            except Exception as e:
                print("  reintento", intento + 1, ruta, e, file=sys.stderr); time.sleep(3)
        return None
    imagenes = {}
    for s in tcgdex("sets") or []:
        time.sleep(0.25)
        d = tcgdex("sets/" + s["id"])
        cod = ((d or {}).get("abbreviation") or {}).get("official")
        if not d or cod not in codigos or cod in imagenes or not d.get("cards"): continue
        if not any(c.get("image") for c in d["cards"]): continue          # expansión sin fotos en TCGdex
        largos = {len(c["localId"]) for c in d["cards"] if str(c.get("localId", "")).isdigit()}
        cifras = next(iter(largos)) if len(largos) == 1 else 0          # todos los números con las mismas cifras: se rellenan con ceros
        imagenes[cod] = d["serie"]["id"] + "/" + d["id"] + ("|" + str(cifras) if cifras > 1 else "")
        print("  " + cod + " → " + imagenes[cod], file=sys.stderr)
    datos["imagenes"] = dict(sorted(imagenes.items()))
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(imagenes)} de {len(codigos)} expansiones con fotos · faltan: {' '.join(sorted(codigos - set(imagenes)))}")
    raise SystemExit

if "--comparar" in sys.argv:
    # Para la corrida automática: compara la base recién armada con la publicada (la ruta que sigue a --comparar).
    # Sale con 0 si no cambió nada (sin contar la fecha), 1 si cambió (e imprime el mensaje del commit) y 2 si la
    # nueva se ve incompleta (Limitless o TCGdex caídos a medias): esa no se publica y la corrida queda en rojo.
    # El margen es amplio (la mitad) porque la rotación de abril saca de una vez muchas cartas legítimamente.
    viejo = json.loads(Path(sys.argv[sys.argv.index("--comparar") + 1]).read_text(encoding="utf-8"))
    nuevo = json.loads(SALIDA.read_text(encoding="utf-8"))
    sin_fecha = lambda d: {k: v for k, v in d.items() if k != "actualizado"}
    if sin_fecha(viejo) == sin_fecha(nuevo):
        print("sin cambios"); raise SystemExit(0)
    bajaron = [k for k in ("cartas", "imagenes", "es") if len(nuevo.get(k) or []) < len(viejo.get(k) or []) / 2]
    if bajaron:
        print("La base nueva se ve incompleta (bajaron a menos de la mitad: " + ", ".join(bajaron) + "): no se publica.")
        raise SystemExit(2)
    sets = lambda d: {c[0] for c in d["cartas"]}
    entran, salen = sorted(sets(nuevo) - sets(viejo)), sorted(sets(viejo) - sets(nuevo))
    fotos = sorted(set(nuevo.get("imagenes", {})) - set(viejo.get("imagenes", {})))
    partes = [f"{len(nuevo['cartas'])} cartas"] + (["entran " + " ".join(entran)] if entran else []) +              (["salen " + " ".join(salen)] if salen else []) + (["fotos de " + " ".join(fotos)] if fotos else [])
    print("Base de cartas al " + nuevo["actualizado"] + ": " + ", ".join(partes))
    raise SystemExit(1)

if "--espanol" in sys.argv:
    # Los nombres en castellano, para buscar y armar la lista en español: tabla «es» («SVI 196» → «Ultra Ball»), solo de las
    # cartas cuyo nombre cambia. Salen de TCGdex (/v2/es/sets/<id>), usando las rutas de «imagenes»: va después de --imagenes.
    # Una expansión que TCGdex todavía no tiene en castellano queda solo en inglés. ~1 minuto.
    datos = json.loads(SALIDA.read_text(encoding="utf-8"))
    ingles = {(c[0], c[1].lstrip("0") or "0"): c[2] for c in datos["cartas"] + datos.get("reimp", [])}
    def tcgdex_es(ruta):
        req = urllib.request.Request("https://api.tcgdex.net/v2/es/" + ruta, headers={"User-Agent": "ByePass (byepass.cl) - nombres de cartas en castellano"})
        for intento in range(3):
            try:
                with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read().decode("utf-8"))
            except Exception as e:
                print("  reintento", intento + 1, ruta, e, file=sys.stderr); time.sleep(3)
        return None
    es, sin = {}, []
    for cod, ruta in sorted(datos.get("imagenes", {}).items()):
        time.sleep(0.25)
        d = tcgdex_es("sets/" + ruta.split("|")[0].split("/")[-1])
        if not d or not d.get("cards"): sin.append(cod); continue
        for c in d["cards"]:
            n = str(c.get("localId", "")).lstrip("0") or "0"
            en, nom = ingles.get((cod, n)), (c.get("name") or "").strip()
            if en and nom and nom != en: es[cod + " " + n] = nom
    datos["es"] = dict(sorted(es.items()))
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(es)} nombres en castellano · expansiones sin castellano en TCGdex: {' '.join(sin) or 'ninguna'}")
    raise SystemExit

if "--reimpresiones" in sys.argv:
    datos = json.loads(SALIDA.read_text(encoding="utf-8"))
    legales = {(c[0], c[1]) for c in datos["cartas"]}
    nombres = sorted({c[2] for c in datos["cartas"] if c[3] == "T"})
    # Marca de las impresiones viejas: se buscan por marca, sin filtro de formato.
    viejas = {}
    for m in MARCAS_VIEJAS:
        time.sleep(PAUSA)
        for s, n, _, _ in buscar("reg:" + m):
            viejas[(s, n)] = m
    reimp = set()
    for i, nom in enumerate(nombres, 1):
        time.sleep(PAUSA)
        for s, n, nm, tipo in buscar('!"' + nom + '"'):
            if (s, n) not in legales and nm == nom and categoria(tipo) == "T":
                reimp.add((s, n, nm, "T", viejas.get((s, n), "")))
        print(f"  {i}/{len(nombres)} {nom}", file=sys.stderr)
    datos["reimp"] = [list(f) for f in sorted(reimp)]
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(reimp)} impresiones viejas de {len(nombres)} Entrenadores · "
          f"con marca: {sum(1 for f in reimp if f[4])} · guardado en", SALIDA, f"({SALIDA.stat().st_size // 1024} KB)")
    raise SystemExit

# La expansión más nueva según Limitless (la primera de su lista): Herramientas la muestra junto a la fecha de la base.
def ultima():
    try:
        req = urllib.request.Request("https://limitlesstcg.com/cards", headers={"User-Agent": "ByePass (byepass.cl) - lista de cartas para inscripciones"})
        with urllib.request.urlopen(req, timeout=30) as r: t = r.read().decode("utf-8", "replace")
        m = re.search(r'<a href="/cards/([A-Z0-9-]+)"><img[^>]*>\s*([^<]+?)\s*<span class="code annotation">[^<]*</span></a></td>\s*<td><a[^>]*>([^<]+)</a>', t)
        from datetime import datetime
        return {"codigo": m.group(1), "nombre": html.unescape(m.group(2)), "fecha": datetime.strptime(m.group(3).strip(), "%d %b %y").date().isoformat()}
    except Exception as e:
        print("  no se pudo leer la última expansión:", e, file=sys.stderr); return None

cartas = buscar("format:standard")
marca = {}
for m in MARCAS:
    time.sleep(PAUSA)
    for s, n, _, _ in buscar("format:standard reg:" + m):
        marca[(s, n)] = m

time.sleep(PAUSA)
ace = {(s, n) for s, n, _, _ in buscar("format:standard is:ace")}
def extra(s, n, tipo):
    if (s, n) in ace: return "A"
    return "B" if categoria(tipo) == "P" and re.search(r"\bBasic\b", tipo) else ""
filas = sorted({(s, n, nom, categoria(tipo), marca.get((s, n), ""), extra(s, n, tipo)) for s, n, nom, tipo in cartas})
datos = {
    "actualizado": date.today().isoformat(),
    "fuente": "limitlesstcg.com (format:standard)",
    "marcas": sorted(set(marca.values())),
    "columnas": ["set", "num", "nombre", "cat", "reg", "x"],   # x: B = Pokémon Básico, A = ACE SPEC
    "cartas": [list(f) for f in filas],
}
u = ultima()
if u: datos["ultima"] = u
SALIDA.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

# Control: que cuadren los números antes de dar la base por buena.
sin = [f for f in filas if not f[4]]
print(f"{len(filas)} cartas · marcas {datos['marcas']} · sin marca: {len(sin)} "
      f"({', '.join(sorted({f[2] for f in sin})[:8])}{'…' if len(sin) > 8 else ''})")
print("por categoría:", {c: sum(1 for f in filas if f[3] == c) for c in "PTE"},
      "· Básicos:", sum(1 for f in filas if f[5] == "B"), "· ACE SPEC:", sum(1 for f in filas if f[5] == "A"))
print("guardado en", SALIDA, f"({SALIDA.stat().st_size // 1024} KB)")
