import { Navigate, Route, Routes } from "react-router-dom";

import { PanelLayout } from "./PanelLayout";
import Bitacora from "./paginas/Bitacora";
import Centinela from "./paginas/Centinela";
import Limites from "./paginas/Limites";
import Lluvia from "./paginas/Lluvia";
import MapaOperativo from "./paginas/MapaOperativo";
import Monitor from "./paginas/Monitor";
import Operacion from "./paginas/Operacion";
import Ordenes from "./paginas/Ordenes";
import Produccion from "./paginas/Produccion";
import Recomendacion from "./paginas/Recomendacion";

/** Rutas internas de `/comando/*` (el acceso por rol lo exige `RutaProtegida` en `App`). */
export default function Panel() {
  return (
    <Routes>
      <Route element={<PanelLayout />}>
        <Route index element={<Monitor />} />
        <Route path="mapa" element={<MapaOperativo />} />
        <Route path="recomendacion" element={<Recomendacion />} />
        <Route path="produccion" element={<Produccion />} />
        <Route path="operacion" element={<Operacion />} />
        <Route path="lluvia" element={<Lluvia />} />
        <Route path="ordenes" element={<Ordenes />} />
        <Route path="bitacora" element={<Bitacora />} />
        <Route path="centinela" element={<Centinela />} />
        <Route path="limites" element={<Limites />} />
        <Route path="*" element={<Navigate to="/comando" replace />} />
      </Route>
    </Routes>
  );
}
