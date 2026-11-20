import { Box, Button, Heading, Text, VStack } from "@chakra-ui/react";
import { useState, type FormEvent } from "react";

import { AvisoFueraDeFormosa, BotonUbicacion } from "../../components/BotonUbicacion";
import { ElegirEnMapa } from "../../components/ElegirEnMapa";
import { AlertaError, Campo } from "../../components/Formulario";
import { Plegable } from "../../components/Plegable";
import { solicitar } from "../../lib/api";
import { coordenadaATexto, decimal, enfocarPrimerError, enRango, entero, validarCoordenadas, type Errores } from "../../lib/validacion";

export type Grupo = {
  integrantes?: number;
  menores?: number;
  mayores?: number;
  mascotas?: number;
  telefono?: string | null;
  salud?: string | null;
  vulnerabilidad?: string | null;
  lon?: number | null;
  lat?: number | null;
};

const txt = (n: number | null | undefined, porDefecto: string) => (n === null || n === undefined ? porDefecto : String(n));

/**
 * «Editar mi grupo familiar»: PUT /mi/grupo-familiar. El PUT reemplaza todo el registro, así que los campos
 * que esta pantalla no muestra (salud, vulnerabilidad) se reenvían tal como vinieron del servidor.
 */
export function EditarGrupo({ grupo, alGuardar }: { grupo: Grupo | null; alGuardar: () => void }) {
  const [v, setV] = useState({
    integrantes: txt(grupo?.integrantes, "1"),
    menores: txt(grupo?.menores, "0"),
    mayores: txt(grupo?.mayores, "0"),
    mascotas: txt(grupo?.mascotas, "0"),
    telefono: grupo?.telefono ?? "",
    lon: grupo?.lon != null ? coordenadaATexto(grupo.lon) : "",
    lat: grupo?.lat != null ? coordenadaATexto(grupo.lat) : "",
  });
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const [errorApi, setErrorApi] = useState<unknown>(null);
  const [guardado, setGuardado] = useState(false);

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setGuardado(false);
    setV({ ...v, [k]: e.target.value });
  };
  const lon = decimal(v.lon);
  const lat = decimal(v.lat);
  const puntoValido = lon !== null && lat !== null && !Number.isNaN(lon) && !Number.isNaN(lat);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorApi(null);
    const integrantes = entero(v.integrantes);
    const menores = entero(v.menores);
    const mayores = entero(v.mayores);
    const mascotas = entero(v.mascotas);
    const err: Errores = {};
    if (!enRango(integrantes, 1, 40)) err.integrantes = "Entre 1 y 40 integrantes.";
    if (!enRango(menores, 0, 40)) err.menores = "Entre 0 y 40.";
    if (!enRango(mayores, 0, 40)) err.mayores = "Entre 0 y 40.";
    if (!enRango(mascotas, 0, 100)) err.mascotas = "Entre 0 y 100.";
    if (!err.integrantes && !err.menores && !err.mayores && menores! + mayores! > integrantes!) {
      err.menores = "Los menores y las personas mayores no pueden superar a los integrantes.";
    }
    if (v.telefono.length > 30) err.telefono = "Máximo 30 caracteres.";
    Object.assign(err, validarCoordenadas(v.lon, v.lat, false));
    if ((v.lon.trim() === "") !== (v.lat.trim() === "")) err.lat = "Completá longitud y latitud, o dejá ambas vacías.";
    setErrores(err);
    if (Object.keys(err).length) {
      enfocarPrimerError();
      return;
    }
    const cuerpo: Record<string, unknown> = {
      integrantes,
      menores,
      mayores,
      mascotas,
      telefono: v.telefono.trim() || null,
      salud: grupo?.salud ?? null,
      vulnerabilidad: grupo?.vulnerabilidad ?? null,
    };
    if (v.lon.trim() && v.lat.trim()) {
      cuerpo.lon = lon;
      cuerpo.lat = lat;
    }
    setEnviando(true);
    try {
      await solicitar("/mi/grupo-familiar", { autenticado: true, metodo: "PUT", cuerpo });
      setGuardado(true);
      alGuardar();
    } catch (x) {
      setErrorApi(x);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Plegable titulo="Editar mi grupo familiar" abiertoInicial={!grupo}>
      <form onSubmit={(e) => void enviar(e)} noValidate aria-label="Editar mi grupo familiar">
        <VStack spacing={4} align="stretch" maxW="34rem" pb={2}>
          <AlertaError error={errorApi} />
          <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={4}>
            <Campo id="g-integrantes" etiqueta="Integrantes" inputMode="numeric" value={v.integrantes} onChange={set("integrantes")} error={errores.integrantes} />
            <Campo id="g-mascotas" etiqueta="Mascotas" inputMode="numeric" value={v.mascotas} onChange={set("mascotas")} error={errores.mascotas} />
            <Campo id="g-menores" etiqueta="Menores" inputMode="numeric" value={v.menores} onChange={set("menores")} error={errores.menores} />
            <Campo id="g-mayores" etiqueta="Personas mayores" inputMode="numeric" value={v.mayores} onChange={set("mayores")} error={errores.mayores} />
          </Box>
          <Campo id="g-telefono" etiqueta="Teléfono (opcional)" type="tel" value={v.telefono} onChange={set("telefono")} error={errores.telefono} ayuda="Se guarda cifrado." autoComplete="tel" />
          <Heading as="h3" size="xs">
            Domicilio (opcional)
          </Heading>
          <BotonUbicacion
            primario
            onUbicacion={(lo, la) => {
              setGuardado(false);
              setV((x) => ({ ...x, lon: coordenadaATexto(lo), lat: coordenadaATexto(la) }));
            }}
          />
          <ElegirEnMapa
            lon={v.lon}
            lat={v.lat}
            onChange={(p) => {
              setGuardado(false);
              setV((x) => ({ ...x, lon: coordenadaATexto(p.lon), lat: coordenadaATexto(p.lat) }));
            }}
          />
          <Plegable titulo="O escribí las coordenadas a mano" abierto={errores.lat || errores.lon ? true : undefined}>
            <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={4} pb={2}>
              <Campo id="g-lat" etiqueta="Latitud" inputMode="decimal" value={v.lat} onChange={set("lat")} error={errores.lat} placeholder="-26,183" />
              <Campo id="g-lon" etiqueta="Longitud" inputMode="decimal" value={v.lon} onChange={set("lon")} error={errores.lon} placeholder="-58,183" />
            </Box>
          </Plegable>
          <AvisoFueraDeFormosa lon={puntoValido ? lon : null} lat={puntoValido ? lat : null} />
          <Button type="submit" isLoading={enviando} loadingText="Guardando" minH="2.75rem">
            Guardar cambios
          </Button>
          {guardado && (
            <Text role="status" fontSize="sm">
              Cambios guardados.
            </Text>
          )}
        </VStack>
      </form>
    </Plegable>
  );
}
