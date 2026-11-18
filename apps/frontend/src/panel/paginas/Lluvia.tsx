import { Alert, AlertIcon, Box, Button, Checkbox, Flex, FormControl, FormLabel, Heading, Input, Select, Text, useToast } from "@chakra-ui/react";
import { useRef, useState } from "react";

import { AlertaError } from "../../components/Formulario";
import { useCarga } from "../../lib/useCarga";
import { api, descargar, guardarArchivo, importarPlanilla } from "../api";
import { AvisoSimulado, Cargando, Seccion } from "../ui";

type Origen = "carga_manual" | "parte_policial" | "simulado";

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
      toast({ title: "Parte de lluvia cargado", status: "success", duration: 3000 });
      alCargar();
    } catch (err) {
      setError(err);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Box as="form" onSubmit={(e: React.FormEvent) => void enviar(e)} noValidate>
      <Flex gap={3} wrap="wrap" align="flex-end">
        <FormControl w="16rem">
          <FormLabel htmlFor="parte-puesto" fontSize="sm" mb={0}>
            Puesto
          </FormLabel>
          <Select id="parte-puesto" size="sm" bg="white" placeholder="Elegí un puesto" value={puesto} onChange={(e) => setPuesto(e.target.value)}>
            {(puestos.datos?.puestos ?? []).map((p) => (
              <option key={p.codigo} value={p.codigo}>
                {p.nombre} ({p.codigo})
              </option>
            ))}
          </Select>
        </FormControl>
        <FormControl w="9rem">
          <FormLabel htmlFor="parte-fecha" fontSize="sm" mb={0}>
            Fecha
          </FormLabel>
          <Input id="parte-fecha" type="date" size="sm" bg="white" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </FormControl>
        <FormControl w="6rem">
          <FormLabel htmlFor="parte-turno" fontSize="sm" mb={0}>
            Turno
          </FormLabel>
          <Select id="parte-turno" size="sm" bg="white" value={turno} onChange={(e) => setTurno(e.target.value as "07" | "17")}>
            <option value="07">07:00</option>
            <option value="17">17:00</option>
          </Select>
        </FormControl>
        <FormControl w="7rem" isInvalid={!!errorMm}>
          <FormLabel htmlFor="parte-mm" fontSize="sm" mb={0}>
            mm
          </FormLabel>
          <Input id="parte-mm" size="sm" bg="white" inputMode="decimal" value={mm} onChange={(e) => setMm(e.target.value)} isDisabled={sinMedicion} />
        </FormControl>
        <Checkbox size="sm" isChecked={sinMedicion} onChange={(e) => setSinMedicion(e.target.checked)}>
          Sin medición
        </Checkbox>
        <FormControl w="11rem">
          <FormLabel htmlFor="parte-origen" fontSize="sm" mb={0}>
            Origen
          </FormLabel>
          <Select id="parte-origen" size="sm" bg="white" value={origen} onChange={(e) => setOrigen(e.target.value as Origen)}>
            <option value="simulado">Simulado</option>
            <option value="carga_manual">Carga manual</option>
            <option value="parte_policial">Parte policial</option>
          </Select>
        </FormControl>
        <Button type="submit" size="sm" isLoading={guardando}>
          Cargar parte
        </Button>
      </Flex>
      {errorMm && (
        <Text role="alert" color="red.600" fontSize="sm" mt={1}>
          {errorMm}
        </Text>
      )}
      <Text fontSize="xs" color="pizarra.500" mt={1}>
        Un parte real posterior al corte (31/10/2026) se rechaza salvo decisión de la mesa; para pruebas usá el origen «Simulado».
      </Text>
      <Box mt={2}>
        <AlertaError error={error} />
        {advertencias.map((a) => (
          <Alert key={a} status="warning" mt={2} fontSize="sm">
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
  const [error, setError] = useState<unknown>(null);
  const [ocupado, setOcupado] = useState(false);

  async function importar(f: File | undefined) {
    if (!f) return;
    setError(null);
    setOcupado(true);
    try {
      const r = await importarPlanilla(f);
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
      <Flex gap={3} wrap="wrap" align="flex-end">
        <FormControl w="auto">
          <FormLabel htmlFor="planilla-archivo" fontSize="sm" mb={0}>
            Importar planilla UPCA (.xlsx, hasta 5 MB)
          </FormLabel>
          <input id="planilla-archivo" ref={entrada} type="file" accept=".xlsx" disabled={ocupado} onChange={(e) => void importar(e.target.files?.[0])} />
        </FormControl>
        <FormControl w="8rem">
          <FormLabel htmlFor="planilla-anio" fontSize="sm" mb={0}>
            Año hidrológico
          </FormLabel>
          <Input id="planilla-anio" size="sm" bg="white" inputMode="numeric" value={anio} onChange={(e) => setAnio(e.target.value)} />
        </FormControl>
        <Button size="sm" variant="outline" onClick={() => void exportar()} isDisabled={!/^\d{4}$/.test(anio)}>
          Exportar a Excel
        </Button>
      </Flex>
      <Text fontSize="xs" color="pizarra.500" mt={1}>
        La celda vacía de la planilla significa «sin medición» y no se guarda como 0. El año hidrológico va de septiembre a agosto.
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
      <Heading as="h1" size="lg" mb={4}>
        Partes de lluvia
      </Heading>
      <AvisoSimulado>El kit no tiene lluvia observada. Los puestos son lugares reales (DOCUMENTO DE REFERENCIA), pero las lecturas de demostración son SIMULADO; cada lectura muestra su origen.</AvisoSimulado>
      <Seccion titulo="Cargar un parte" id="sec-parte">
        <FormParte alCargar={lecturas.recargar} />
      </Seccion>
      <Seccion titulo="Planilla UPCA" id="sec-planilla">
        <PlanillaUPCA alImportar={lecturas.recargar} />
      </Seccion>
      <Seccion titulo="Últimas lecturas" id="sec-lecturas">
        <Cargando carga={lecturas} esVacio={(l) => l.n === 0} vacio="Todavía no hay lecturas. Cargá un parte o importá la planilla." hijos={(l) => (
          <Box as="ul" listStyleType="none" m={0} p={0} fontSize="sm" maxH="18rem" overflowY="auto">
            {l.lecturas.map((x) => (
              <li key={x.id}>
                {x.fecha} {x.turno} h · {x.puesto_nombre}: {x.mm === null ? "sin medición" : `${x.mm} mm`} · {x.origen.replace("_", " ")} · {x.categoria}
              </li>
            ))}
          </Box>
        )} />
      </Seccion>
    </>
  );
}
