import type { ReactNode, SVGProps } from "react";

/**
 * Juego de íconos propio (trazo de 1,75 px, esquinas redondeadas, grilla de 24 px), dibujado en línea para no sumar
 * dependencias. Son decorativos: llevan `aria-hidden` y el significado siempre está también en el texto.
 */
export type PropsIcono = Omit<SVGProps<SVGSVGElement>, "children"> & { tam?: string | number };

function crear(trazos: ReactNode, nombre: string) {
  const Icono = ({ tam = "1.25em", ...resto }: PropsIcono) => (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: "none" }}
      {...resto}
    >
      {trazos}
    </svg>
  );
  Icono.displayName = nombre;
  return Icono;
}

export const IconoTelefono = crear(
  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
  "IconoTelefono",
);
export const IconoPunto = crear(
  <>
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </>,
  "IconoPunto",
);
export const IconoCasa = crear(<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />, "IconoCasa");
export const IconoPersonas = crear(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </>,
  "IconoPersonas",
);
export const IconoPersona = crear(
  <>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>,
  "IconoPersona",
);
export const IconoMenor = crear(
  <>
    <path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
    <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />
  </>,
  "IconoMenor",
);
export const IconoMayor = crear(
  <>
    <circle cx="9" cy="4.5" r="2" />
    <path d="M9 8.5v5.5l-2 6.5M9 14l3 6.5M12 9.5h2.5M15 9.5v11" />
  </>,
  "IconoMayor",
);
export const IconoMascota = crear(
  <>
    <circle cx="5.5" cy="11" r="1.6" />
    <circle cx="9.5" cy="6.5" r="1.6" />
    <circle cx="14.5" cy="6.5" r="1.6" />
    <circle cx="18.5" cy="11" r="1.6" />
    <path d="M12 12c-3 0-5.5 3-5.5 5.2 0 1.6 1.2 2.3 2.7 2.3 1 0 1.8-.5 2.8-.5s1.8.5 2.8.5c1.5 0 2.7-.7 2.7-2.3C17.5 15 15 12 12 12z" />
  </>,
  "IconoMascota",
);
export const IconoCampana = crear(
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </>,
  "IconoCampana",
);
export const IconoMegafono = crear(
  <>
    <path d="m3 11 18-5v12L3 14v-4z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </>,
  "IconoMegafono",
);
export const IconoTilde = crear(<path d="M20 6 9 17l-5-5" />, "IconoTilde");
export const IconoReloj = crear(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </>,
  "IconoReloj",
);
export const IconoCamion = crear(
  <>
    <path d="M10 17h4V5H2v12h3M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5M14 17h1" />
    <circle cx="7.5" cy="17.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </>,
  "IconoCamion",
);
export const IconoCamioneta = crear(
  <>
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" />
    <path d="M9 17h6" />
    <circle cx="17" cy="17" r="2" />
  </>,
  "IconoCamioneta",
);
export const IconoColectivo = crear(
  <>
    <path d="M8 6v6M15 6v6M2 12h19.6" />
    <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
    <circle cx="7" cy="18" r="2" />
    <path d="M9 18h5" />
    <circle cx="16" cy="18" r="2" />
  </>,
  "IconoColectivo",
);
export const IconoLancha = crear(
  <>
    <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M19.4 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.8 7.76" />
    <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6M12 10v4M12 2v3" />
  </>,
  "IconoLancha",
);
export const IconoMoto = crear(
  <>
    <circle cx="5.5" cy="17" r="3" />
    <circle cx="18.5" cy="17" r="3" />
    <path d="M8.5 17h5l3-8h-4M14 9l-2-3H9.5M16 9h2.5" />
  </>,
  "IconoMoto",
);
export const IconoRumbo = crear(<path d="M3 11 22 2l-9 19-2-8-8-2z" />, "IconoRumbo");
export const IconoMira = crear(
  <>
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="12" r="8" />
    <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
  </>,
  "IconoMira",
);
export const IconoMapa = crear(
  <>
    <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
    <path d="M9 3v15M15 6v15" />
  </>,
  "IconoMapa",
);
export const IconoNumeral = crear(<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />, "IconoNumeral");
export const IconoMas = crear(<path d="M12 5v14M5 12h14" />, "IconoMas");
export const IconoMenos = crear(<path d="M5 12h14" />, "IconoMenos");
export const IconoFlecha = crear(<path d="m6 9 6 6 6-6" />, "IconoFlecha");
export const IconoGota = crear(<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />, "IconoGota");
export const IconoOlas = crear(
  <>
    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
  </>,
  "IconoOlas",
);
export const IconoTriangulo = crear(
  <>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </>,
  "IconoTriangulo",
);
export const IconoAlerta = crear(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </>,
  "IconoAlerta",
);
export const IconoEscudo = crear(
  <>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </>,
  "IconoEscudo",
);
export const IconoEdificio = crear(
  <>
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4" />
  </>,
  "IconoEdificio",
);
export const IconoBandeja = crear(
  <>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </>,
  "IconoBandeja",
);
export const IconoFormulario = crear(
  <>
    <path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01" />
  </>,
  "IconoFormulario",
);
export const IconoSalvavidas = crear(
  <>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24" />
  </>,
  "IconoSalvavidas",
);
export const IconoEnviar = crear(<path d="m22 2-7 20-4-9-9-4zM22 2 11 13" />, "IconoEnviar");
export const IconoInfo = crear(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </>,
  "IconoInfo",
);
export const IconoLapiz = crear(
  <>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
  </>,
  "IconoLapiz",
);
export const IconoCaja = crear(
  <>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
  </>,
  "IconoCaja",
);
export const IconoHistorial = crear(
  <>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5M12 7v5l3 2" />
  </>,
  "IconoHistorial",
);
export const IconoCandado = crear(
  <>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </>,
  "IconoCandado",
);
export const IconoPuntos = crear(
  <>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </>,
  "IconoPuntos",
);

/** Ícono del vehículo de la cuadrilla (SIMULADO): 4x4, camión jaula, colectivo, lancha o moto. */
export function IconoVehiculo({ vehiculo, ...p }: PropsIcono & { vehiculo: string | null | undefined }) {
  switch (vehiculo) {
    case "4x4":
      return <IconoCamioneta {...p} />;
    case "colectivo":
      return <IconoColectivo {...p} />;
    case "lancha":
      return <IconoLancha {...p} />;
    case "moto":
      return <IconoMoto {...p} />;
    default:
      return <IconoCamion {...p} />;
  }
}
