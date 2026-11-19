/** Detecta si el navegador soporta `gap` en flexbox (Safari < 14.1 y Chrome < 84 no lo soportan). */
export function soportaGapFlex(doc: Document = document): boolean {
  const caja = doc.createElement("div");
  caja.style.cssText = "display:flex;flex-direction:column;row-gap:1px;position:absolute;left:-9999px;top:0";
  caja.appendChild(doc.createElement("span"));
  caja.appendChild(doc.createElement("span"));
  doc.body.appendChild(caja);
  const soportado = caja.scrollHeight === 1;
  doc.body.removeChild(caja);
  return soportado;
}

/** Marca `<html class="sin-gap-flex">` cuando hace falta el respaldo con márgenes (ver estilo/base.css). */
export function aplicarRespaldos(doc: Document = document): void {
  try {
    if (!soportaGapFlex(doc)) doc.documentElement.classList.add("sin-gap-flex");
  } catch {
    /* sin DOM completo: no se aplica ningún respaldo */
  }
}
