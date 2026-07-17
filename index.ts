import { readFileSync } from "node:fs";

// sharp is loaded dynamically in generateImage() — only raster users need it.

// ── Types ──────────────────────────────────────────────────────────────────

/** Supported output image formats. */
export type ImageFormat = "svg" | "png" | "jpeg" | "webp";

/** Font format for the MIME type in embedded `@font-face` data URIs. */
export type FontFormat = "woff2" | "woff" | "truetype" | "opentype";

/** Describes a custom font to embed in the SVG via `@font-face`. */
export interface FontFace {
  /** Font family name (used in `font-family` and the `@font-face` rule). */
  family: string;
  /** Font file contents as a Buffer, Uint8Array, or file path string. */
  source: Buffer | Uint8Array | ArrayBuffer | string;
  /** Font format (determines the MIME type in the data URI). Default: `"woff2"`. */
  format?: FontFormat;
  /** CSS `font-weight` value. Default: `"normal"`. */
  weight?: string | number;
  /** CSS `font-style` value. Default: `"normal"`. */
  style?: string;
}

export interface PlaceholderOptions {
  /** Width in pixels (default: 300) */
  width?: number;
  /** Height in pixels (default: 200) */
  height?: number;
  /** CSS background color (default: '#cccccc') */
  backgroundColor?: string;
  /** CSS text color (default: '#333333') */
  textColor?: string;
  /** Text to display centered on the image (default: '{width}×{height}') */
  text?: string;
  /**
   * Output image format.
   * Defaults to `"svg"` in `generateSVG` / `generateDataUrl`,
   * and `"png"` in `generateImage`.
   */
  format?: ImageFormat;
  /** Quality (1–100) for `jpeg` and `webp` formats. */
  quality?: number;
  /**
   * Font size in pixels for the label text.
   * When not set, auto-calculated as 8% of the smaller dimension (min 12px).
   */
  fontSize?: number;
  /** CSS `font-family` value for the label text (default: `"system-ui, -apple-system, sans-serif"`). */
  fontFamily?: string;
  /**
   * Raw CSS injected into the SVG via a `<style>` block.
   * Use this to load external fonts with `@import` or define `@font-face`.
   */
  style?: string;
  /**
   * Custom fonts to embed as base64 data URIs in the SVG `<style>` block.
   * Each entry produces a `@font-face` rule.  Font data is read synchronously
   * (via `readFileSync` when `source` is a path string).
   *
   * Only affects SVG output — raster formats require system-installed fonts.
   */
  fonts?: FontFace[];
}

// ── Internal helpers ───────────────────────────────────────────────────────

const SVG_NS = "http://www.w3.org/2000/svg";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Validates a CSS color value to prevent injection. Throws on invalid input. */
function validateColor(value: string, label: string): void {
  if (/[(){}[\];<>]/.test(value)) {
    throw new Error(
      `Invalid ${label}: "${value}". CSS color must not contain special characters.`,
    );
  }
}

function fontMimeType(format: FontFormat): string {
  switch (format) {
    case "woff2": return "font/woff2";
    case "woff": return "font/woff";
    case "truetype": return "font/ttf";
    case "opentype": return "font/otf";
  }
}

/** Resolves a FontFace source to a Buffer (reads from disk if a path string). */
function resolveFontSource(source: FontFace["source"]): Buffer {
  if (typeof source === "string") {
    return readFileSync(source);
  }
  if (Buffer.isBuffer(source)) {
    return source;
  }
  if (source instanceof Uint8Array) {
    return Buffer.from(source);
  }
  // ArrayBuffer
  return Buffer.from(source);
}

function buildStyleBlock(opts: PlaceholderOptions): string | null {
  const rules: string[] = [];

  // User-provided raw CSS
  if (opts.style) {
    rules.push(opts.style);
  }

  // Auto-generated @font-face rules from the fonts option
  if (opts.fonts && opts.fonts.length > 0) {
    for (const font of opts.fonts) {
      const buf = resolveFontSource(font.source);
      const b64 = buf.toString("base64");
      const format = font.format ?? "woff2";
      const mime = fontMimeType(format);
      const weight = font.weight ?? "normal";
      const fontStyle = font.style ?? "normal";

      rules.push(
        `@font-face {\n` +
        `  font-family: '${font.family}';\n` +
        `  src: url(data:${mime};base64,${b64}) format('${format}');\n` +
        `  font-weight: ${weight};\n` +
        `  font-style: ${fontStyle};\n` +
        `}`,
      );
    }
  }

  if (rules.length === 0) return null;

  return `  <style>/* <![CDATA[ */\n${rules.join("\n")}\n  /* ]]> */</style>`;
}

function validateOptions(opts: PlaceholderOptions): Required<Pick<PlaceholderOptions, "width" | "height" | "backgroundColor" | "textColor" | "text">> {
  const {
    width = 300,
    height = 200,
    backgroundColor = "#cccccc",
    textColor = "#333333",
    text = `${width}×${height}`,
  } = opts;

  if (!Number.isFinite(width) || width <= 0) {
    throw new Error(`width must be a positive number, got ${width}`);
  }
  if (!Number.isFinite(height) || height <= 0) {
    throw new Error(`height must be a positive number, got ${height}`);
  }

  validateColor(backgroundColor, "backgroundColor");
  validateColor(textColor, "textColor");

  return { width, height, backgroundColor, textColor, text };
}

function buildSVG(opts: PlaceholderOptions): string {
  const validated = validateOptions(opts);
  const { width, height, backgroundColor, textColor, text } = validated;
  let fontSize: number;
  if (opts.fontSize != null) {
    if (!Number.isFinite(opts.fontSize) || opts.fontSize <= 0) {
      throw new Error(`fontSize must be a positive number, got ${opts.fontSize}`);
    }
    fontSize = opts.fontSize;
  } else {
    fontSize = Math.max(12, Math.min(width, height) * 0.08);
  }

  const fontFamily = escapeXml(opts.fontFamily ?? "system-ui, -apple-system, sans-serif");

  const parts = [
    `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  ];

  const styleBlock = buildStyleBlock(opts);
  if (styleBlock) {
    parts.push(styleBlock);
  }

  parts.push(
    `  <rect width="100%" height="100%" fill="${backgroundColor}" />`,
    `  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"`,
    `    font-family="${fontFamily}" font-size="${fontSize}px"`,
    `    fill="${textColor}">${escapeXml(text)}</text>`,
    `</svg>`,
  );

  return parts.join("\n");
}

function mimeType(format: ImageFormat): string {
  switch (format) {
    case "svg": return "image/svg+xml";
    case "png": return "image/png";
    case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Generates a placeholder image as an SVG string.
 *
 * Always returns SVG regardless of the `format` option — use
 * {@link generateImage} for raster output.
 */
export function generateSVG(options?: PlaceholderOptions): string {
  return buildSVG(options ?? {});
}

/**
 * Generates a placeholder image as a base64 data URL.
 *
 * When `format` is `"svg"` (the default), the result is synchronous.
 * For raster formats (`png`, `jpeg`, `webp`) the returned promise resolves
 * after rendering.
 */
export function generateDataUrl(options?: PlaceholderOptions): string;
export function generateDataUrl(options: PlaceholderOptions & { format: "png" | "jpeg" | "webp" }): Promise<string>;
export function generateDataUrl(options?: PlaceholderOptions): string | Promise<string> {
  const format = options?.format ?? "svg";

  if (format === "svg") {
    const svg = buildSVG(options ?? {});
    const encoded = Buffer.from(svg).toString("base64");
    return `data:image/svg+xml;base64,${encoded}`;
  }

  return generateImage(options).then((buf) => {
    return `data:${mimeType(format)};base64,${buf.toString("base64")}`;
  });
}

/**
 * Generates a placeholder image as a `Buffer`.
 *
 * For `"svg"` format, returns an SVG string encoded as UTF-8.
 * For raster formats (`png`, `jpeg`, `webp`), renders the SVG via sharp
 * and returns the encoded image bytes.
 *
 * Defaults to `"png"` when no format is specified.
 */
export async function generateImage(options?: PlaceholderOptions): Promise<Buffer> {
  const format = options?.format ?? "png";
  const quality = options?.quality;
  const svg = buildSVG(options ?? {});

  if (format === "svg") {
    return Buffer.from(svg);
  }

  let sharp: typeof import("sharp").default;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    throw new Error(
      'Cannot render raster images: "sharp" is not installed. ' +
      'Run `npm install sharp` to enable PNG/JPEG/WebP output.',
    );
  }

  const image = sharp(Buffer.from(svg));

  switch (format) {
    case "png":
      return image.png().toBuffer();
    case "jpeg":
      return image.jpeg(quality != null ? { quality } : undefined).toBuffer();
    case "webp":
      return image.webp(quality != null ? { quality } : undefined).toBuffer();
    default:
      throw new Error(`Unsupported format: "${format}". Use "svg", "png", "jpeg", or "webp".`);
  }
}
