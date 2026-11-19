/** Marca de la plataforma: una gota sobre una línea de nivel (agua y escala), en trazo simple. */
export function Marca({ tam = 26 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 26 26" aria-hidden="true" focusable="false" fill="none">
      <path d="M13 2.5c3.6 4.6 6.5 7.8 6.5 11.4a6.5 6.5 0 0 1-13 0C6.5 10.3 9.4 7.1 13 2.5Z" fill="currentColor" />
      <path d="M3 22.5c2.2 0 2.2-1.3 4.4-1.3s2.2 1.3 4.4 1.3 2.2-1.3 4.4-1.3 2.2 1.3 4.4 1.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
