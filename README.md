# Lorem Pixar

Generate placeholder images — programmatically. Choose dimensions, colors, text,
fonts, and output format. Useful as a drop-in replacement for services like
`placeholder.com` or `via.placeholder.com` when you need self-hosted, offline,
or custom-branded placeholders.

- **SVG** — zero runtime dependencies, synchronous
- **PNG / JPEG / WebP** — rendered via [sharp](https://sharp.pixelplumbing.com) (optional)

---

## Install

```bash
npm install lorempixar
```

For raster formats (`png` / `jpeg` / `webp`), install sharp as well:

```bash
npm install sharp
```

---

## Quick Start

```ts
import { generateSVG, generateImage, generateDataUrl } from "lorempixar";
import { writeFileSync } from "node:fs";

// ── SVG string ──────────────────────────────────────────────────
const svg = generateSVG({ width: 600, height: 400, text: "Hello" });
// => "<svg xmlns=...>...</svg>"

// ── PNG buffer (async) ──────────────────────────────────────────
const png = await generateImage({ width: 800, height: 400 });
writeFileSync("placeholder.png", png);

// ── JPEG with quality ───────────────────────────────────────────
const jpg = await generateImage({
  width: 800,
  height: 400,
  format: "jpeg",
  quality: 80,
  backgroundColor: "#1a1a2e",
  textColor: "#e94560",
  text: "HERO BANNER",
});
writeFileSync("hero.jpg", jpg);

// ── Data URL (ready for <img src>) ──────────────────────────────
const url = generateDataUrl({ width: 400, height: 300 });
// => "data:image/svg+xml;base64,..."
```

---

## Real-World Integrations

### Express.js — on-the-fly placeholder endpoint

```ts
import express from "express";
import { generateImage } from "lorempixar";

const app = express();

app.get("/placeholder/:width/:height", async (req, res) => {
  const { width, height } = req.params;
  const { text, bg, color, format } = req.query;

  const buf = await generateImage({
    width: Number(width),
    height: Number(height),
    text: String(text ?? `${width}x${height}`),
    backgroundColor: String(bg ?? "#cccccc"),
    textColor: String(color ?? "#333333"),
    format: (format as "png") ?? "png",
  });

  res.type(format === "jpeg" ? "jpeg" : "png").send(buf);
});

app.listen(3000);
```

### React / Next.js — component wrapper

```tsx
import { generateSVG } from "lorempixar";

function Placeholder({
  width = 300,
  height = 200,
  text,
  bg = "#cccccc",
  color = "#333333",
}: {
  width?: number;
  height?: number;
  text?: string;
  bg?: string;
  color?: string;
}) {
  const svg = generateSVG({
    width,
    height,
    text,
    backgroundColor: bg,
    textColor: color,
  });

  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
```

### CLI — pipe to a file

```bash
bun -e "
  const { generateSVG } = require('lorempixar');
  process.stdout.write(generateSVG({ width: 800, height: 400, text: 'CLI' }));
" > output.svg
```

---

## API

### `generateSVG(options?)`

Returns an SVG string. Always synchronous, always SVG.

### `generateImage(options?)`

Returns a `Promise<Buffer>`. Default format is `"png"`.

Requires `sharp` at runtime — it is loaded lazily, so SVG-only users never pay
the cost.

### `generateDataUrl(options?)`

Returns a base64 data URL. Synchronous for `format: "svg"`, returns a
`Promise<string>` for raster formats.

---

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `width` | `number` | `300` | Image width in pixels |
| `height` | `number` | `200` | Image height in pixels |
| `backgroundColor` | `string` | `"#cccccc"` | CSS background color (hex, rgb, or named) |
| `textColor` | `string` | `"#333333"` | CSS text color |
| `text` | `string` | `"{w}×{h}"` | Text displayed on the image |
| `format` | `"svg"` \| `"png"` \| `"jpeg"` \| `"webp"` | `"svg"`* | Output image format |
| `quality` | `number` | — | Quality 1–100 (jpeg / webp only) |
| `fontSize` | `number` | auto** | Font size in pixels |
| `fontFamily` | `string` | `"system-ui, -apple-system, sans-serif"` | CSS `font-family` |
| `style` | `string` | — | Raw CSS injected into SVG `<style>` block |
| `fonts` | `FontFace[]` | — | Custom fonts embedded as base64 data URIs |

\* `"svg"` for `generateSVG` / `generateDataUrl`, `"png"` for `generateImage`.
\*\* Auto: 8% of the smaller dimension, clamped to minimum 12px.

### `FontFace`

| Field | Type | Default | Description |
|---|---|---|---|
| `family` | `string` | *(required)* | Font family name |
| `source` | `Buffer` \| `Uint8Array` \| `ArrayBuffer` \| `string` | *(required)* | Font data or file path |
| `format` | `"woff2"` \| `"woff"` \| `"truetype"` \| `"opentype"` | `"woff2"` | Font format |
| `weight` | `string` \| `number` | `"normal"` | CSS `font-weight` |
| `style` | `string` | `"normal"` | CSS `font-style` |

---

## External Fonts

### Google Fonts

```ts
const svg = generateSVG({
  fontFamily: "'Bangers', cursive",
  fontSize: 48,
  text: "Custom Font!",
  style: `@import url('https://fonts.googleapis.com/css2?family=Bangers');`,
});
```

### Self-hosted font file

```ts
import { readFileSync } from "node:fs";

const svg = generateSVG({
  fontFamily: "'MyFont'",
  text: "Hello",
  fonts: [{
    family: "MyFont",
    source: readFileSync("./assets/my-font.woff2"),
    format: "woff2",
    weight: 400,
    style: "normal",
  }],
});
```

> **Important:** Browsers block external resources (fonts, images) in SVGs used
> as `<img>` sources. Always inline the SVG markup into the DOM for custom fonts
> to load. For raster output via `generateImage()`, the font must be installed
> on the system that runs the rendering.

---

## Example Gallery

Run `bun run test` to regenerate all samples in `test-images/`. Here's what
each file demonstrates:

### SVG Placeholders (core features)

| File | Dimensions | What it shows |
|---|---|---|
| `01-defaults.svg` | 300×200 | All defaults — gray background, dark text, auto dimensions label |
| `02-custom-dimensions.svg` | 800×400 | Custom width & height override |
| `03-dark-theme.svg` | 600×300 | Dark background (`#1a1a2e`) with red text (`#e94560`) |
| `04-named-colors.svg` | 500×250 | CSS named colors: `tomato` background, `white` text |
| `05-small-badge.svg` | 120×40 | Tiny UI badge — font clamped to 12px minimum |
| `06-large-billboard.svg` | 1200×400 | Full-width hero billboard, auto-scaled 80px font |
| `07-square-thumbnail.svg` | 400×400 | 1:1 square for avatar / thumbnail slots |
| `08-skinny-skyscraper.svg` | 160×600 | Tall narrow sidebar ad slot |
| `08b-custom-fontsize.svg` | 600×200 | Explicit `fontSize: 60` overrides auto-scaling |
| `08c-persian.svg` | 600×250 | Unicode RTL text: `لورم ایپسوم` |

### Font Family Showcase

Same canvas (500×120), same text (the font name itself) — different typefaces:

| File | Font Family |
|---|---|
| `ff-01-monospace.svg` | Courier New, monospace |
| `ff-02-serif.svg` | Georgia, Times New Roman, serif |
| `ff-03-sans-serif.svg` | Arial, Helvetica, sans-serif |
| `ff-04-cursive.svg` | Brush Script MT, Comic Sans MS, cursive |
| `ff-05-fantasy.svg` | Impact, Papyrus, fantasy |

### Font Size Comparison

Same canvas (500×150), dark theme, text shows the pixel size:

| File | Font size | Visual |
|---|---|---|
| `fnt-008px.svg` | 8px | Tiny — barely readable |
| `fnt-012px.svg` | 12px | Small label |
| `fnt-016px.svg` | 16px | Default body text |
| `fnt-024px.svg` | 24px | Sub-heading |
| `fnt-036px.svg` | 36px | Heading |
| `fnt-048px.svg` | 48px | Large display |
| `fnt-072px.svg` | 72px | Hero text |
| `fnt-096px.svg` | 96px | Massive |
| `fnt-128px.svg` | 128px | Oversized — likely clipped |

### External Fonts (Google Fonts via `@import`)

| File | Font | Notes |
|---|---|---|
| `ef-01-bangers.svg` | [Bangers](https://fonts.google.com/specimen/Bangers) | Bold comic-style display font |
| `ef-02-cairo.svg` | [Cairo](https://fonts.google.com/specimen/Cairo) | Arabic-script font with `الخط العربي` |
| `ef-03-pacifico.svg` | [Pacifico](https://fonts.google.com/specimen/Pacifico) | Cursive handwriting style |

### Raster Output (`generateImage`)

| File | Format | Highlights |
|---|---|---|
| `09-default.png` | PNG | 600×300 — default raster output |
| `10-dark.jpg` | JPEG | Quality 80, dark theme |
| `11-badge.webp` | WebP | 200×60 orange "SALE" badge |
| `12-billboard.png` | PNG | 1200×400 full-width hero |
| `13-thumb.jpg` | JPEG | 300×300 square avatar, quality 70 |
| `14-low-quality.webp` | WebP | Quality 5 — shows extreme compression artifacts |
| `15-skyscraper.png` | PNG | 160×600 tall thin ad slot |

---

## License

MIT © lorempixar
