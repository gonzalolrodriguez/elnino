import { Redirect, useRouter } from "expo-router";
import { useState } from "react";

import { ServidorEnUso, useServidorActual } from "@/components/ServidorEnUso";
import { Boton, Campo, ErrorCaja, Pantalla, Texto, Titulo } from "@/components/ui";
import { ErrorApi } from "@/lib/api";
import { mensajeError } from "@/lib/errores";
import { useSesion } from "@/lib/SesionContext";

export default function Login() {
  const { estado, entrar } = useSesion();
  const router = useRouter();
  const servidor = useServidorActual();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (estado.tipo === "autenticado") return <Redirect href="/(app)" />;

  const enviar = async () => {
    setError(null);
    setCargando(true);
    try {
      await entrar(email, password);
    } catch (e) {
      setError(e instanceof ErrorApi && e.estado === 401 ? "Correo o contraseña incorrectos." : mensajeError(e));
    } finally {
      setCargando(false);
    }
  };

  return (
    <Pantalla>
      <Titulo>Ingresar</Titulo>
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
      {error ? <ErrorCaja mensaje={error} /> : null}
      <ServidorEnUso url={servidor} onCambiar={() => router.push("/")} />
      <Boton
        titulo="Ingresar"
        onPress={enviar}
        cargando={cargando}
        deshabilitado={!servidor || !email.trim() || !password}
      />
      <Texto suave>¿No tenés cuenta?</Texto>
      <Boton titulo="Registrarme" variante="secundario" onPress={() => router.push("/registro")} />
    </Pantalla>
  );
}
