"""Correcciones del motor y la API (auditoría 19/11): ruteo con cierres, vocabulario pecuario,
idempotencia, concurrencia, canales por mensaje y cuadrillas balanceadas."""

import json
import os
import uuid
from datetime import timedelta

from sqlalchemy import func, select, text, update

from app.api.v1.canales import firmar
from app.core.eventos import Difusor
from app.db.base import ahora
from app.db.modelos import Cuadrilla, SolicitudAsistencia, Tarea
from app.domain import ganaderia, parser_mensajes
from app.ingest import red_vial
from app.servicios import recomendacion
from app.servicios import ruteo as srv
from tests.conftest import datos_ciudadano
from tests.test_operacion import S4, _usuario_nuevo

SECRETO = os.environ["CANAL_HMAC_SECRET"]
FUNDAMENTO = "Compromiso previsto de S4 antes de la alerta de Puerto Formosa."


# ------------------------------------------------ ruteo: el cierre de un acceso corta la red


def _linea(coords, superficie, nombre):
    return {
        "type": "Feature",
        "properties": {"nombre": nombre, "superficie": superficie},
        "geometry": {"type": "LineString", "coordinates": coords},
    }


def test_cerrar_un_acceso_cambia_la_ruta_por_pgrouting(db):
    fila = db.execute(
        text(
            "SELECT id, ST_AsGeoJSON(geom) FROM accesos WHERE sector_id='S2' AND superficie='pavimento' "
            "ORDER BY id LIMIT 1"
        )
    ).first()
    acceso_id, geo = fila[0], json.loads(fila[1])["coordinates"]
    ini, fin = geo[0], geo[-1]
    lejos = [(ini[0] + fin[0]) / 2 + 0.02, (ini[1] + fin[1]) / 2 + 0.02]  # rodeo a >2 km
    red_vial.cargar_red(
        db,
        [
            _linea([ini, *geo[1:-1], fin], "pavimento", "directa"),
            _linea([ini, lejos], "pavimento", "rodeo-1"),
            _linea([lejos, fin], "pavimento", "rodeo-2"),
        ],
        "SIMULADO · red sintética de pruebas",
        categoria="SIMULADO",
    )
    try:
        libre = srv.resolver_ruta(db, "vehicular", tuple(ini), tuple(fin))
        assert libre["metodo"] == "pgrouting"
        assert {t["nombre"] for t in libre["tramos"]} == {"directa"}
        cerrada = srv.resolver_ruta(
            db, "vehicular", tuple(ini), tuple(fin), caminos_cerrados={acceso_id}
        )
        assert cerrada["metodo"] == "pgrouting" and acceso_id in cerrada["accesos_bloqueados"]
        assert {t["nombre"] for t in cerrada["tramos"]} == {"rodeo-1", "rodeo-2"}
        assert cerrada["distancia_m"] > libre["distancia_m"]
    finally:
        db.execute(text("DELETE FROM red_vial"))
        db.execute(text("DELETE FROM red_vial_nodos"))
        db.commit()


def test_ruteo_usa_la_lluvia_aunque_no_haya_altura(db):
    r = srv.resolver_ruta(db, "vehicular", (-58.139, -26.18), (-58.18, -26.185), lluvia_mm=200)
    assert r["accesos_bloqueados"], "con 200 mm los accesos de tierra y ripio quedan intransitables"


# ------------------------------------------------ vocabulario pecuario


def test_alias_y_plurales_de_especies_y_categorias():
    esp = ganaderia.especie_canonica
    assert [esp(x) for x in ("Vacas", "bovinos", "OVEJAS", "cabras", "cerdos", "colmenas", "apicultura", "caballos")] == [
        "bovino", "bovino", "ovino", "caprino", "porcino", "apicultura", "apicultura", "equino",
    ]  # fmt: skip
    assert esp("dinosaurios") is None
    cat = ganaderia.categoria_canonica
    assert cat("Vacas con crías") == "vaca_con_cria" and cat("terneros") == "ternero"
    assert cat("Vacas preñadas") == "vaca_prenada" and cat("novillos") == "novillo"
    assert cat("vaca") is None and ganaderia.es_categoria_generica("Vacas")


def test_stock_con_especie_desconocida_devuelve_422_con_lista(client):
    _, h = _usuario_nuevo(client, "productor", nombre="Chacra", **S4)
    est = client.get("/api/v1/mi/establecimientos", headers=h).json()["establecimientos"][0]
    r = client.put(
        f"/api/v1/mi/establecimientos/{est['id']}/stock",
        headers=h,
        json={"stock": [{"especie": "dragones", "categoria_animal": "adulto", "cantidad": 2}]},
    )
    assert r.status_code == 422 and "bovino" in json.dumps(r.json(), ensure_ascii=False)
    ok = client.put(
        f"/api/v1/mi/establecimientos/{est['id']}/stock",
        headers=h,
        json={
            "stock": [{"especie": "Vacas", "categoria_animal": "vacas con crías", "cantidad": 4}]
        },
    )
    assert ok.status_code == 200 and ok.json()["stock"][0]["especie"] == "bovino"
    malo = client.put(
        f"/api/v1/mi/establecimientos/{est['id']}/stock",
        headers=h,
        json={"stock": [{"especie": "bovino", "categoria_animal": "xyz", "cantidad": 1}]},
    )
    assert malo.status_code == 422


def test_ganado_sin_clasificar_se_avisa_y_no_se_descarta():
    e = recomendacion.entrada_ganaderia(
        [("bovino", "vaca", 10), ("equinos", "caballo", 3), ("apicultura", "colmenas", 5)]
    )
    assert e.bovinos_sin_clasificar == 10 and e.colmenas_vivas == 5
    assert any("equinos" in a for a in e.avisos_clasificacion)
    calc = ganaderia.calcular(e)
    assert calc["bovinos_total"] == 10 and any("sin clasificar" in a for a in calc["advertencias"])


def test_caso_de_control_8_5_sigue_exacto():
    e = ganaderia.EntradaGanaderia(
        bovinos={"vaca_prenada": 8, "vaca_con_cria": 10, "ternero": 10, "vaquillona": 1, "toro": 1}
    )
    c = ganaderia.calcular(e)
    assert c["dormidero"]["superficie_necesaria_m2"] == 150
    assert c["transporte"]["camiones_jaula"] == 1 and c["racion_diaria"]["maiz_kg"] == 58.4
    assert c["racion_diaria"]["pellet_girasol_kg"] == 5.5


# ------------------------------------------------ validaciones de entrada


def test_orden_sectores_repetidos_devuelve_422(client, como):
    r = client.post(
        "/api/v1/simulacion/alternativas",
        headers=como("operador"),
        json={"altura_formosa_m": 7.6, "editable": {"orden_sectores": ["S4", "S4"]}},
    )
    assert r.status_code == 422


def test_registro_ciudadano_menores_mas_mayores_no_superan_integrantes(client):
    r = client.post(
        "/api/v1/auth/registro/ciudadano",
        json=datos_ciudadano(integrantes=2, menores=2, mayores=1),
    )
    assert r.status_code == 422


def test_parser_rechaza_coordenadas_fuera_de_formosa():
    for lat_lon in ("0,0", "-58.14,-26.18", "40.4,-3.7"):
        try:
            parser_mensajes.parsear_sos(f"SOS-FSA|{lat_lon}|CIUDADANO|FAM:2")
        except parser_mensajes.ErrorParseo as exc:
            assert "Formosa" in str(exc) or "rango" in str(exc)
        else:
            raise AssertionError(lat_lon)
    assert parser_mensajes.parsear_sos("SOS-FSA|-26.18,-58.14|CIUDADANO|FAM:2").familiares == 2


def test_sin_flota_es_faltante_total_no_cero_minutos(db):
    datos = recomendacion.cargar_datos(db, 9.0, 0.0, set())
    datos.recursos = {}
    plan = recomendacion.construir_plan(datos, ["S2"])
    s = plan["sectores"][0]
    assert s["traslado_personas"]["sin_flota"] is True
    assert s["traslado_personas"]["tiempo_para_completar_min"] is None
    assert any("No hay vehículos" in a for a in s["advertencias"])
    assert plan["metricas"]["faltantes"]["vehiculos_por_viajes_en_una_ronda"]


# ------------------------------------------------ idempotencia


def test_solicitud_idempotente_sin_ventana_de_24h(client, db):
    _, h = _usuario_nuevo(client)
    clave = str(uuid.uuid4())
    cuerpo = {"tipo": "asistencia", "personas": 2, **S4, "texto": "ayuda"}
    r1 = client.post("/api/v1/solicitudes", json=cuerpo, headers={**h, "Idempotency-Key": clave})
    assert r1.status_code == 201
    db.execute(
        update(SolicitudAsistencia)
        .where(SolicitudAsistencia.id == r1.json()["id"])
        .values(creado_en=ahora() - timedelta(days=10))
    )
    db.commit()
    r2 = client.post("/api/v1/solicitudes", json=cuerpo, headers={**h, "Idempotency-Key": clave})
    assert r2.status_code == 200 and r2.json()["id"] == r1.json()["id"]


def test_adjunto_repetido_no_se_duplica(client, monkeypatch, tmp_path):
    from app.config.settings import get_settings

    monkeypatch.setattr(get_settings(), "adjuntos_dir", str(tmp_path))
    _, h = _usuario_nuevo(client)
    sid = client.post(
        "/api/v1/solicitudes", json={"tipo": "asistencia", "personas": 1, **S4}, headers=h
    ).json()["id"]
    foto = b"\xff\xd8\xff\xe0" + b"\x01" * 40
    url = f"/api/v1/solicitudes/{sid}/adjuntos"
    a = client.post(url, files={"archivo": ("f", foto, "image/jpeg")}, headers=h)
    b = client.post(url, files={"archivo": ("f", foto, "image/jpeg")}, headers=h)
    assert a.status_code == 201 and b.status_code == 200 and b.json()["duplicado"] is True
    assert a.json()["n"] == b.json()["n"]


def test_orden_con_idempotency_key_no_se_duplica(client, como, db):
    clave = str(uuid.uuid4())
    cuerpo = {"tipo": "alerta", "sectores": ["S3"], "fundamento": FUNDAMENTO}
    h = {**como("decisor"), "Idempotency-Key": clave}
    r1 = client.post("/api/v1/ordenes", json=cuerpo, headers=h)
    r2 = client.post("/api/v1/ordenes", json=cuerpo, headers=h)
    assert r1.status_code == 201 and r2.status_code == 200
    assert r2.json()["id"] == r1.json()["id"] and r2.json()["repetida"] is True
    assert (
        client.post(
            "/api/v1/ordenes", json=cuerpo, headers={**h, "Idempotency-Key": "x"}
        ).status_code
        == 422
    )


# ------------------------------------------------ canales por mensaje


def _post(client, ruta, payload: dict):
    crudo = json.dumps(payload).encode()
    return client.post(
        f"/api/v1/canales/{ruta}",
        content=crudo,
        headers={"X-Hub-Signature-256": firmar(crudo, SECRETO), "Content-Type": "application/json"},
    )


def _wa(*mensajes):
    msgs = [{"id": i, "type": "text", "text": {"body": t}} for i, t in mensajes]
    return {"entry": [{"changes": [{"value": {"messages": msgs}}]}]}


def test_mensaje_repetido_no_se_duplica_y_lluvia_duplicada_no_tira_el_sos(client, db):
    mid = f"wamid.{uuid.uuid4().hex}"
    sos = "SOS-FSA|-26.18,-58.139|PRODUCTOR|FAM:2|BOV:5"
    primero = _post(client, "whatsapp-sim", _wa((mid, sos)))
    repetido = _post(client, "whatsapp-sim", _wa((mid, sos)))
    assert primero.json()["resultados"][0]["estado"] == "creado"
    assert repetido.json()["resultados"][0]["estado"] == "duplicado"
    assert repetido.json()["resultados"][0]["id"] == primero.json()["resultados"][0]["id"]

    lluvia = "LLUVIA PLUV-SIM-B 3"
    lote = _wa(
        (f"wamid.{uuid.uuid4().hex}", lluvia),
        (f"wamid.{uuid.uuid4().hex}", lluvia),
        (f"wamid.{uuid.uuid4().hex}", sos),
    )
    r = _post(client, "whatsapp-sim", lote)
    estados = [x["estado"] for x in r.json()["resultados"]]
    assert r.status_code == 201 and estados[-1] == "creado" and estados[1] == "duplicado"


# ------------------------------------------------ normalizador, menú SMS e IVR


def test_menu_sms_responde_con_numeros_y_fuente(client):
    for palabra in ("AYUDA", "info", "SOS"):
        r = _post(client, "sms-sim", {"remitente": "+54", "texto": palabra})
        res = r.json()["resultados"][0]
        assert r.status_code == 201 and res["tipo"] == "menu"
        for n in ("103", "106", "911", "105"):
            assert n in res["respuesta"]
        assert "argentina.gob.ar/tema/emergencias" in res["respuesta"]
        assert res["categoria_respuesta"] == "DOCUMENTO DE REFERENCIA"
    assert "SOS-FSA" in res["respuesta"]


def test_texto_libre_crea_pedido_a_verificar_sin_inventar_datos(client, db):
    texto = "Somos cinco y tenemos 40 vacas en el paraje Los Pinos, el camino está cortado"
    r = _post(client, "sms-sim", {"remitente": "+54", "texto": texto})
    res = r.json()["resultados"][0]
    assert r.status_code == 201 and res["estado"] == "creado" and res["requiere_verificacion"]
    assert res["extraido"]["personas"] == 5 and res["extraido"]["animales"] == 40
    assert res["extraido"]["especie"] == "bovino"
    assert res["extraido"]["referencia_ubicacion"].lower().startswith("paraje los pinos")
    fila = db.get(SolicitudAsistencia, res["id"])
    assert fila.geom is None and fila.ubicacion_aproximada and fila.estado == "recibida"
    assert fila.requiere_verificacion and "Pinos" in fila.referencia_ubicacion
    # Nada que registrar: no se crea nada y se orienta a quien escribe.
    nada = _post(client, "sms-sim", {"remitente": "+54", "texto": "hola buenas"}).json()
    assert nada["resultados"][0]["tipo"] == "no_entendido"


def test_ivr_con_guion_de_turnos_pasa_por_el_normalizador(client):
    r = _post(
        client,
        "ivr-sim",
        {
            "llamada_id": f"call-{uuid.uuid4().hex}",
            "turnos": ["Estamos en el barrio Norte", "somos tres personas", "tenemos 12 cabras"],
        },
    )
    res = r.json()["resultados"][0]
    assert r.status_code == 201 and res["extraido"]["personas"] == 3
    assert res["extraido"]["animales"] == 12 and res["extraido"]["especie"] == "caprino"


# ------------------------------------------------ grupo familiar, cuadrillas, WebSocket


def test_put_grupo_familiar_no_borra_lo_que_se_omite(client):
    _, h = _usuario_nuevo(client)
    client.put(
        "/api/v1/mi/grupo-familiar",
        headers=h,
        json={"integrantes": 3, "telefono": "000-111", "salud": "diabetes", **S4},
    )
    r = client.put("/api/v1/mi/grupo-familiar", headers=h, json={"integrantes": 4})
    g = r.json()
    assert g["integrantes"] == 4 and g["telefono"] == "000-111" and g["salud"] == "diabetes"
    assert g["lon"] is not None
    borrado = client.put("/api/v1/mi/grupo-familiar", headers=h, json={"telefono": None}).json()
    assert borrado["telefono"] is None and borrado["salud"] == "diabetes"


def test_las_ordenes_se_reparten_entre_cuadrillas_del_mismo_tipo(client, como, db):
    h = como("operador")
    extra = client.post(
        "/api/v1/cuadrillas",
        headers=h,
        json={"nombre": f"Humana extra {uuid.uuid4().hex[:6]}", "tipo_incidente": "humana"},
    ).json()["id"]
    # El reparto va a la cuadrilla con menos tareas abiertas (desempata por id): las cuadrillas
    # humanas sin tareas (los equipos de demostración incluidos) van antes que la nueva, que la
    # recibe como mucho a la orden número de cuadrillas humanas.
    cantidad = db.execute(
        select(func.count(Cuadrilla.id)).where(
            Cuadrilla.tipo_incidente == "humana", Cuadrilla.estado != "baja"
        )
    ).scalar_one()
    for _ in range(cantidad):
        client.post(
            "/api/v1/ordenes",
            headers=como("decisor"),
            json={"tipo": "evacuacion", "sectores": ["S4"], "fundamento": FUNDAMENTO},
        )
    humanas = (
        db.execute(select(Cuadrilla.id).where(Cuadrilla.tipo_incidente == "humana")).scalars().all()
    )
    asignadas = {
        t.cuadrilla_id
        for t in db.execute(select(Tarea).where(Tarea.cuadrilla_id.in_(humanas))).scalars()
    }
    assert extra in asignadas and len(asignadas) >= 2
    db.expire_all()
    assert db.get(Cuadrilla, extra).estado == "ocupada"


def test_la_orden_solo_llega_a_los_afectados_y_a_los_mandos():
    d = Difusor()
    ws = lambda: object()  # noqa: E731
    from app.core.eventos import _Conexion

    d._conexiones = [
        _Conexion(ws(), 1, "operador", 9e12),
        _Conexion(ws(), 2, "ciudadano", 9e12),
        _Conexion(ws(), 3, "ciudadano", 9e12),
    ]
    elegidos = d._destinatarios("orden", None, frozenset({2}))
    assert {c.usuario_id for c in elegidos} == {1, 2}
    assert {c.usuario_id for c in d._destinatarios("orden", None, None)} == {1}


def test_listados_con_offset(client, como):
    h = como("operador")
    for ruta in ("/api/v1/solicitudes", "/api/v1/tareas", "/api/v1/bitacora", "/api/v1/lluvia"):
        r = client.get(f"{ruta}?limite=1&offset=0", headers=h)
        assert r.status_code == 200, ruta
        assert client.get(f"{ruta}?offset=-1", headers=h).status_code == 422


# ------------------------------------------------ tableros


def test_panel_resumen_estructura_y_permisos(client, como):
    assert client.get("/api/v1/panel/resumen", headers=como("ciudadano1")).status_code == 403
    r = client.get("/api/v1/panel/resumen", headers=como("decisor"))
    assert r.status_code == 200, r.text
    p = r.json()
    for k in ("rio", "sectores", "solicitudes", "centros", "cuadrillas", "ordenes", "lluvia_7d"):
        assert {"categoria", "fuente", "fecha_dato"} <= set(p[k]), k
    assert p["rio"]["umbral_alerta_m"] == 7.8 and p["rio"]["umbral_evacuacion_m"] == 8.3
    assert {s["id"] for s in p["sectores"]["items"]} == {"S1", "S2", "S3", "S4"}
    assert "dias_minimo" in p["rio"]["tiempo_a_umbrales"][0]
    assert "por_estado" in p["solicitudes"] and "items" in p["centros"]


def test_admin_resumen_y_usuarios_con_bloqueo(client, como):
    assert client.get("/api/v1/admin/resumen", headers=como("operador")).status_code == 403
    a = client.get("/api/v1/admin/resumen", headers=como("admin")).json()
    assert a["auditoria"]["cadena_integra"] in (True, False)
    assert {"por_rol", "cuentas_bloqueadas", "sin_login_30_dias"} <= set(a["usuarios"])
    assert "websockets_activos" in a["servicio"]
    u = client.get("/api/v1/usuarios", headers=como("admin")).json()[0]
    assert "intentos_fallidos" in u and "bloqueado_hasta" in u


def test_serie_vacia_no_rompe_con_500():
    from app.servicios import contexto

    assert contexto.ultima_lectura_o_none({}) is None
    try:
        contexto.ultima_lectura({})
    except contexto.ErrorSinLecturas:
        pass
    else:
        raise AssertionError
