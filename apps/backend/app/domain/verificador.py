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


NO_VERIFICABLE_CAPA = "NO VERIFICABLE CON LA CAPA DISPONIBLE"
FUENTE_IGN = "IGN, Capas SIG (cursos de agua de Formosa); K3 para las estaciones"
UMBRAL_CERCA_KM = 20.0  # a esta distancia o menos, dos elementos se consideran contiguos en la capa
UMBRAL_LEJOS_KM = 30.0  # a más distancia que esta, dos cursos no se tocan


def _km(v: float | None) -> str:
    return "sin dato" if v is None else f"{v:.1f}".replace(".", ",") + " km"


def verificar_k7(estaciones: dict[str, dict], hidrografia: dict | None = None) -> list[dict]:
    """Las 7 relaciones del esquema K7.

    ``estaciones`` es ``{"formosa": {lat, lon, alerta_m, evacuacion_m}, "pilcomayo": {...}}`` (K3).
    ``hidrografia`` son las medidas sobre la capa de cursos de agua del IGN
    (``domain.hidrografia.analizar``); si es ``None`` la capa no está disponible.

    Las relaciones 3 y 6 se calculan con K3. Las relaciones 1, 2 y 5 se contrastan con la capa del
    IGN (que cubre Formosa). Las relaciones 4 y 7 involucran al río Paraná y a Corrientes, fuera de
    esa capa: el veredicto es ``NO VERIFICABLE CON LA CAPA DISPONIBLE`` y el conocimiento geográfico
    general queda solo como nota a confirmar.
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
    h = hidrografia

    def rel(n, texto, veredicto, correccion, fuente, verificado_con, categoria, cartografica=None):
        return {
            "id": f"K7-{n}",
            "relacion": texto,
            "veredicto": veredicto,
            "correccion": correccion,
            "fuente": fuente,
            "verificado_con": verificado_con,
            "categoria": categoria,
            "evidencia_cartografica": cartografica,
        }

    sin_capa = "No hay capa de cursos de agua cargada en data/geo/ para contrastarla."

    def con_capa(n, texto, veredicto, correccion, evidencia):
        return rel(
            n,
            texto,
            veredicto,
            correccion,
            FUENTE_IGN,
            "IGN cursos de agua (calculado)",
            "DOCUMENTO DE REFERENCIA",
            evidencia,
        )

    def sin_contraste(n, texto, conocimiento, motivo):
        return rel(
            n,
            texto,
            NO_VERIFICABLE_CAPA,
            f"{motivo} Conocimiento geográfico general, a confirmar con otra fuente: {conocimiento}",
            "Conocimiento geográfico general (no contrastado con datos del kit)",
            "no verificable con la capa disponible",
            "DOCUMENTO DE REFERENCIA",
        )

    texto1 = "Clorinda está junto al río Pilcomayo, cerca de su desembocadura en el Paraguay."
    conocimiento1 = "Clorinda está sobre el río Paraguay, frente a la desembocadura del Pilcomayo."
    if h and h["clorinda_a_pilcomayo_km"] is not None:
        cerca = (
            h["clorinda_a_pilcomayo_km"] <= UMBRAL_CERCA_KM
            and h["clorinda_a_paraguay_km"] <= UMBRAL_CERCA_KM
            and h["pilcomayo_a_paraguay_km"] <= UMBRAL_CERCA_KM
        )
        ev = (
            f"En la capa del IGN, Clorinda (centroide BAHRA) está a {_km(h['clorinda_a_pilcomayo_km'])} "
            f"del Pilcomayo y a {_km(h['clorinda_a_paraguay_km'])} del Paraguay; el trazo del "
            f"Pilcomayo termina a {_km(h['pilcomayo_a_paraguay_km'])} del trazo del Paraguay."
        )
        r1 = con_capa(
            1,
            texto1,
            "VERDADERA" if cerca else NO_VERIFICABLE_CAPA,
            conocimiento1
            if cerca
            else "La capa no permite confirmar la cercanía de Clorinda con ambos ríos.",
            ev,
        )
    else:
        r1 = sin_contraste(1, texto1, conocimiento1, sin_capa)

    texto2 = "El río Pilcomayo desemboca en el río Bermejo antes de alcanzar el Paraguay."
    if h:
        no_se_tocan = h["pilcomayo_a_bermejo_km"] > UMBRAL_LEJOS_KM
        llega_al_paraguay = h["pilcomayo_a_paraguay_km"] <= UMBRAL_CERCA_KM
        ev = (
            "En la capa del IGN, el Pilcomayo y el Bermejo no se tocan: están a "
            f"{_km(h['pilcomayo_a_bermejo_km'])} en su punto más cercano, mientras que el Pilcomayo "
            f"termina a {_km(h['pilcomayo_a_paraguay_km'])} del Paraguay."
        )
        if no_se_tocan and llega_al_paraguay:
            r2 = con_capa(
                2,
                texto2,
                "FALSA",
                "El Pilcomayo desemboca directamente en el Paraguay, aguas arriba de Puerto Formosa.",
                ev,
            )
        else:
            r2 = con_capa(
                2,
                texto2,
                NO_VERIFICABLE_CAPA,
                "La capa no alcanza para decidir dónde desemboca el Pilcomayo.",
                ev,
            )
    else:
        r2 = sin_contraste(
            2, texto2, "el Pilcomayo desemboca directamente en el Paraguay.", sin_capa
        )

    texto5 = "El río Bermejo entra al río Paraguay aguas arriba de Puerto Formosa."
    if h and h["bermejo_a_paraguay_km"] <= UMBRAL_CERCA_KM:
        lat_boca = h["bermejo_desembocadura_lat"]
        aguas_arriba = lat_boca > formosa["lat"]
        ev = (
            f"En la capa del IGN, el Bermejo llega al Paraguay a la latitud {lat_boca:.3f}; "
            f"Puerto Formosa (K3) está a {formosa['lat']:.3f}. El Paraguay fluye hacia el sur."
        ).replace(".", ",")
        r5 = con_capa(
            5,
            texto5,
            "VERDADERA" if aguas_arriba else "FALSA",
            "El Bermejo entra al Paraguay aguas arriba de Puerto Formosa."
            if aguas_arriba
            else "El Bermejo desemboca en el Paraguay aguas abajo de Puerto Formosa.",
            ev,
        )
    else:
        r5 = sin_contraste(
            5,
            texto5,
            "el Bermejo desemboca en el Paraguay aguas abajo de Puerto Formosa.",
            sin_capa,
        )

    return [
        r1,
        r2,
        rel(
            3,
            "Orden de las estaciones de aguas arriba a aguas abajo: Bahía Negra → Concepción → "
            "Asunción → Puerto Formosa → Puerto Pilcomayo.",
            "FALSA" if pilcomayo_arriba else "VERDADERA",
            f"Con las coordenadas de K3 (Pilcomayo {pilcomayo['lat']} y Formosa {formosa['lat']}), el "
            f"orden correcto es: {orden_real}.",
            "K3 · coordenadas de las estaciones del INA",
            "K3 (calculado)",
            "DATO OBSERVADO",
        ),
        sin_contraste(
            4,
            "El río Paraná recibe al Paraguay y continúa hasta el Río de la Plata.",
            "el Paraguay desemboca en el Paraná, que forma luego el Río de la Plata.",
            "La capa de Formosa no incluye el río Paraná.",
        ),
        r5,
        rel(
            6,
            "La escala de Puerto Pilcomayo tiene umbrales distintos de los de Puerto Formosa: "
            "alerta 5,35 m y evacuación 6,00 m.",
            "VERDADERA" if (umbrales_distintos and coincide_6) else "FALSA",
            f"K3: Puerto Pilcomayo alerta {_fmt(pilcomayo['alerta_m'])} m y evacuación "
            f"{_fmt(pilcomayo['evacuacion_m'])} m; Puerto Formosa {_fmt(formosa['alerta_m'])} m y "
            f"{_fmt(formosa['evacuacion_m'])} m.",
            "K3 · catálogo de estaciones del INA",
            "K3 (calculado)",
            "DATO OBSERVADO",
        ),
        sin_contraste(
            7,
            "El río Paraguay confluye con el Paraná aguas abajo de la ciudad de Corrientes.",
            "la confluencia está aguas arriba de la ciudad de Corrientes (cerca de Paso de la Patria).",
            "La capa de Formosa no incluye la confluencia ni la ciudad de Corrientes.",
        ),
    ]
