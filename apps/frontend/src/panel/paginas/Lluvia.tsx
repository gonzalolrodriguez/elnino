import { Alert, AlertIcon, Box, Button, Flex, FormControl, FormErrorMessage, FormHelperText, FormLabel, Input, Table, Tbody, Td, Text, Th, Thead, Tr, useToast } from "@chakra-ui/react";
import { useRef, useState } from "react";

import { AlertaError, CampoSelect } from "../../components/Formulario";
import { IconoGota } from "../../components/iconos/Iconos";
import { Insignia } from "../../components/Insignia";
import { Opcion } from "../../components/Opcion";
import { TablaDesplazable } from "../../components/TablaDesplazable";
import { etiquetaOrigenLluvia } from "../../lib/etiquetas";
import { useCarga } from "../../lib/useCarga";
import { api, descargar, guardarArchivo, importarPlanilla } from "../api";
import { CabeceraPagina } from "../CabeceraPagina";
import { APILAR, AvisoSimulado, Cargando, categoriaComun, fmtFecha, fmtNum, Seccion } from "../ui";

type Origen = "carga_manual" | "parte_policial" | "simulado";

/** Rejilla de campos de 44 px que se reacomoda sola: una columna en el celular, hasta cinco en escritorio. */
const REJILLA = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(10.5rem, 1fr))", columnGap: 4, rowGap: 4, alignItems: "start" } as const;

function FormParte({ alCargar }: { alCargar: () => void }) {
  const puestos = useCarga(() => api.puestos());
  const toast = useToast();
  const [puesto, setPuesto] = useState("");
  const [fecha, setFecha] = useState("2026-10-31");
  const [turno, setTurno] = useState<"07" | "17">("07");
  const [mm, setMm] = useState("");
  const [sinMedicion, setSinMedicion] = useState(false);
  const [origen, setOrigen] = useState<Origen>("simulado");
  const [error, setError] = useState<unknown>(null);
  const [errorMm, setErrorMm] = useState<string | null>(null);
  const [advertencias, setAdvertencias] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdvertencias([]);
    const valor = sinMedicion ? null : Number(mm.replace(",", "."));
    if (!sinMedicion && (mm.trim() === "" || Number.isNaN(valor) || (valor as number) < 0 || (valor as number) > 500)) {
      setErrorMm("Ingresá los milímetros (0 a 500) o marcá «sin medición». Una celda vacía no es lo mismo que 0.");
      return;
    }
    setErrorMm(null);
    if (!puesto) {
      setError(new Error("Elegí un puesto pluviométrico."));
      return;
    }
    setGuardando(true);
    try {
      const r = await api.cargarLluvia({ puesto, fecha, turno, mm: valor, origen });
      setAdvertencias(r.advertencias ?? []);
      toast({ title: "Parte de lluvia cargado", status: "success", duration: 4000 });
      alCargar();
    } catch (err) {
      setError(err);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Box as="form" onSubmit={(e: React.FormEvent) => void enviar(e)} noValidate>
      <Box {...REJILLA} sx={{ "& > :first-of-type": { gridColumn: { md: "span 2" } } }}>
        <CampoSelect id="parte-puesto" etiqueta="Puesto" value={puesto} onChange={(e) => setPuesto(e.target.value)}>
          <option value="">Elegí un puesto</option>
          {(puestos.datos?.puestos ?? []).map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.nombre} ({p.codigo})
            </option>
          ))}
        </CampoSelect>
        <FormControl>
          <FormLabel htmlFor="parte-fecha">Fecha</FormLabel>
          <Input id="parte-fecha" type="date" bg="superficie" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </FormControl>
        <CampoSelect id="parte-turno" etiqueta="Turno" value={turno} onChange={(e) => setTurno(e.target.value as "07" | "17")}>
          <option value="07">07:00</option>
          <option value="17">17:00</option>
        </CampoSelect>
        <FormControl isInvalid={!!errorMm} isDisabled={sinMedicion}>
          <FormLabel htmlFor="parte-mm">Lluvia (mm)</FormLabel>
          <Input id="parte-mm" bg="superficie" inputMode="decimal" autoComplete="off" value={mm} onChange={(e) => setMm(e.target.value)} />
          {errorMm && <FormErrorMessage>{errorMm}</FormErrorMessage>}
        </FormControl>
        <CampoSelect id="parte-origen" etiqueta="Origen" value={origen} onChange={(e) => setOrigen(e.target.value as Origen)}>
          <option value="simulado">{etiquetaOrigenLluvia("simulado")}</option>
          <option value="carga_manual">{etiquetaOrigenLluvia("carga_manual")}</option>
          <option value="parte_policial">{etiquetaOrigenLluvia("parte_policial")}</option>
        </CampoSelect>
      </Box>
      <Flex gap={4} wrap="wrap" align="center" mt={4}>
        <Box w={{ base: "100%", md: "16rem" }}>
          <Opcion etiqueta="Sin medición" isChecked={sinMedicion} onChange={setSinMedicion} id="parte-sin-medicion" />
        </Box>
        <Button type="submit" isLoading={guardando}>
          Cargar parte
        </Button>
      </Flex>
      <Text textStyle="microdato" mt={3} maxW="70ch">
        Un parte real posterior al corte (31/10/2026) se rechaza salvo decisión de la mesa; para pruebas usá el origen «Simulado».
      </Text>
      <Box mt={2}>
        <AlertaError error={error} />
        {advertencias.map((a) => (
          <Alert key={a} status="warning" mt={2}>
            <AlertIcon />
            {a}
          </Alert>
        ))}
      </Box>
    </Box>
  );
}

function PlanillaUPCA({ alImportar }: { alImportar: () => void }) {
  const toast = useToast();
  const entrada = useRef<HTMLInputElement>(null);
  const [anio, setAnio] = useState("2026");
  const [archivo, setArchivo] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [ocupado, setOcupado] = useState(false);

  async function importar(f: File | undefined) {
    if (!f) return;
    setError(null);
    setOcupado(true);
    try {
      const r = await importarPlanilla(f);
      setArchivo(f.name);
      toast({ title: "Planilla importada", description: `${r.insertadas} lecturas nuevas.`, status: "success", duration: 4000 });
      alImportar();
    } catch (e) {
      setError(e);
    } finally {
      setOcupado(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function exportar() {
    setError(null);
    try {
      guardarArchivo(await descargar(`/lluvia/exportar?anio_hidrologico=${encodeURIComponent(anio)}`), `lluvia_${anio}-${Number(anio) + 1}.xlsx`);
    } catch (e) {
      setError(e);
    }
  }

  return (
    <Box>
      <Box {...REJILLA}>
        <FormControl>
          <FormLabel htmlFor="planilla-boton">Importar planilla UPCA</FormLabel>
          {/* El selector nativo de archivos no se puede estilizar: queda oculto y lo abre un botón del tema. */}
          <input id="planilla-archivo" ref={entrada} type="file" accept=".xlsx" hidden disabled={ocupado} aria-label="Importar planilla UPCA (.xlsx, hasta 5 MB)" onChange={(e) => void importar(e.target.files?.[0])} />
          <Button id="planilla-boton" variant="outline" w="100%" isLoading={ocupado} loadingText="Importando" onClick={() => entrada.current?.click()}>
            Elegir planilla (.xlsx)
          </Button>
          <FormHelperText>{archivo ? `Última importada: ${archivo}` : "Hasta 5 MB. Se importa al elegirla."}</FormHelperText>
        </FormControl>
        <FormControl>
          <FormLabel htmlFor="planilla-anio">Año hidrológico</FormLabel>
          <Input id="planilla-anio" bg="superficie" inputMode="numeric" value={anio} onChange={(e) => setAnio(e.target.value)} />
          <FormHelperText>Va de septiembre a agosto.</FormHelperText>
        </FormControl>
      </Box>
      <Button mt={4} variant="outline" onClick={() => void exportar()} isDisabled={!/^\d{4}$/.test(anio)}>
        Exportar a Excel
      </Button>
      <Text textStyle="microdato" mt={3} maxW="70ch">
        La celda vacía de la planilla significa «sin medición» y no se guarda como 0.
      </Text>
      <Box mt={2}>
        <AlertaError error={error} />
      </Box>
    </Box>
  );
}

export default function Lluvia() {
  const lecturas = useCarga(() => api.lluvia(100));
  return (
    <>
      <CabeceraPagina
        titulo="Partes de lluvia"
        icono={<IconoGota tam="1.5rem" />}
        ayuda="Cargá los partes de los puestos pluviométricos o importá la planilla UPCA, y revisá lo último que llegó. Una celda vacía es «sin medición», no cero."
      />
      <AvisoSimulado>El kit no tiene lluvia observada. Los puestos son lugares reales (DOCUMENTO DE REFERENCIA); las lecturas de demostración son SIMULADO y cada una muestra su origen.</AvisoSimulado>
      <Seccion titulo="Cargar un parte" id="sec-parte" sinCategoria>
        <FormParte alCargar={lecturas.recargar} />
      </Seccion>
      <Seccion titulo="Planilla UPCA" id="sec-planilla" sinCategoria>
        <PlanillaUPCA alImportar={lecturas.recargar} />
      </Seccion>
      <Seccion titulo="Últimas lecturas" id="sec-lecturas" sinCategoria>
        <Cargando
          carga={lecturas}
          esVacio={(l) => l.n === 0}
          vacio="Todavía no hay lecturas. Cargá un parte o importá la planilla."
          hijos={(l) => {
            const comun = categoriaComun(l.lecturas.map((x) => x.categoria));
            return (
              <>
                {comun && (
                  <Flex align="center" gap={2} mb={3}>
                    <Text textStyle="rotulo">Categoría de las lecturas:</Text>
                    <Insignia categoria={comun} />
                  </Flex>
                )}
                <TablaDesplazable etiqueta="Últimas lecturas de lluvia" maxH="20rem" overflowY="auto">
                  <Table size="sm" aria-label="Últimas lecturas de lluvia" sx={APILAR}>
                    <Thead position="sticky" top={0} bg="superficie">
                      <Tr>
                        <Th>Fecha</Th>
                        <Th>Turno</Th>
                        <Th>Puesto</Th>
                        <Th isNumeric>Lluvia</Th>
                        <Th>Origen</Th>
                        {!comun && <Th>Categoría</Th>}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {l.lecturas.map((x) => (
                        <Tr key={x.id}>
                          <Td>{fmtFecha(x.fecha)}</Td>
                          <Td data-etiqueta="Turno">{x.turno}:00</Td>
                          <Td data-etiqueta="Puesto">{x.puesto_nombre}</Td>
                          <Td isNumeric data-etiqueta="Lluvia">
                            {x.mm === null ? "sin medición" : `${fmtNum(x.mm, 1)} mm`}
                          </Td>
                          <Td data-etiqueta="Origen">{etiquetaOrigenLluvia(x.origen)}</Td>
                          {!comun && (
                            <Td data-etiqueta="Categoría">
                              <Insignia categoria={x.categoria} />
                            </Td>
                          )}
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TablaDesplazable>
              </>
            );
          }}
        />
      </Seccion>
    </>
  );
}
