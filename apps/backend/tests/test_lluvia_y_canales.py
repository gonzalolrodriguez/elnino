"""Lluvia (carga, planilla, exportación) y canales simulados con HMAC (§8.8, §8.10)."""

import io
import json
import os
import uuid
from datetime import date, timedelta

import openpyxl
from sqlalchemy import delete, select

from app.api.v1.canales import firmar
from app.db.modelos import LecturaLluvia, SolicitudAsistencia

SECRETO = os.environ["CANAL_HMAC_SECRET"]
HOY = date.today()


def _dia(n: int) -> str:
    return (HOY - timedelta(days=n)).isoformat()


def _borrar_lluvia(db):
    db.execute(delete(LecturaLluvia))
    db.commit()


def test_cargar_lluvia_con_origen_y_categoria_visibles(client, como, db):
    _borrar_lluvia(db)
    r = client.post(
        "/api/v1/lluvia",
        json={
            "puesto": "PLUV-SIM-A",
            "fecha": _dia(1),
            "turno": "07",
            "mm": 12.5,
            "origen": "carga_manual",
        },
        headers=como("operador"),
    )
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["mm"] == 12.5 and c["origen"] == "carga_manual" and c["categoria"] == "SIMULADO"
    assert c["fuente"] and c["fecha_dato"] == _dia(1)
    lista = client.get("/api/v1/lluvia").json()
    assert lista["n"] == 1 and lista["sin_dato_observado"] is True
    assert "kit no incluye lluvia observada" in lista["nota"]


def test_lluvia_validaciones(client, como, db):
    _borrar_lluvia(db)
    h = como("operador")
    base = {"puesto": "PLUV-SIM-A", "fecha": _dia(1), "turno": "07", "mm": 5}
    assert client.post("/api/v1/lluvia", json={**base, "mm": -1}, headers=h).status_code == 422
    assert client.post("/api/v1/lluvia", json={**base, "mm": 9999}, headers=h).status_code == 422
    assert client.post("/api/v1/lluvia", json={**base, "turno": "12"}, headers=h).status_code == 422
    futura = (HOY + timedelta(days=3)).isoformat()
    assert (
        client.post("/api/v1/lluvia", json={**base, "fecha": futura}, headers=h).status_code == 422
    )
    assert (
        client.post("/api/v1/lluvia", json={**base, "puesto": "NO-EXISTE"}, headers=h).status_code
        == 404
    )
    assert client.post("/api/v1/lluvia", json=base, headers=h).status_code == 201
    assert client.post("/api/v1/lluvia", json=base, headers=h).status_code == 409  # duplicado
    assert client.post("/api/v1/lluvia", json=base, headers=como("ciudadano1")).status_code == 403
    # un parte real posterior al corte requiere la decisión de la mesa
    real = {**base, "puesto": "PLUV-SIM-B", "origen": "parte_policial"}
    assert client.post("/api/v1/lluvia", json=real, headers=h).status_code == 422


def test_vacio_no_es_cero_y_advertencia_de_vecinos(client, como, db):
    _borrar_lluvia(db)
    h = como("operador")
    r = client.post(
        "/api/v1/lluvia",
        json={"puesto": "PLUV-SIM-A", "fecha": _dia(2), "turno": "17", "mm": None},
        headers=h,
    )
    assert r.status_code == 201 and r.json()["mm"] is None
    fila = db.execute(select(LecturaLluvia)).scalar_one()
    assert fila.mm is None  # sin medición, no 0
    # PLUV-SIM-B está cerca de A (menos de 30 km) y difiere en más de 40 mm
    cero = client.post(
        "/api/v1/lluvia",
        json={"puesto": "PLUV-SIM-B", "fecha": _dia(2), "turno": "17", "mm": 0},
        headers=h,
    )
    assert cero.status_code == 201 and cero.json()["mm"] == 0
    client.post(
        "/api/v1/lluvia",
        json={"puesto": "PLUV-SIM-A", "fecha": _dia(3), "turno": "07", "mm": 0},
        headers=h,
    )
    fuerte = client.post(
        "/api/v1/lluvia",
        json={"puesto": "PLUV-SIM-B", "fecha": _dia(3), "turno": "07", "mm": 120},
        headers=h,
    )
    assert fuerte.status_code == 201
    assert fuerte.json()["advertencias"] and "vecino" in fuerte.json()["advertencias"][0]


def _planilla(filas) -> bytes:
    libro = openpyxl.Workbook()
    hoja = libro.active
    hoja.title = "📥 CARGA DIARIA"
    for i, t in enumerate(["FECHA", "ESTACIÓN", "DEPARTAMENTO", "mm LLUVIA"], start=1):
        hoja.cell(row=3, column=i, value=t)
    for n, (fecha, estacion, mm) in enumerate(filas, start=4):
        hoja.cell(row=n, column=1, value=fecha)
        hoja.cell(row=n, column=2, value=estacion)
        hoja.cell(row=n, column=4, value=mm)
    salida = io.BytesIO()
    libro.save(salida)
    return salida.getvalue()


def test_importar_planilla_vacio_distinto_de_cero_y_exportar(client, como, db):
    _borrar_lluvia(db)
    h = como("operador")
    contenido = _planilla(
        [
            (date(2026, 10, 10), "Puesto pluviométrico SIMULADO A", 0),
            (date(2026, 10, 11), "Puesto pluviométrico SIMULADO A", None),
            ("12/10/2026", "puesto pluviometrico simulado a", "7,5"),
            (date(2026, 10, 10), "Puesto pluviométrico SIMULADO A", 3),  # duplicada
            (date(2026, 10, 13), "Ibarreta", 5),  # estación desconocida
            (date(2026, 10, 14), "Puesto pluviométrico SIMULADO A", "mucho"),
            (None, "Puesto pluviométrico SIMULADO A", 4),  # sin fecha
        ]
    )
    r = client.post(
        "/api/v1/lluvia/importar-planilla",
        files={"archivo": ("planilla.xlsx", contenido, "application/octet-stream")},
        headers=h,
    )
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["insertadas"] == 3 and res["sin_medicion"] == 1
    assert res["duplicadas"] == 1 and res["incompletas"] == 1
    assert {x["fila"] for x in res["rechazadas"]} == {8, 9}
    filas = {f.fecha.day: f for f in db.execute(select(LecturaLluvia)).scalars()}
    assert float(filas[10].mm) == 0 and filas[11].mm is None and float(filas[12].mm) == 7.5
    assert all(f.origen == "planilla_upca" for f in filas.values())

    ex = client.get("/api/v1/lluvia/exportar?anio_hidrologico=2026", headers=h)
    assert ex.status_code == 200
    assert ex.headers["content-type"].startswith("application/vnd.openxmlformats")
    hoja = openpyxl.load_workbook(io.BytesIO(ex.content)).active
    assert hoja["A3"].value == "FECHA" and hoja["D3"].value == "mm LLUVIA"
    valores = {
        hoja.cell(row=n, column=1).value.day: hoja.cell(row=n, column=4).value
        for n in range(4, hoja.max_row + 1)
    }
    assert valores[10] == 0 and valores[11] is None and valores[12] == 7.5


def test_importar_rechaza_archivo_invalido_y_exige_rol(client, como):
    h = como("operador")
    mal = client.post(
        "/api/v1/lluvia/importar-planilla",
        files={"archivo": ("x.xlsx", b"no es excel", "application/octet-stream")},
        headers=h,
    )
    assert mal.status_code == 422
    sin_rol = client.post(
        "/api/v1/lluvia/importar-planilla",
        files={"archivo": ("x.xlsx", _planilla([]), "application/octet-stream")},
        headers=como("ciudadano1"),
    )
    assert sin_rol.status_code == 403


# ---------------------------------------------------------------- canales con HMAC


def _wa(texto: str, ts: int | None = None) -> bytes:
    msg = {
        "from": "5493700000000",
        "id": f"wamid.{uuid.uuid4().hex}",
        "type": "text",
        "text": {"body": texto},
    }
    if ts:
        msg["timestamp"] = str(ts)
    return json.dumps(
        {
            "object": "whatsapp_business_account",
            "entry": [
                {"id": "1", "changes": [{"field": "messages", "value": {"messages": [msg]}}]}
            ],
        }
    ).encode()


def _post(client, ruta: str, cuerpo: bytes, firma: str | None = "auto"):
    cab = {"Content-Type": "application/json"}
    if firma == "auto":
        cab["X-Hub-Signature-256"] = firmar(cuerpo, SECRETO)
    elif firma:
        cab["X-Hub-Signature-256"] = firma
    return client.post(f"/api/v1/canales/{ruta}", content=cuerpo, headers=cab)


def test_hmac_valido_e_invalido(client):
    cuerpo = _wa("SOS-FSA|-26.18,-58.139|PRODUCTOR|FAM:2|BOV:5")
    assert _post(client, "whatsapp-sim", cuerpo, firma=None).status_code == 401
    assert _post(client, "whatsapp-sim", cuerpo, firma="sha256=" + "0" * 64).status_code == 401
    otra = firmar(cuerpo, "otro-secreto-cualquiera-1234")
    assert _post(client, "whatsapp-sim", cuerpo, firma=otra).status_code == 401
    # cuerpo alterado después de firmar
    firma_ok = firmar(cuerpo, SECRETO)
    assert _post(client, "whatsapp-sim", cuerpo + b" ", firma=firma_ok).status_code == 401
    assert _post(client, "whatsapp-sim", cuerpo).status_code == 201


def test_whatsapp_sos_crea_solicitud_en_el_sector(client, db):
    antes = db.execute(select(SolicitudAsistencia.id)).all()
    r = _post(
        client, "whatsapp-sim", _wa("SOS-FSA|-26.18,-58.139|PRODUCTOR|FAM:2|BOV:5(5V)|ACC:TIERRA")
    )
    assert r.status_code == 201, r.text
    res = r.json()["resultados"][0]
    assert res["tipo"] == "solicitud" and res["sector_id"] == "S4"
    fila = db.get(SolicitudAsistencia, res["id"])
    assert (fila.origen, fila.personas, fila.animales, fila.estado) == (
        "whatsapp_sim",
        2,
        5,
        "recibida",
    )
    assert fila.detalle["acceso"] == "TIERRA"
    assert len(db.execute(select(SolicitudAsistencia.id)).all()) == len(antes) + 1


def test_sms_lluvia_crea_lectura_simulada_y_mal_formado_422(client, db):
    _borrar_lluvia(db)
    cuerpo = json.dumps({"remitente": "+5493700000001", "texto": "LLUVIA PLUV-SIM-C 18,5"}).encode()
    r = _post(client, "sms-sim", cuerpo)
    assert r.status_code == 201, r.text
    lectura = db.get(LecturaLluvia, r.json()["resultados"][0]["id"])
    assert (
        float(lectura.mm) == 18.5
        and lectura.origen == "simulado"
        and lectura.categoria == "SIMULADO"
    )
    for texto in ("LLUVIA PLUV-SIM-C", "LLUVIA PLUV-SIM-C abc", "LLUVIA NO-EXISTE 5"):
        mal = json.dumps({"remitente": "+54", "texto": texto}).encode()
        assert _post(client, "sms-sim", mal).status_code == 422, texto
    # Un texto que no se entiende no es un error: se responde con la guía y no se registra nada.
    hola = json.dumps({"remitente": "+54", "texto": "hola"}).encode()
    r = _post(client, "sms-sim", hola)
    assert r.status_code == 201 and r.json()["resultados"][0]["tipo"] == "no_entendido"


def test_ivr_y_payload_invalido(client):
    ok = json.dumps(
        {"llamada_id": "c1", "transcripcion": "SOS-FSA|-26.18,-58.139|CIUDADANO|FAM:3"}
    ).encode()
    assert _post(client, "ivr-sim", ok).status_code == 201
    assert _post(client, "ivr-sim", b'{"otro": 1}').status_code == 422
    assert _post(client, "ivr-sim", b"no-json").status_code == 422


def test_whatsapp_un_mensaje_invalido_no_tira_a_los_validos(client, db):
    antes = len(db.execute(select(SolicitudAsistencia.id)).all())
    msgs = [
        {
            "id": f"wamid.{uuid.uuid4().hex}",
            "type": "text",
            "text": {"body": "SOS-FSA|-26.18,-58.139|CIUDADANO|FAM:2"},
        },
        {"id": f"wamid.{uuid.uuid4().hex}", "type": "text", "text": {"body": "LLUVIA"}},
    ]
    cuerpo = json.dumps({"entry": [{"changes": [{"value": {"messages": msgs}}]}]}).encode()
    r = _post(client, "whatsapp-sim", cuerpo)
    assert r.status_code == 201
    assert [x["estado"] for x in r.json()["resultados"]] == ["creado", "error"]
    db.expire_all()
    assert len(db.execute(select(SolicitudAsistencia.id)).all()) == antes + 1
    # Todos inválidos: sigue siendo 422.
    solo_mal = json.dumps({"entry": [{"changes": [{"value": {"messages": [msgs[1]]}}]}]}).encode()
    assert _post(client, "whatsapp-sim", solo_mal).status_code == 422
