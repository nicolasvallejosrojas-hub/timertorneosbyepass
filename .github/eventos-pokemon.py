"""Eventos oficiales de Play! Pokémon (Regionales, Especiales, Internacionales y Mundial) para el calendario del panel.

Lee la lista pública de championships.pokemon.com (la misma que muestra su página de eventos próximos) y escribe
eventos-pokemon.json en la raíz del sitio: { actualizado, eventos: [ { nombre, inicio, fin, rango, tipo, region, lugar, url } ] }.
El panel (Calendario → «Eventos oficiales») deja agregar los que la tienda elija a su calendario.

· El «año» del sitio es el de la temporada (la 2027 va de septiembre de 2026 a agosto de 2027): un evento de septiembre a
  diciembre es del año anterior.
· El sitio tiene una protección contra robots: si no responde con la lista (responde otra cosa o nada), no se toca el archivo
  y la corrida avisa. No se intenta esquivar.
Uso:  python .github/eventos-pokemon.py                 (lo corre la Action «Eventos oficiales» cada lunes)
      python .github/eventos-pokemon.py --desde x.json  (con una respuesta guardada de la API)
"""
import json, re, sys, urllib.request
from datetime import date
from pathlib import Path

URL = "https://championships.pokemon.com/api/events.json?locale=es-la&status=upcoming"
SITIO = "https://championships.pokemon.com"
SALIDA = Path(__file__).resolve().parent.parent / "eventos-pokemon.json"
MESES = {m: i + 1 for i, m in enumerate(["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
                                          "septiembre", "octubre", "noviembre", "diciembre"])}


def fechas(rango, temporada):
    """«Del 4 al 6 de diciembre» / «28 y 29 de noviembre» / «Del 30 de abril al 2 de mayo» → (inicio, fin) como date."""
    t = rango.lower()
    dias = [int(n) for n in re.findall(r"\d{1,2}", t)]
    meses = [MESES[m] for m in re.findall("|".join(MESES), t)]
    if not dias or not meses:
        return None
    m1, m2 = meses[0], meses[-1]
    anio = lambda m: temporada - 1 if m >= 9 else temporada
    try:
        return date(anio(m1), m1, dias[0]), date(anio(m2), m2, dias[-1])
    except ValueError:
        return None


def tipo(item):
    n, t = (item.get("eventName_s") or "").lower(), (item.get("type_s") or "").lower()
    if "mundial" in n or "world" in t:
        return "Mundial"
    if t == "international" or "internacional" in n:
        return "Internacional"
    if "especial" in n:
        return "Especial"
    return "Regional"


def leer(items):
    sal = []
    for i in items:
        try:
            temporada = int(i.get("year_s") or 0)
        except ValueError:
            continue
        f = fechas(i.get("displayDateRange_s") or "", temporada)
        if not f or not i.get("eventName_s"):
            continue
        url = i.get("uRL_s") or ""
        sal.append({"nombre": i["eventName_s"].strip(), "inicio": f[0].isoformat(), "fin": f[1].isoformat(),
                    "rango": (i.get("displayDateRange_s") or "").strip(), "tipo": tipo(i), "region": i.get("region_s") or "",
                    "lugar": (i.get("eventLocation_s") or "").strip(), "url": SITIO + url if url.startswith("/") else url})
    return sorted(sal, key=lambda e: (e["inicio"], e["nombre"]))


def main():
    if "--desde" in sys.argv:
        datos = json.loads(Path(sys.argv[sys.argv.index("--desde") + 1]).read_text(encoding="utf-8"))
    else:
        req = urllib.request.Request(URL, headers={"User-Agent": "ByePass (byepass.cl) - calendario de eventos oficiales", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                datos = json.loads(r.read().decode("utf-8"))
        except Exception as e:   # la protección del sitio responde otra cosa (o nada): se deja el archivo anterior
            print("No se pudo leer la lista de eventos (" + str(e)[:120] + "). Se deja eventos-pokemon.json como estaba.")
            return 0
    eventos = leer(datos.get("items") or [])
    if not eventos:
        print("La lista vino vacía o sin fechas que se entiendan: se deja eventos-pokemon.json como estaba.")
        return 0
    antes = json.loads(SALIDA.read_text(encoding="utf-8")).get("eventos") if SALIDA.exists() else None
    if antes == eventos:
        print("Sin cambios: " + str(len(eventos)) + " eventos.")
        return 0
    SALIDA.write_text(json.dumps({"actualizado": date.today().isoformat(), "eventos": eventos}, ensure_ascii=False, indent=1), encoding="utf-8")
    print("eventos-pokemon.json: " + str(len(eventos)) + " eventos (" + eventos[0]["inicio"] + " a " + eventos[-1]["inicio"] + ").")
    return 0


if __name__ == "__main__":
    sys.exit(main())
