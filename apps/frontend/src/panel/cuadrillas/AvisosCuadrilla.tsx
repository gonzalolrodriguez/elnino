import { Box, Button, Flex, FormControl, FormErrorMessage, FormHelperText, FormLabel, Input, Radio, RadioGroup, Text, Textarea, useToast } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { IconoEnviar, IconoMegafono, IconoTilde, IconoReloj } from "../../components/iconos/Iconos";
import { etiquetaRolOperativo, fechaHora } from "../../lib/etiquetas";
import { useCarga } from "../../lib/useCarga";
import { api } from "../api";
import { useSenalTiempoReal } from "../TiempoRealContext";
import type { AvisoCuadrilla, CuadrillaCompleta, TipoAviso } from "../tipos";
import { Cargando, Chip, Seccion } from "../ui";
import { ITEMS_SUGERIDOS, TIPOS_AVISO, etiquetaTipoAviso, geometriaDe, validarAviso, type ErroresAviso } from "./catalogos";
import { MapaDesvio } from "./MapaDesvio";
import type { Punto } from "./MapaDesvioGL";
import { TACTIL } from "./partes";

const TONO_AVISO: Record<TipoAviso, "info" | "aviso" | "alerta" | "neutro"> = { desvio: "aviso", equipamiento: "info", instruccion: "neutro", seguridad: "alerta" };

function resumenGeometria(g: AvisoCuadrilla["geometria"]): string | null {
  if (!g) return null;
  return g.type === "Point" ? "Punto marcado en el mapa" : `Desvío de ${g.coordinates.length} puntos`;
}

function ListaAvisos({ cuadrillaId, recargar, puedeGestionar }: { cuadrillaId: number; recargar: number; puedeGestionar: boolean }) {
  const senal = useSenalTiempoReal();
  const carga = useCarga(() => api.avisosDeCuadrilla(cuadrillaId).then((r) => r.items), [cuadrillaId, recargar, senal]);
  return (
    <Cargando
      carga={carga}
      esVacio={(d) => d.length === 0}
      vacio={puedeGestionar ? "Todavía no enviaste avisos a esta cuadrilla." : "Todavía no hay avisos para esta cuadrilla."}
      hijos={(avisos) => (
        <Box as="ul" listStyleType="none" m={0} p={0} display="flex" flexDirection="column" gap={2} data-testid="lista-avisos">
          {avisos.map((a) => {
            const geo = resumenGeometria(a.geometria);
            return (
              <Box as="li" key={a.id} p={3} borderRadius="lg" border="1px solid" borderColor="borde" bg="superficie" data-testid="aviso">
                <Flex align="center" columnGap={2} rowGap={1} wrap="wrap">
                  <Chip tono={TONO_AVISO[a.tipo] ?? "neutro"}>{etiquetaTipoAviso(a.tipo)}</Chip>
                  {a.creado_por_rol && <Text fontSize="sm" color="textoSuave">{etiquetaRolOperativo(a.creado_por_rol)}</Text>}
                  <Text as="time" dateTime={a.creado_en} textStyle="microdato" ml={{ md: "auto" }}>
                    {fechaHora(a.creado_en)}
                  </Text>
                </Flex>
                <Text fontSize="sm" mt={1.5} overflowWrap="anywhere">
                  {a.texto}
                </Text>
                {a.items.length > 0 && (
                  <Flex as="ul" listStyleType="none" m={0} mt={1.5} p={0} gap={1.5} wrap="wrap" aria-label="Qué llevar">
                    {a.items.map((i) => (
                      <Chip as="li" key={i} tono="neutro">
                        {i}
                      </Chip>
                    ))}
                  </Flex>
                )}
                {geo && (
                  <Text textStyle="microdato" mt={1.5}>
                    {geo}
                  </Text>
                )}
                <Box mt={2} data-testid="lecturas-aviso">
                  {a.leido_en ? (
                    <Chip tono="ok" icono={<IconoTilde tam="0.9rem" />}>
                      {`Leído por ${a.leido_por_rol ? etiquetaRolOperativo(a.leido_por_rol) : "un integrante"} · ${fechaHora(a.leido_en)}`}
                    </Chip>
                  ) : (
                    <Chip tono="aviso" icono={<IconoReloj tam="0.9rem" />}>
                      Pendiente de lectura
                    </Chip>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    />
  );
}

/** Avisos del operativo a la cuadrilla: redacción con desvío dibujado o lista de qué llevar, y avisos enviados con su lectura. */
export function AvisosCuadrilla({ cuadrilla, tareaId, referencia, puedeGestionar = true }: { cuadrilla: CuadrillaCompleta; tareaId: number | null; referencia?: Punto[] | null; puedeGestionar?: boolean }) {
  const toast = useToast();
  const [tipo, setTipo] = useState<TipoAviso>("instruccion");
  const [texto, setTexto] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [otro, setOtro] = useState("");
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [modo, setModo] = useState<"linea" | "punto">("linea");
  const [errores, setErrores] = useState<ErroresAviso>({});
  const [error, setError] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const [version, setVersion] = useState(0);

  // Sin repetidos aunque cambie la capitalización («palas» del equipamiento y «Palas» de las sugerencias).
  const sugeridos = [...cuadrilla.equipamiento, ...ITEMS_SUGERIDOS].filter((x, i, l) => l.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
  const conMapa = tipo === "desvio" || tipo === "seguridad";

  useEffect(() => {
    // Al cambiar de tipo, el trazado propio del tipo anterior no se arrastra.
    setErrores({});
    setModo(tipo === "seguridad" ? "punto" : "linea");
    if (tipo !== "desvio" && tipo !== "seguridad") setPuntos([]);
  }, [tipo]);

  function alternar(item: string) {
    setItems((x) => (x.includes(item) ? x.filter((y) => y !== item) : [...x, item]));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const geometria = conMapa ? geometriaDe(modo === "punto" ? puntos.slice(0, 1) : puntos) : null;
    const cuerpo = { tipo, texto: texto.trim(), items: tipo === "equipamiento" ? items : [], geometria, tarea_id: tareaId };
    const v = validarAviso(cuerpo);
    setErrores(v);
    if (Object.keys(v).length > 0) return;
    setError(null);
    setEnviando(true);
    try {
      await api.enviarAviso(cuadrilla.id, cuerpo);
      toast({ title: "Aviso enviado", description: `${etiquetaTipoAviso(tipo)} para ${cuadrilla.nombre}`, status: "success", duration: 3000 });
      setTexto("");
      setItems([]);
      setPuntos([]);
      setVersion((x) => x + 1);
    } catch (x) {
      setError(x);
    } finally {
      setEnviando(false);
    }
  }

  const centro: Punto | null = cuadrilla.base ? [cuadrilla.base.lon, cuadrilla.base.lat] : null;

  return (
    <Seccion titulo="Avisos del operativo" id="sec-avisos" icono={<IconoMegafono tam="1.25rem" />} categoria="SIMULADO">
      {puedeGestionar && (
      <Box as="form" onSubmit={(e: React.FormEvent) => void enviar(e)} noValidate data-testid="form-aviso">
        <FormControl as="fieldset" border="0" p={0} m={0}>
          <FormLabel as="legend" mb={2}>
            Tipo de aviso
          </FormLabel>
          <RadioGroup value={tipo} onChange={(v) => setTipo(v as TipoAviso)}>
            <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" }} gap={2}>
              {TIPOS_AVISO.map((t) => (
                <Box key={t.id} p={2.5} minH="2.75rem" borderRadius="lg" border="1px solid" borderColor={tipo === t.id ? "agua.700" : "borde"} bg={tipo === t.id ? "agua.50" : "superficie"}>
                  <Radio value={t.id} alignItems="flex-start">
                    <Text fontWeight={700} fontSize="sm" lineHeight="1.3">
                      {t.nombre}
                    </Text>
                    <Text fontSize="xs" color="textoSuave">
                      {t.ayuda}
                    </Text>
                  </Radio>
                </Box>
              ))}
            </Box>
          </RadioGroup>
        </FormControl>

        <FormControl mt={4} isInvalid={!!errores.texto}>
          <FormLabel htmlFor="aviso-texto">Mensaje para la cuadrilla</FormLabel>
          <Textarea id="aviso-texto" bg="superficie" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
          {errores.texto ? <FormErrorMessage>{errores.texto}</FormErrorMessage> : <FormHelperText>{texto.length}/500</FormHelperText>}
        </FormControl>

        {tipo === "equipamiento" && (
          <FormControl mt={4} isInvalid={!!errores.items} as="fieldset" border="0" p={0} m={0}>
            <FormLabel as="legend" mb={2}>
              Qué tiene que llevar
            </FormLabel>
            <Flex gap={2} wrap="wrap" role="group" aria-label="Ítems sugeridos">
              {sugeridos.map((i) => (
                <Button key={i} size="sm" {...TACTIL} borderRadius="full" variant={items.includes(i) ? "solid" : "outline"} aria-pressed={items.includes(i)} onClick={() => alternar(i)}>
                  {i}
                </Button>
              ))}
              {items
                .filter((i) => !sugeridos.includes(i))
                .map((i) => (
                  <Button key={i} size="sm" {...TACTIL} borderRadius="full" aria-pressed onClick={() => alternar(i)}>
                    {i}
                  </Button>
                ))}
            </Flex>
            <Flex gap={2} mt={2} align="flex-end">
              <Box flex="1">
                <FormLabel htmlFor="aviso-otro" fontSize="sm" mb={1}>
                  Otro ítem
                </FormLabel>
                <Input
                  id="aviso-otro"
                  bg="superficie"
                  value={otro}
                  maxLength={60}
                  onChange={(e) => setOtro(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = otro.trim();
                      if (v && !items.includes(v)) setItems((x) => [...x, v]);
                      setOtro("");
                    }
                  }}
                />
              </Box>
              <Button
                variant="outline"
                {...TACTIL}
                isDisabled={otro.trim() === ""}
                onClick={() => {
                  const v = otro.trim();
                  if (v && !items.includes(v)) setItems((x) => [...x, v]);
                  setOtro("");
                }}
              >
                Sumar ítem
              </Button>
            </Flex>
            {errores.items && <FormErrorMessage>{errores.items}</FormErrorMessage>}
          </FormControl>
        )}

        {conMapa && (
          <Box mt={4}>
            <Text fontWeight={600} mb={2} id="aviso-mapa-titulo">
              {tipo === "desvio" ? "Desvío en el mapa" : "Punto de riesgo en el mapa (opcional)"}
            </Text>
            <MapaDesvio puntos={puntos} onChange={setPuntos} referencia={referencia} centro={centro} modo={modo} alCambiarModo={setModo} />
            {errores.geometria && (
              <Text role="alert" color="alerta.700" fontSize="sm" fontWeight={600} mt={2}>
                {errores.geometria}
              </Text>
            )}
          </Box>
        )}

        <Box mt={4}>
          <AlertaError error={error} />
        </Box>
        <Button type="submit" mt={3} {...TACTIL} leftIcon={<IconoEnviar tam="1.1rem" />} isLoading={enviando} loadingText="Enviando">
          Enviar aviso
        </Button>
        <Text textStyle="microdato" mt={2}>
          {tareaId ? `El aviso queda asociado a la tarea n.º ${tareaId}.` : "La cuadrilla no tiene tarea en curso: el aviso queda sin tarea."} Cuando un integrante lo lea, vas a ver quién y a qué hora.
        </Text>
      </Box>
      )}

      <Box mt={puedeGestionar ? 5 : 0} pt={puedeGestionar ? 4 : 0} borderTop={puedeGestionar ? "1px solid" : undefined} borderColor="borde">
        <Text as="h3" textStyle="rotulo" mb={2}>
          Avisos enviados
        </Text>
        <ListaAvisos cuadrillaId={cuadrilla.id} recargar={version} puedeGestionar={puedeGestionar} />
      </Box>
    </Seccion>
  );
}
