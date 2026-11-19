import { Redirect } from "expo-router";
import { useState } from "react";
import { Switch, Text, View } from "react-native";

import { EnlaceConexion } from "@/components/EnlaceConexion";
import { Boton, Campo, COLOR, ErrorCaja, Opcion, Opciones, Pantalla, Subtitulo, Texto, Titulo } from "@/components/ui";
import { obtenerUbicacion, type Coordenadas } from "@/lib/dispositivo";
import { esErrorConexion, mensajeError } from "@/lib/errores";
import { api, type ItemStock } from "@/lib/servicios";
import { useSesion } from "@/lib/SesionContext";

type TipoCuenta = "ciudadano" | "productor";

const entero = (v: string, por: number): number => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : por;
};

export default function Registro() {
  const { estado, entrar } = useSesion();
  const [tipo, setTipo] = useState<TipoCuenta>("ciudadano");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [integrantes, setIntegrantes] = useState("1");
  const [menores, setMenores] = useState("0");
  const [mayores, setMayores] = useState("0");
  const [mascotas, setMascotas] = useState("0");
  const [telefono, setTelefono] = useState("");
  const [nombreEst, setNombreEst] = useState("");
  const [especie, setEspecie] = useState("bovino");
  const [categoriaAnimal, setCategoriaAnimal] = useState("vaca con cría");
  const [cantidad, setCantidad] = useState("");
  const [ubicacion, setUbicacion] = useState<Coordenadas | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallaConexion, setFallaConexion] = useState(false);

  if (estado.tipo === "autenticado") return <Redirect href="/(app)" />;

  const usarUbicacion = async () => {
    setError(null);
    const r = await obtenerUbicacion();
    if (r.ok) setUbicacion(r.coordenadas);
    else setError("No se pudo obtener la ubicación. Revisá el permiso de ubicación del teléfono.");
  };

  const faltantes: string[] = [];
  if (!email.trim()) faltantes.push("correo");
  if (password.length < 10) faltantes.push("contraseña de al menos 10 caracteres");
  if (nombre.trim().length < 2) faltantes.push("nombre");
  if (!consentimiento) faltantes.push("consentimiento");
  if (tipo === "productor" && (nombreEst.trim().length < 2 || !ubicacion)) {
    faltantes.push("establecimiento y ubicación de la tranquera");
  }

  const enviar = async () => {
    setError(null);
    setCargando(true);
    try {
      const base = {
        email: email.trim(),
        password,
        nombre_visible: nombre.trim(),
        consentimiento,
      };
      if (tipo === "ciudadano") {
        await api.registroCiudadano({
          ...base,
          integrantes: Math.max(entero(integrantes, 1), 1),
          menores: entero(menores, 0),
          mayores: entero(mayores, 0),
          mascotas: entero(mascotas, 0),
          telefono: telefono.trim() || undefined,
          ...(ubicacion ? { lon: ubicacion.lon, lat: ubicacion.lat } : {}),
        });
      } else {
        const stock: ItemStock[] =
          entero(cantidad, 0) > 0
            ? [{ especie: especie.trim(), categoria_animal: categoriaAnimal.trim(), cantidad: entero(cantidad, 0) }]
            : [];
        await api.registroProductor({
          ...base,
          establecimiento: {
            nombre: nombreEst.trim(),
            lon: ubicacion?.lon,
            lat: ubicacion?.lat,
            stock,
          },
        });
      }
      await entrar(email, password);
    } catch (e) {
      setFallaConexion(esErrorConexion(e));
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <Pantalla>
      <Titulo>Crear cuenta</Titulo>
      <Opciones>
        <Opcion titulo="Ciudadanía" elegida={tipo === "ciudadano"} onPress={() => setTipo("ciudadano")} />
        <Opcion titulo="Productor" elegida={tipo === "productor"} onPress={() => setTipo("productor")} />
      </Opciones>

      <Campo etiqueta="Nombre" value={nombre} onChangeText={setNombre} autoComplete="name" />
      <Campo
        etiqueta="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Campo
        etiqueta="Contraseña (mínimo 10 caracteres)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
      />

      {tipo === "ciudadano" ? (
        <>
          <Subtitulo>Grupo familiar</Subtitulo>
          <Texto suave>Podés completarlo o cambiarlo después en tu perfil.</Texto>
          <Campo etiqueta="Integrantes" value={integrantes} onChangeText={setIntegrantes} keyboardType="number-pad" />
          <Campo etiqueta="Menores" value={menores} onChangeText={setMenores} keyboardType="number-pad" />
          <Campo etiqueta="Mayores" value={mayores} onChangeText={setMayores} keyboardType="number-pad" />
          <Campo etiqueta="Mascotas" value={mascotas} onChangeText={setMascotas} keyboardType="number-pad" />
          <Campo etiqueta="Teléfono (opcional, se guarda cifrado)" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
        </>
      ) : (
        <>
          <Campo etiqueta="Nombre del establecimiento" value={nombreEst} onChangeText={setNombreEst} />
          <Subtitulo>Stock inicial</Subtitulo>
          <Texto suave>Opcional; podés editarlo después.</Texto>
          <Campo etiqueta="Especie" value={especie} onChangeText={setEspecie} />
          <Campo etiqueta="Categoría" value={categoriaAnimal} onChangeText={setCategoriaAnimal} />
          <Campo etiqueta="Cantidad" value={cantidad} onChangeText={setCantidad} keyboardType="number-pad" />
        </>
      )}

      <Boton
        titulo={
          ubicacion
            ? `Ubicación cargada (${ubicacion.lat.toFixed(4)}, ${ubicacion.lon.toFixed(4)})`
            : tipo === "productor"
              ? "Usar mi ubicación como tranquera"
              : "Usar mi ubicación como domicilio (opcional)"
        }
        variante="secundario"
        onPress={usarUbicacion}
      />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 }}>
        <Switch
          trackColor={{ true: COLOR.primario }}
          value={consentimiento}
          onValueChange={setConsentimiento}
          accessibilityLabel="Consentimiento informado"
        />
        <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: COLOR.suave }}>
          Acepto el tratamiento de mis datos personales con finalidad exclusiva de gestión de
          emergencias, con derecho de acceso, rectificación y supresión (Ley 25.326).
        </Text>
      </View>

      {error ? <ErrorCaja mensaje={error}>{fallaConexion ? <EnlaceConexion /> : null}</ErrorCaja> : null}
      {faltantes.length > 0 ? <Texto suave>Falta: {faltantes.join(", ")}.</Texto> : null}
      <Boton
        titulo="Crear cuenta"
        onPress={enviar}
        cargando={cargando}
        deshabilitado={faltantes.length > 0}
      />
    </Pantalla>
  );
}
