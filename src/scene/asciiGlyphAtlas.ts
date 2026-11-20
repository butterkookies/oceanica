import * as THREE from 'three';

export const ASCII_CELL_CSS_W = 2.8;
export const ASCII_CELL_CSS_H = 4.2;
export const ASCII_ATLAS_COLS = 9;
export const ASCII_ATLAS_ROWS = 8;

export function computeAsciiGridSize(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
): { cols: number; rows: number } {
  const safeDpr = Math.max(1, dpr);
  const cellCssW = Math.max(ASCII_CELL_CSS_W, 3.0 / safeDpr);
  const cellCssH = Math.max(ASCII_CELL_CSS_H, 4.5 / safeDpr);
  const cols = Math.min(640, Math.max(96, Math.round(cssWidth / cellCssW)));
  const rows = Math.min(360, Math.max(60, Math.round(cssHeight / cellCssH)));
  return { cols, rows };
}

export const ASCII_GLYPH_CHARS = [
  ' ', '.', ',', '`', "'", ':', ';', '-', '~', // 0..8
  '_', '^', '!', 'i', 'l', 'r', 't', 'f', 'j', // 9..17
  '(', ')', '<', '>', '[', ']', '=', '+', '*', // 18..26
  'c', 'v', 'x', 'z', 's', 'u', 'n', 'o', 'e', // 27..35
  'a', 'y', 'k', 'h', 'd', 'b', 'p', 'q', 'g', // 36..44
  'm', 'w', 'C', 'J', 'U', 'L', 'Y', 'V', 'S', // 45..53
  'Z', 'X', 'O', '0', 'Q', 'D', 'R', 'B', '8', // 54..62
  '%', '&', 'W', 'M', '#', '@', '/', '\\', '|', // 63..71 (69='/', 70='\\', 71='|')
] as const;

/** Validates that every character in the glyph atlas is a single printable 7-bit ASCII char. */
export function isPureAsciiCharSet(chars: readonly string[]): boolean {
  return chars.every((ch) => {
    if (ch.length !== 1) return false;
    const code = ch.charCodeAt(0);
    return code >= 0x20 && code <= 0x7e;
  });
}

/**
 * Generates an offscreen 9x8 2D glyph atlas texture containing 72 pure printable
 * 7-bit ASCII characters used by the unified SceneAsciiPass shader.
 */
export function createAsciiGlyphAtlasTexture(): THREE.CanvasTexture {
  const cellW = 32;
  const cellH = 48;
  const count = ASCII_GLYPH_CHARS.length;

  const canvas = document.createElement('canvas');
  canvas.width = cellW * ASCII_ATLAS_COLS;
  canvas.height = cellH * ASCII_ATLAS_ROWS;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 39px "JetBrains Mono", "Cascadia Mono", "Consolas", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < count; i++) {
      const ch = ASCII_GLYPH_CHARS[i];
      if (ch === ' ') continue;
      const col = i % ASCII_ATLAS_COLS;
      const row = Math.floor(i / ASCII_ATLAS_COLS);
      ctx.save();
      ctx.beginPath();
      ctx.rect(col * cellW + 1, row * cellH + 1, cellW - 2, cellH - 2);
      ctx.clip();
      ctx.fillText(ch, col * cellW + cellW * 0.5, row * cellH + cellH * 0.52);
      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
