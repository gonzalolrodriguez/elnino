import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Select,
  Text,
  Textarea,
  useToast,
  VisuallyHidden,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AlertaError, Campo } from "../../components/Formulario";
import { Opcion } from "../../components/Opcion";
import { MapaUbicacion } from "../../components/ElegirEnMapa";
import { IconoMas } from "../../components/iconos/Iconos";
import { Insignia } from "../../components/Insignia";
import { ROL_OPERATIVO, etiquetaRolOperativo } from "../../lib/etiquetas";
import { VEHICULOS, etiquetaVehiculo } from "../../lib/pedidos";
import { api } from "../api";
import type { CuadrillaCompleta, TipoOperativo } from "../tipos";
import {
  PROFESIONES,
  TIPOS_OPERATIVO,
  ajustarFilas,
  etiquetaProfesion,
  etiquetaTipoOperativo,
  hayErrores,
  incidenteDe,
  integrantesDe,
  normalizarPlantillas,
  puntoDe,
  validarDatos,
  validarEquipamiento,
  validarIntegrantes,
  MAX_INTEGRANTES,
  type Borrador,
  type Errores,
  type FilaIntegrante,
} from "./catalogos";
import { TACTIL } from "./partes";

const PASOS = ["Datos", "Integrantes", "Equipamiento", "Resumen"] as const;

type Candidato = { id: number; nombre: string; rol_operativo: string | null };

let contadorClaves = 0;
const nuevaClave = () => `f${++contadorClaves}`;

/** Borrador inicial: vacío para el alta, o cargado desde una cuadrilla guardada. */
export function borradorDe(c: CuadrillaCompleta | null): Borrador {
  if (!c) return { nombre: "", tipo_operativo: "", cantidad: 3, vehiculo: "", notas: "", lat: "", lon: "", integrantes: ajustarFilas([], 3, nuevaClave), equipamiento: [] };
  const filas: FilaIntegrante[] = c.integrantes.map((i) => ({ clave: nuevaClave(), id: i.id, usuario_id: i.usuario_id, rol_operativo: i.rol_operativo, profesion: i.profesion, es_encargado: i.es_encargado }));
  return {
    nombre: c.nombre,
    tipo_operativo: c.tipo_operativo,
    cantidad: c.cantidad_integrantes || filas.length,
    vehiculo: c.vehiculo ?? "",
    notas: c.notas ?? "",
    lat: c.base ? String(c.base.lat) : "",
    lon: c.base ? String(c.base.lon) : "",
    integrantes: filas,
    equipamiento: [...c.equipamiento],
  };
}

/**
 * Alta y edición de una cuadrilla en cuatro pasos: datos, integrantes (rol y profesión de cada uno, un encargado),
 * equipamiento (prellenado según el tipo de operativo) y resumen. Las personas se identifican por rol y profesión.
 */
export function AsistenteCuadrilla({ abierto, inicial, alCerrar, alGuardar }: { abierto: boolean; inicial: CuadrillaCompleta | null; alCerrar: () => void; alGuardar: (c: CuadrillaCompleta | null) => void }) {
  const toast = useToast();
  const edicion = inicial !== null;
  const [paso, setPaso] = useState(0);
  const [b, setB] = useState<Borrador>(() => borradorDe(inicial));
  const [errores, setErrores] = useState<Errores>({});
  const [errorApi, setErrorApi] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);
  const [plantillas, setPlantillas] = useState(() => normalizarPlantillas(null));
  const [roles, setRoles] = useState<{ codigo: string; nombre: string }[]>(Object.entries(ROL_OPERATIVO).map(([codigo, nombre]) => ({ codigo, nombre })));
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [equipTocado, setEquipTocado] = useState(edicion);
  const [extra, setExtra] = useState("");
  const original = useRef(inicial);

  useEffect(() => {
    if (!abierto) return;
    let activo = true;
    void api
      .plantillasCuadrilla()
      .then((p) => activo && setPlantillas(normalizarPlantillas(p)))
      .catch(() => undefined);
    void api
      .rolesOperativos()
      .then((r) => activo && r.roles.length > 0 && setRoles(r.roles))
      .catch(() => undefined);
    void api
      .usuarios()
      .then((u) => activo && setCandidatos(u.filter((x) => x.rol === "cuadrilla" && x.estado === "activo").map((x) => ({ id: x.id, nombre: x.nombre_visible, rol_operativo: x.rol_operativo }))))
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [abierto]);

  const plantilla = b.tipo_operativo ? plantillas[b.tipo_operativo as TipoOperativo] : undefined;

  // El equipamiento sigue a la plantilla del tipo mientras nadie lo haya tocado a mano.
  useEffect(() => {
    if (equipTocado || !plantilla) return;
    setB((x) => (x.equipamiento.join("|") === plantilla.equipamiento.join("|") ? x : { ...x, equipamiento: [...plantilla.equipamiento] }));
  }, [plantilla, equipTocado]);

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((x) => ({ ...x, [k]: v }));
  const setFila = (clave: string, cambios: Partial<FilaIntegrante>) => setB((x) => ({ ...x, integrantes: x.integrantes.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)) }));

  function cambiarCantidad(txt: string) {
    const n = Number(txt);
    setB((x) => {
      const cantidad = Number.isFinite(n) ? n : 0;
      return { ...x, cantidad, integrantes: Number.isInteger(cantidad) && cantidad >= 0 && cantidad <= MAX_INTEGRANTES ? ajustarFilas(x.integrantes, cantidad, nuevaClave) : x.integrantes };
    });
  }

  function validar(p: number): Errores {
    if (p === 0) return validarDatos(b);
    if (p === 1) return validarIntegrantes(b);
    if (p === 2) return validarEquipamiento(b);
    return {};
  }

  // Tras un intento fallido, cada cambio revalida el paso actual: un error desaparece apenas el campo queda bien.
  useEffect(() => {
    setErrores((e) => (hayErrores(e) ? validar(paso) : e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b, paso]);

  function siguiente() {
    const e = validar(paso);
    setErrores(e);
    if (!hayErrores(e)) setPaso((p) => Math.min(PASOS.length - 1, p + 1));
  }

  function atras() {
    setErrores({});
    setPaso((p) => Math.max(0, p - 1));
  }

  async function guardar() {
    const e = { ...validarDatos(b), ...validarIntegrantes(b), ...validarEquipamiento(b) };
    if (hayErrores(e)) {
      setErrores(e);
      setPaso(hayErrores(validarDatos(b)) ? 0 : hayErrores(validarIntegrantes(b)) ? 1 : 2);
      return;
    }
    setErrorApi(null);
    setEnviando(true);
    const cuerpo = {
      nombre: b.nombre.trim(),
      tipo_operativo: b.tipo_operativo as TipoOperativo,
      tipo_incidente: incidenteDe(b.tipo_operativo as TipoOperativo),
      cantidad_integrantes: b.cantidad,
      vehiculo: b.vehiculo || null,
      equipamiento: b.equipamiento.map((x) => x.trim()).filter(Boolean),
      base: puntoDe(b),
      notas: b.notas.trim() || null,
    };
    try {
      if (!edicion) {
        const c = await api.crearCuadrillaCompleta({ ...cuerpo, integrantes: integrantesDe(b) });
        toast({ title: "Cuadrilla creada", description: cuerpo.nombre, status: "success", duration: 3000 });
        alGuardar(c);
      } else {
        const ant = original.current as CuadrillaCompleta;
        // Primero los integrantes (el servidor sube `cantidad_integrantes` al sumar y la baja al quitar) y después los datos.
        await sincronizarIntegrantes(ant, b);
        await api.editarCuadrilla(ant.id, cuerpo);
        toast({ title: "Cambios guardados", description: cuerpo.nombre, status: "success", duration: 3000 });
        alGuardar(null);
      }
    } catch (x) {
      setErrorApi(x);
    } finally {
      setEnviando(false);
    }
  }

  const cantidadPuesta = b.integrantes.length;
  const usadas = useMemo(() => new Set(b.integrantes.map((f) => f.usuario_id).filter((x): x is number => x !== null)), [b.integrantes]);
  const sugeridas = plantilla?.profesiones ?? [];

  return (
    <Modal isOpen={abierto} onClose={alCerrar} size="4xl" scrollBehavior="inside" closeOnOverlayClick={false}>
      <ModalOverlay />
      <ModalContent mx={{ base: 2, md: 4 }} data-testid="asistente-cuadrilla">
        <ModalHeader pb={2}>
          {edicion ? "Editar cuadrilla" : "Nueva cuadrilla"}
          <Flex as="ol" listStyleType="none" m={0} mt={3} p={0} gap={{ base: 1, md: 2 }} wrap="wrap" aria-label="Pasos">
            {PASOS.map((n, i) => (
              <Box
                as="li"
                key={n}
                aria-current={i === paso ? "step" : undefined}
                fontSize="rotulo"
                fontWeight={i === paso ? 700 : 500}
                color={i === paso ? "agua.700" : "textoSuave"}
                px={3}
                py={1}
                borderRadius="full"
                border="1px solid"
                borderColor={i === paso ? "agua.700" : "borde"}
                bg={i === paso ? "agua.50" : "transparent"}
              >
                {`Paso ${i + 1}: ${n}`}
              </Box>
            ))}
          </Flex>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Box mb={3}>
            <Insignia categoria="SIMULADO" />
          </Box>

          {paso === 0 && (
            <Flex direction="column" gap={4} data-testid="paso-datos">
              <Campo id="asi-nombre" etiqueta="Nombre de la cuadrilla" value={b.nombre} onChange={(e) => set("nombre", e.target.value)} error={errores.nombre} ayuda="Sin nombres de personas. Ejemplo: Cuadrilla Costa Norte." isRequired />
              <FormControl isInvalid={!!errores.tipo_operativo} as="fieldset" border="0" p={0} m={0}>
                <FormLabel as="legend" mb={2}>
                  Tipo de operativo
                </FormLabel>
                <RadioGroup value={b.tipo_operativo} onChange={(v) => set("tipo_operativo", v as TipoOperativo)}>
                  <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }} gap={2}>
                    {TIPOS_OPERATIVO.map((t) => (
                      <Box key={t.id} p={3} minH="2.75rem" borderRadius="lg" border="1px solid" borderColor={b.tipo_operativo === t.id ? "primario" : "bordeControl"} bg={b.tipo_operativo === t.id ? "suave" : "superficie"}>
                        <Radio value={t.id} alignItems="flex-start" spacing={3}>
                          <Text fontWeight={600} lineHeight="1.3">
                            {t.nombre}
                          </Text>
                          <Text textStyle="microdato">{t.descripcion}</Text>
                        </Radio>
                      </Box>
                    ))}
                  </Box>
                </RadioGroup>
                {errores.tipo_operativo && <FormErrorMessage>{errores.tipo_operativo}</FormErrorMessage>}
              </FormControl>
              <Flex gap={4} wrap="wrap">
                <Box flex="1 1 10rem">
                  <Campo
                    id="asi-cantidad"
                    etiqueta="Cantidad de integrantes"
                    type="number"
                    inputMode="numeric"
                    value={String(b.cantidad)}
                    onChange={(e) => cambiarCantidad(e.target.value)}
                    error={errores.cantidad}
                    ayuda={`De 1 a ${MAX_INTEGRANTES}. En el paso 2 se carga una fila por integrante.`}
                    isRequired
                  />
                </Box>
                <FormControl flex="1 1 12rem">
                  <FormLabel htmlFor="asi-vehiculo">Vehículo</FormLabel>
                  <Select id="asi-vehiculo" bg="superficie" value={b.vehiculo} placeholder="Sin vehículo" onChange={(e) => set("vehiculo", e.target.value)}>
                    {Object.keys(VEHICULOS).map((v) => (
                      <option key={v} value={v}>
                        {etiquetaVehiculo(v)}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </Flex>
              <Box as="fieldset" border="0" p={0} m={0}>
                <Text as="legend" fontWeight={600} mb={1}>
                  Base de la cuadrilla (opcional)
                </Text>
                <Text textStyle="microdato" mb={2}>
                  Desde dónde sale la cuadrilla. Tocá el mapa o escribí las coordenadas.
                </Text>
                <MapaUbicacion lon={b.lon} lat={b.lat} onChange={(p) => setB((x) => ({ ...x, lat: String(p.lat), lon: String(p.lon) }))} alto="16rem" estado={false} leyenda={false} />
                <Flex gap={3} mt={3} wrap="wrap">
                  <Box flex="1 1 9rem">
                    <Campo id="asi-lat" etiqueta="Latitud" inputMode="decimal" value={b.lat} onChange={(e) => set("lat", e.target.value)} error={errores.base} />
                  </Box>
                  <Box flex="1 1 9rem">
                    <Campo id="asi-lon" etiqueta="Longitud" inputMode="decimal" value={b.lon} onChange={(e) => set("lon", e.target.value)} />
                  </Box>
                </Flex>
              </Box>
              <FormControl isInvalid={!!errores.notas}>
                <FormLabel htmlFor="asi-notas">Notas (opcional)</FormLabel>
                <Textarea id="asi-notas" bg="superficie" rows={3} value={b.notas} onChange={(e) => set("notas", e.target.value)} />
                {errores.notas ? <FormErrorMessage>{errores.notas}</FormErrorMessage> : <FormHelperText>{b.notas.length}/500</FormHelperText>}
              </FormControl>
            </Flex>
          )}

          {paso === 1 && (
            <Box data-testid="paso-integrantes">
              <Text mb={1}>
                Equipo interdisciplinario: cada integrante lleva un rol operativo y una profesión. Hay {cantidadPuesta} {cantidadPuesta === 1 ? "fila" : "filas"}, una por integrante.
              </Text>
              {sugeridas.length > 0 && (
                <Text textStyle="microdato" mb={3} data-testid="profesiones-sugeridas">
                  Para un operativo de {etiquetaTipoOperativo(b.tipo_operativo).toLowerCase()} se sugieren: {sugeridas.map((p) => etiquetaProfesion(p)).join(", ")}.
                </Text>
              )}
              {errores.encargado && (
                <Text role="alert" color="alerta.700" fontWeight={600} mb={2}>
                  {errores.encargado}
                </Text>
              )}
              {errores.cuentas && (
                <Text role="alert" color="alerta.700" fontWeight={600} mb={2}>
                  {errores.cuentas}
                </Text>
              )}
              <RadioGroup value={b.integrantes.find((f) => f.es_encargado)?.clave ?? ""} onChange={(clave) => setB((x) => ({ ...x, integrantes: x.integrantes.map((f) => ({ ...f, es_encargado: f.clave === clave })) }))}>
                <Box as="ol" listStyleType="none" m={0} p={0} display="flex" flexDirection="column" gap={3}>
                  {b.integrantes.map((f, i) => {
                    const idb = `asi-int-${f.clave}`;
                    return (
                      <Box as="li" key={f.clave} p={3} borderRadius="lg" border="1px solid" borderColor="borde" bg="superficie" data-testid="fila-integrante">
                        <Flex align="center" justify="space-between" gap={2} mb={2} wrap="wrap">
                          <Text fontWeight={700}>Integrante {i + 1}</Text>
                          <Radio value={f.clave}>
                            Encargado<VisuallyHidden> (integrante {i + 1})</VisuallyHidden>
                          </Radio>
                        </Flex>
                        <Box display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" }} gap={3}>
                          <FormControl isInvalid={!!errores[`fila-${f.clave}-rol`]}>
                            <FormLabel htmlFor={`${idb}-rol`} textStyle="rotulo" color="texto">
                              Rol operativo
                            </FormLabel>
                            <Select id={`${idb}-rol`} bg="superficie" placeholder="Elegí un rol" value={f.rol_operativo} onChange={(e) => setFila(f.clave, { rol_operativo: e.target.value })}>
                              {roles.map((r) => (
                                <option key={r.codigo} value={r.codigo}>
                                  {r.nombre}
                                </option>
                              ))}
                            </Select>
                            <FormErrorMessage>{errores[`fila-${f.clave}-rol`]}</FormErrorMessage>
                          </FormControl>
                          <FormControl isInvalid={!!errores[`fila-${f.clave}-profesion`]}>
                            <FormLabel htmlFor={`${idb}-prof`} textStyle="rotulo" color="texto">
                              Profesión
                            </FormLabel>
                            <Select id={`${idb}-prof`} bg="superficie" placeholder="Elegí una profesión" value={f.profesion} onChange={(e) => setFila(f.clave, { profesion: e.target.value })}>
                              {sugeridas.length > 0 && (
                                <optgroup label="Sugeridas para este operativo">
                                  {sugeridas.filter((p) => p in PROFESIONES).map((p) => (
                                    <option key={`s-${p}`} value={p}>
                                      {etiquetaProfesion(p)}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <optgroup label="Todas">
                                {Object.entries(PROFESIONES).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </optgroup>
                            </Select>
                            <FormErrorMessage>{errores[`fila-${f.clave}-profesion`]}</FormErrorMessage>
                          </FormControl>
                          <FormControl>
                            <FormLabel htmlFor={`${idb}-cuenta`} textStyle="rotulo" color="texto">
                              Cuenta institucional (opcional)
                            </FormLabel>
                            <Select
                              id={`${idb}-cuenta`}
                              bg="superficie"
                              placeholder="Sin cuenta vinculada"
                              value={f.usuario_id ?? ""}
                              onChange={(e) => setFila(f.clave, { usuario_id: e.target.value ? Number(e.target.value) : null })}
                            >
                              {candidatos
                                .filter((c) => c.id === f.usuario_id || !usadas.has(c.id))
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.nombre}
                                    {c.rol_operativo ? ` (${etiquetaRolOperativo(c.rol_operativo)})` : ""}
                                  </option>
                                ))}
                            </Select>
                          </FormControl>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </RadioGroup>
            </Box>
          )}

          {paso === 2 && (
            <Box data-testid="paso-equipamiento">
              <Text mb={3}>
                Equipamiento sugerido para un operativo de {etiquetaTipoOperativo(b.tipo_operativo).toLowerCase()}. Destildá lo que no lleva y sumá lo que falte.
              </Text>
              <Box as="ul" listStyleType="none" m={0} p={0} display="grid" gridTemplateColumns={{ base: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }} gap={2}>
                {Array.from(new Set([...(plantilla?.equipamiento ?? []), ...b.equipamiento])).map((item) => (
                  <Box as="li" key={item}>
                    <Opcion
                      etiqueta={item}
                      isChecked={b.equipamiento.includes(item)}
                      onChange={(marcado) => {
                        setEquipTocado(true);
                        set("equipamiento", marcado ? [...b.equipamiento, item] : b.equipamiento.filter((x) => x !== item));
                      }}
                    />
                  </Box>
                ))}
              </Box>
              {errores.equipamiento && (
                <Text role="alert" color="alerta.700" fontWeight={600} mt={2}>
                  {errores.equipamiento}
                </Text>
              )}
              <Flex as="form" gap={2} mt={4} align="flex-end" onSubmit={(e: React.FormEvent) => {
                e.preventDefault();
                const v = extra.trim();
                if (v && !b.equipamiento.some((x) => x.toLowerCase() === v.toLowerCase())) {
                  setEquipTocado(true);
                  set("equipamiento", [...b.equipamiento, v]);
                }
                setExtra("");
              }}>
                <FormControl flex="1">
                  <FormLabel htmlFor="asi-extra" textStyle="rotulo" color="texto">
                    Otro equipamiento
                  </FormLabel>
                  <Input id="asi-extra" bg="superficie" value={extra} maxLength={60} placeholder="Ejemplo: cuerda de arrastre" onChange={(e) => setExtra(e.target.value)} />
                </FormControl>
                <Button type="submit" variant="outline" {...TACTIL} leftIcon={<IconoMas tam="1rem" />} isDisabled={extra.trim() === ""}>
                  Sumar
                </Button>
              </Flex>
            </Box>
          )}

          {paso === 3 && (
            <Box data-testid="paso-resumen">
              <Text fontWeight={700} fontSize="lg" mb={2}>
                {b.nombre.trim()}
              </Text>
              <Box as="dl" display="grid" gridTemplateColumns={{ base: "1fr", sm: "11rem 1fr" }} gap={1} columnGap={4}>
                <dt>Tipo de operativo</dt>
                <dd>{etiquetaTipoOperativo(b.tipo_operativo)}</dd>
                <dt>Integrantes</dt>
                <dd>{b.cantidad}</dd>
                <dt>Vehículo</dt>
                <dd>{etiquetaVehiculo(b.vehiculo) ?? "Sin vehículo"}</dd>
                <dt>Base</dt>
                <dd>{puntoDe(b) ? `${Number(puntoDe(b)?.lat).toFixed(4)}, ${Number(puntoDe(b)?.lon).toFixed(4)}` : "Sin base"}</dd>
                <dt>Equipamiento</dt>
                <dd>{b.equipamiento.length ? b.equipamiento.join(", ") : "Sin equipamiento"}</dd>
                {b.notas.trim() && (
                  <>
                    <dt>Notas</dt>
                    <dd>{b.notas.trim()}</dd>
                  </>
                )}
              </Box>
              <Box as="ul" listStyleType="none" m={0} mt={4} p={0} display="flex" flexDirection="column" gap={1}>
                {b.integrantes.map((f, i) => (
                  <Box as="li" key={f.clave}>
                    <strong>Integrante {i + 1}:</strong> {etiquetaRolOperativo(f.rol_operativo)}, {etiquetaProfesion(f.profesion)}
                    {f.es_encargado ? " (encargado)" : ""}
                  </Box>
                ))}
              </Box>
              <Box mt={4}>
                <AlertaError error={errorApi} />
              </Box>
            </Box>
          )}
        </ModalBody>
        <ModalFooter gap={2} flexWrap="wrap" justifyContent="space-between">
          <Button variant="ghost" {...TACTIL} onClick={alCerrar}>
            Cancelar
          </Button>
          <Flex gap={2}>
            {paso > 0 && (
              <Button variant="outline" {...TACTIL} onClick={atras}>
                Atrás
              </Button>
            )}
            {paso < PASOS.length - 1 ? (
              <Button {...TACTIL} onClick={siguiente}>
                Siguiente
              </Button>
            ) : (
              <Button {...TACTIL} onClick={() => void guardar()} isLoading={enviando} loadingText="Guardando">
                {edicion ? "Guardar cambios" : "Crear cuadrilla"}
              </Button>
            )}
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/**
 * Lleva los integrantes del servidor a lo que quedó en el borrador. Las bajas usan el id del INTEGRANTE (no el del
 * usuario). Orden: primero el encargado nuevo (alta o cambio), para que la baja del anterior no choque con el 409
 * «es el encargado»; después bajas, cambios y altas.
 */
export async function sincronizarIntegrantes(ant: CuadrillaCompleta, b: Borrador): Promise<void> {
  const conId = new Set(b.integrantes.filter((f) => f.id !== null).map((f) => f.id));
  const previos = new Map(ant.integrantes.map((i) => [i.id, i]));
  const cambios = b.integrantes.filter((f) => {
    const p = f.id !== null ? previos.get(f.id) : undefined;
    return p && (p.rol_operativo !== f.rol_operativo || p.profesion !== f.profesion || p.usuario_id !== f.usuario_id || p.es_encargado !== f.es_encargado);
  });
  const bajas = ant.integrantes.filter((i) => !conId.has(i.id));
  const nuevos = b.integrantes.filter((f) => f.id === null);
  const cuerpo = (f: FilaIntegrante) => ({ usuario_id: f.usuario_id, rol_operativo: f.rol_operativo, profesion: f.profesion, es_encargado: f.es_encargado });
  const encargadoNuevo = nuevos.find((f) => f.es_encargado);
  const encargadoCambiado = cambios.find((f) => f.es_encargado);
  const hechos = new Set<FilaIntegrante>();
  if (encargadoNuevo) {
    await api.sumarIntegrante(ant.id, cuerpo(encargadoNuevo));
    hechos.add(encargadoNuevo);
  } else if (encargadoCambiado) {
    await api.editarIntegrante(ant.id, encargadoCambiado.id as number, cuerpo(encargadoCambiado));
    hechos.add(encargadoCambiado);
  }
  for (const i of bajas) await api.borrarIntegrante(ant.id, i.id);
  for (const f of cambios) if (!hechos.has(f)) await api.editarIntegrante(ant.id, f.id as number, cuerpo(f));
  for (const f of nuevos) if (!hechos.has(f)) await api.sumarIntegrante(ant.id, cuerpo(f));
}
