/**
 * Conversión OKLCH -> sRGB (hex). Los colores del sistema visual se escriben en OKLCH
 * (luminosidad, croma, matiz) y se compilan a hex porque Chakra (color2k), canvas, WebGL y Deck.gl
 * necesitan RGB. Si el color queda fuera del gamut sRGB se baja el croma, no la luminosidad.
 */

export type Oklch = readonly [l: number, c: number, h: number];

function aLineal(l: number, c: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const dentro = (v: number) => v >= -0.0005 && v <= 1.0005;
const gamma = (v: number) => {
  const x = Math.min(1, Math.max(0, v));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
};

export function oklchAHex([l, c, h]: Oklch): string {
  let croma = c;
  let rgb = aLineal(l, croma, h);
  if (!rgb.every(dentro)) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 24; i++) {
      croma = (lo + hi) / 2;
      rgb = aLineal(l, croma, h);
      if (rgb.every(dentro)) lo = croma;
      else hi = croma;
    }
    rgb = aLineal(l, lo, h);
  }
  return `#${rgb.map((v) => Math.round(gamma(v) * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Luminancia relativa WCAG de un color hex. */
export function luminancia(hex: string): number {
  const canal = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(1) + 0.0722 * canal(2);
}

/** Relación de contraste WCAG entre dos colores hex. */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Forma CSS `oklch(...)`, útil para documentar el valor de origen de un token. */
export function oklchCss([l, c, h]: Oklch): string {
  return `oklch(${l} ${c} ${h})`;
}
