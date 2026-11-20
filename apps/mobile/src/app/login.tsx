import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { EnlaceConexion } from "@/components/EnlaceConexion";
import { Disco } from "@/components/Piezas";
import { Boton, Campo, ErrorCaja, Pantalla, Texto, Titulo } from "@/components/ui";
import { ErrorApi } from "@/lib/api";
import { esErrorConexion, mensajeError } from "@/lib/errores";
import { useSesion } from "@/lib/SesionContext";

export default function Login() {
  const { estado, entrar } = useSesion();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fallaConexion, setFallaConexion] = useState(false);

  if (estado.tipo === "autenticado") return <Redirect href="/(app)" />;

  const enviar = async () => {
    setError(null);
    setFallaConexion(false);
    setCargando(true);
    try {
      await entrar(email, password);
    } catch (e) {
      setFallaConexion(esErrorConexion(e));
      setError(e instanceof ErrorApi && e.estado === 401 ? "Correo o contraseña incorrectos." : mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <Pantalla>
      <Disco tono="info" icono="persona" tam={48} />
      <Titulo>Ingresar</Titulo>
      <Texto suave>Con tu cuenta ves el estado de tu sector, tus pedidos y tus alertas.</Texto>
      <Campo
        etiqueta="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Campo
        etiqueta="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
      />
      {error ? <ErrorCaja mensaje={error}>{fallaConexion ? <EnlaceConexion /> : null}</ErrorCaja> : null}
      <Boton titulo="Ingresar" onPress={enviar} cargando={cargando} deshabilitado={!email.trim() || !password} />
      <View style={{ gap: 8, marginTop: 8 }}>
        <Texto suave>¿No tenés cuenta?</Texto>
        <Boton titulo="Registrarme" variante="secundario" onPress={() => router.push("/registro")} />
      </View>
    </Pantalla>
  );
}
