import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Boton, Campo, Cargando, COLOR, ErrorCaja, Subtitulo, Tarjeta, Texto, Vacio } from "@/components/ui";
import { mensajeError } from "@/lib/errores";
import { api, type Establecimiento, type ItemStock } from "@/lib/servicios";

type Fila = { especie: string; categoria_animal: string; cantidad: string };

function aFilas(stock: ItemStock[]): Fila[] {
  return stock.map((s) => ({ ...s, cantidad: String(s.cantidad) }));
}

function TarjetaEstablecimiento({ e }: { e: Establecimiento }) {
  const [filas, setFilas] = useState<Fila[]>(aFilas(e.stock));
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cambiar = (i: number, campo: keyof Fila, valor: string) =>
    setFilas((f) => f.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));

  const guardar = async () => {
    setError(null);
    setMensaje(null);
    const stock: ItemStock[] = [];
    for (const f of filas) {
      const cantidad = Number.parseInt(f.cantidad, 10);
      if (f.especie.trim().length < 2 || f.categoria_animal.trim().length < 2 || !Number.isFinite(cantidad) || cantidad < 0) {
        setError("Cada fila necesita especie, categoría y una cantidad válida.");
        return;
      }
      stock.push({ especie: f.especie.trim(), categoria_animal: f.categoria_animal.trim(), cantidad });
    }
    setGuardando(true);
    try {
      await api.guardarStock(e.id, stock);
      setMensaje("Stock guardado.");
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta>
      <Subtitulo>{e.nombre}</Subtitulo>
      <Texto suave>
        Tranquera: {e.lat.toFixed(5)}, {e.lon.toFixed(5)}
        {e.sector_id ? ` · sector ${e.sector_id}` : ""}
      </Texto>
      <Texto>Stock</Texto>
      {filas.length === 0 ? <Vacio texto="Sin stock cargado." /> : null}
      {filas.map((f, i) => (
        <View key={i} style={{ gap: 6, borderTopWidth: 1, borderTopColor: COLOR.borde, paddingTop: 12 }}>
          <Campo etiqueta="Especie" value={f.especie} onChangeText={(v) => cambiar(i, "especie", v)} />
          <Campo etiqueta="Categoría" value={f.categoria_animal} onChangeText={(v) => cambiar(i, "categoria_animal", v)} />
          <Campo etiqueta="Cantidad" value={f.cantidad} onChangeText={(v) => cambiar(i, "cantidad", v)} keyboardType="number-pad" />
          <Boton titulo="Quitar fila" variante="secundario" onPress={() => setFilas((x) => x.filter((_, j) => j !== i))} />
        </View>
      ))}
      <Boton
        titulo="Agregar fila de stock"
        variante="secundario"
        onPress={() => setFilas((x) => [...x, { especie: "bovino", categoria_animal: "", cantidad: "" }])}
      />
      {error ? <ErrorCaja mensaje={error} /> : null}
      {mensaje ? <Text style={{ color: COLOR.ok }}>{mensaje}</Text> : null}
      <Boton titulo="Guardar stock" onPress={guardar} cargando={guardando} />
    </Tarjeta>
  );
}

export function FormEstablecimientos() {
  const [lista, setLista] = useState<Establecimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setLista((await api.establecimientos()).establecimientos);
    } catch (e) {
      setError(mensajeError(e));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (error) return <ErrorCaja mensaje={error} onReintentar={cargar} />;
  if (lista === null) return <Cargando texto="Cargando establecimientos…" />;
  if (lista.length === 0) return <Vacio texto="No tenés establecimientos cargados." />;
  return (
    <>
      {lista.map((e) => (
        <TarjetaEstablecimiento key={e.id} e={e} />
      ))}
    </>
  );
}
