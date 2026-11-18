"""Verificadores de K6 y K7 contra K1 y K3 (CLAUDE.md §4.4, §8.9). Lógica pura.

La evidencia sale de los datos, no de textos fijos: el informe de IA (K6) afirma cosas que K1 y K3
permiten contrastar, y el esquema de red hidrográfica (K7) tiene relaciones que K3 permite auditar
en parte. Lo que el kit no permite verificar se declara como tal (``NO VERIFICABLE``).
"""

from __future__ import annotations

from datetime import date, timedelta

RESPALDADA = "RESPALDADA"
RESPALDADA_PROMEDIO = "RESPALDADA COMO PROMEDIO"
REFUTADA = "REFUTADA"
NO_VERIFICABLE = "NO VERIFICABLE"

FUENTE_SMN = "K9 · SMN / DNPHyCF, Boletín N.º 1 sobre El Niño (4/9/2026)"
FUENTE_NOAA = "K9 · NOAA Climate Prediction Center, discusión ENSO (8/10/2026)"
FECHA_K1 = "2026-10-31"


def _fmt(valor: float) -> str:
    return f"{valor:.2f}".replace(".", ",")


def _max_en(serie: dict[date, float], desde: date, hasta: date) -> tuple[float, date] | None:
    candidatos = [(v, d) for d, v in serie.items() if desde <= d <= hasta]
    if not candidatos:
        return None
    valor = max(v for v, _ in candidatos)
    return valor, min(d for v, d in candidatos if v == valor)


def verificar_k6(
    serie: dict[date, float],
    alerta_m: float,
    evacuacion_m: float,
    fuente_estacion: str,
    lluvias_observadas: int,
) -> list[dict]:
    """Veredicto de cada afirmación de K6 con evidencia calculada desde K1/K3.

    ``lluvias_observadas`` es la cantidad de lecturas de lluvia que NO son simuladas (el kit no
    trae ninguna, por lo que normalmente es 0).
    """
    res: list[dict] = []

    def agregar(
        n: int,
        afirmacion: str,
        veredicto: str,
        evidencia: str,
        fuente: str,
        categoria: str,
        **valores,
    ):
        res.append(
            {
                "id": f"K6-{n}",
                "afirmacion": afirmacion,
                "veredicto": veredicto,
                "evidencia": evidencia,
                "fuente": fuente,
                "categoria": categoria,
                "valores": valores,
            }
        )

    agregar(
        1,
        "El SMN confirmó El Niño el 4/9/2026 con 100 % de probabilidad para sep-nov.",
        RESPALDADA,
        "El boletín del SMN del 4/9/2026 figura en K9 con fase El Niño confirmada y 100 % para "
        "septiembre-noviembre.",
        FUENTE_SMN,
        "DOCUMENTO DE REFERENCIA",
    )
    agregar(
        2,
        "La NOAA estimó 83 % de probabilidad de El Niño fuerte o muy fuerte en oct-dic.",
        RESPALDADA,
        "La discusión ENSO de la NOAA (8/10/2026) figura en K9 con 83 % para octubre-diciembre.",
        FUENTE_NOAA,
        "DOCUMENTO DE REFERENCIA",
    )

    pico_2016 = _max_en(serie, date(2016, 1, 1), date(2016, 12, 31))
    if pico_2016:
        v, d = pico_2016
        agregar(
            3,
            "En 2016 Puerto Formosa llegó a unos 10,7 m, el máximo registrado.",
            REFUTADA if v < 10.7 else RESPALDADA,
            f"El máximo de 2016 en K1 es {_fmt(v)} m ({d.strftime('%d/%m/%Y')}), no 10,7 m. "
            "Las cifras anteriores a 2006 no tienen fuente oficial verificada.",
            "K1 · serie limpia de Puerto Formosa",
            "DATO OBSERVADO",
            maximo_2016_m=v,
            fecha=d.isoformat(),
            afirmado_m=10.7,
        )

    oct_max = _max_en(serie, date(2026, 10, 1), date(2026, 10, 31))
    if oct_max:
        v, d = oct_max
        if v >= evacuacion_m:
            conclusion = "Superó ambos umbrales."
        elif v >= alerta_m:
            conclusion = "Superó la alerta pero no la evacuación."
        else:
            conclusion = "No superó ninguno de los dos umbrales."
        agregar(
            4,
            "En octubre de 2026 el río superó el nivel de alerta y de evacuación.",
            RESPALDADA if v >= evacuacion_m else REFUTADA,
            f"El máximo de octubre de 2026 en K1 es {_fmt(v)} m ({d.strftime('%d/%m/%Y')}); "
            f"la alerta es {_fmt(alerta_m)} m y la evacuación {_fmt(evacuacion_m)} m (K3). "
            + conclusion,
            "K1 y K3",
            "DATO OBSERVADO",
            maximo_octubre_m=v,
            alerta_m=alerta_m,
            evacuacion_m=evacuacion_m,
        )

    inicio, fin = date(2026, 10, 1), date(2026, 10, 31)
    if inicio in serie and fin in serie:
        tasa = (serie[fin] - serie[inicio]) / 30
        cm = round(tasa * 100, 1)
        dias_9_81 = (9.81 - serie[fin]) / tasa if tasa > 0 else None
        agregar(
            5,
            "El río sube unos 11 cm por día desde comienzos de octubre.",
            RESPALDADA_PROMEDIO if abs(cm - 11) <= 1 else REFUTADA,
            f"({_fmt(serie[fin])} - {_fmt(serie[inicio])}) / 30 días = {str(cm).replace('.', ',')} "
            "cm/día de promedio mensual; es un promedio, no una tasa garantizada hacia adelante.",
            "K1 · serie limpia de Puerto Formosa",
            "DATO OBSERVADO",
            tasa_promedio_m_dia=round(tasa, 4),
            altura_1_oct_m=serie[inicio],
            altura_31_oct_m=serie[fin],
        )
        dias_txt = (
            ""
            if dias_9_81 is None
            else (
                f" Una extrapolación lineal a ese ritmo llegaría a 9,81 m en unos {dias_9_81:.0f} días "
                f"(hacia el {(fin + timedelta(days=round(dias_9_81))).strftime('%d/%m/%Y')}), no en enero; "
                "es ilustrativa."
            )
        )
        agregar(
            6,
            "El río superará los 9,81 m de 2016 durante enero de 2027.",
            NO_VERIFICABLE,
            "Es una extrapolación lineal. El INA no publica pronósticos a más de 15 días y el kit no "
            "trae pronóstico hidrológico." + dias_txt,
            "K9 y K1 (cálculo propio, SUPUESTO lineal)",
            "SIMULADO",
            horizonte_pronostico_oficial_dias=15,
            extrapolacion_dias=None if dias_9_81 is None else round(dias_9_81, 1),
        )

    agregar(
        7,
        "Las lluvias de octubre de 2026 fueron un 40 % superiores a lo normal.",
        NO_VERIFICABLE,
        "El kit no tiene lluvia observada (la planilla de precipitaciones está vacía)"
        + (
            "."
            if lluvias_observadas == 0
            else f"; hay {lluvias_observadas} lecturas cargadas, pero ninguna alcanza para estimar "
            "un desvío respecto de lo normal sin una serie histórica."
        ),
        "K1/K9 y base de lluvia de la plataforma",
        "DOCUMENTO DE REFERENCIA",
        lecturas_no_simuladas=lluvias_observadas,
    )

    de_prefectura = "prefectura" in fuente_estacion.casefold()
    agregar(
        8,
        "La escala de Puerto Formosa pertenece a la red de estaciones del SMN.",
        REFUTADA if de_prefectura else NO_VERIFICABLE,
        "K3 indica que es la red de escalas de la Prefectura Naval Argentina, publicada por el INA."
        if de_prefectura
        else "No se pudo contrastar la fuente de la estación en K3.",
        "K3 · catálogo de estaciones del INA",
        "DATO OBSERVADO",
        fuente_k3=fuente_estacion,
    )
    return res


def verificar_k7(estaciones: dict[str, dict]) -> list[dict]:
    """Las 7 relaciones del esquema K7.

    ``estaciones`` es ``{"formosa": {lat, lon, alerta_m, evacuacion_m}, "pilcomayo": {...}}`` (K3).
    Las relaciones 3 y 6 se calculan con K3; las demás dependen de la cartografía oficial del IGN
    (cursos de agua), que se carga en ``data/geo/``: hasta contrastarlas allí figuran como
    ``requiere_cartografia`` y el veredicto es el conocimiento geográfico general, a confirmar.
    """
    formosa, pilcomayo = estaciones["formosa"], estaciones["pilcomayo"]
    # El río Paraguay fluye hacia el sur: aguas arriba = más al norte (latitud mayor).
    pilcomayo_arriba = pilcomayo["lat"] > formosa["lat"]
    orden_real = (
        "Bahía Negra → Concepción → Asunción → Puerto Pilcomayo → Puerto Formosa"
        if pilcomayo_arriba
        else "Bahía Negra → Concepción → Asunción → Puerto Formosa → Puerto Pilcomayo"
    )
    umbrales_distintos = (
        pilcomayo["alerta_m"] != formosa["alerta_m"]
        or pilcomayo["evacuacion_m"] != formosa["evacuacion_m"]
    )
    coincide_6 = pilcomayo["alerta_m"] == 5.35 and pilcomayo["evacuacion_m"] == 6.0

    def rel(n, texto, veredicto, correccion, fuente, verificable_con_kit):
        return {
            "id": f"K7-{n}",
            "relacion": texto,
            "veredicto": veredicto,
            "correccion": correccion,
            "fuente": fuente,
            "verificado_con": "K3 (calculado)" if verificable_con_kit else "requiere_cartografia",
            "categoria": "DATO OBSERVADO" if verificable_con_kit else "DOCUMENTO DE REFERENCIA",
        }

    pend = "Pendiente de contraste con la capa de cursos de agua del IGN (data/geo/)."
    return [
        rel(
            1,
            "Clorinda está junto al río Pilcomayo, cerca de su desembocadura en el Paraguay.",
            "VERDADERA",
            "Clorinda está sobre el río Paraguay, frente a la desembocadura del Pilcomayo. " + pend,
            "Conocimiento geográfico; IGN (cursos de agua)",
            False,
        ),
        rel(
            2,
            "El río Pilcomayo desemboca en el río Bermejo antes de alcanzar el Paraguay.",
            "FALSA",
            "El Pilcomayo desemboca directamente en el Paraguay, aguas arriba de Puerto Formosa. "
            + pend,
            "Conocimiento geográfico; IGN (cursos de agua)",
            False,
        ),
        rel(
            3,
            "Orden de las estaciones de aguas arriba a aguas abajo: Bahía Negra → Concepción → "
            "Asunción → Puerto Formosa → Puerto Pilcomayo.",
            "FALSA" if pilcomayo_arriba else "VERDADERA",
            f"Con las coordenadas de K3 (Pilcomayo {pilcomayo['lat']} y Formosa {formosa['lat']}), el "
            f"orden correcto es: {orden_real}.",
            "K3 · coordenadas de las estaciones del INA",
            True,
        ),
        rel(
            4,
            "El río Paraná recibe al Paraguay y continúa hasta el Río de la Plata.",
            "VERDADERA",
            "El Paraguay desemboca en el Paraná, que forma luego el Río de la Plata. " + pend,
            "Conocimiento geográfico; IGN (cursos de agua)",
            False,
        ),
        rel(
            5,
            "El río Bermejo entra al río Paraguay aguas arriba de Puerto Formosa.",
            "FALSA",
            "El Bermejo desemboca en el Paraguay aguas abajo de Puerto Formosa. " + pend,
            "Conocimiento geográfico; IGN (cursos de agua)",
            False,
        ),
        rel(
            6,
            "La escala de Puerto Pilcomayo tiene umbrales distintos de los de Puerto Formosa: "
            "alerta 5,35 m y evacuación 6,00 m.",
            "VERDADERA" if (umbrales_distintos and coincide_6) else "FALSA",
            f"K3: Puerto Pilcomayo alerta {_fmt(pilcomayo['alerta_m'])} m y evacuación "
            f"{_fmt(pilcomayo['evacuacion_m'])} m; Puerto Formosa {_fmt(formosa['alerta_m'])} m y "
            f"{_fmt(formosa['evacuacion_m'])} m.",
            "K3 · catálogo de estaciones del INA",
            True,
        ),
        rel(
            7,
            "El río Paraguay confluye con el Paraná aguas abajo de la ciudad de Corrientes.",
            "FALSA",
            "La confluencia está aguas arriba de la ciudad de Corrientes (cerca de Paso de la Patria). "
            + pend,
            "Conocimiento geográfico; IGN (cursos de agua)",
            False,
        ),
    ]
