import { borrarCachePersonal } from "@/lib/cacheLocal";
import { RepositorioSqlite } from "@/lib/colaSqlite";

/**
 * Datos de la persona guardados en claro en SQLite que se borran cuando la sesión termina (cierre
 * manual, cambio de servidor o refresh rechazado por el servidor):
 * - la caché de respuestas (pedidos, sector, confirmaciones, ayuda rápida, destinos de la brújula);
 *   se conserva solo la lista pública de centros;
 * - los ítems de la cola offline ya enviados o rechazados.
 *
 * Los pedidos de ayuda **pendientes** se conservan a propósito: borrarlos por un refresh vencido
 * perdería un pedido de emergencia sin enviar. Se envían al volver a entrar con la misma cuenta y se
 * borran si entra otra (`ColaOffline.limpiarAjenos`) o al cerrar sesión desde Perfil.
 * Nunca lanza: una falla de SQLite no debe impedir cerrar la sesión.
 */
export async function borrarDatosLocalesDeSesion(): Promise<void> {
  try {
    await borrarCachePersonal();
  } catch {
    // sin caché
  }
  try {
    await new RepositorioSqlite().borrarNoPendientes();
  } catch {
    // sin cola
  }
}
