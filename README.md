# lorempixar

Generate placeholder images as SVG strings, raster buffers, or data URLs with
customizable dimensions, background color, text color, and text.

- **SVG** — zero-dependency, synchronous
- **PNG / JPEG / WebP** — rendered via [sharp](https://sharp.pixelplumbing.com)

## Install

```bash
npm install lorempixar
```

## Usage

```ts
import { generateSVG, generateImage, generateDataUrl } from "lorempixar";
import { writeFileSync } from "node:fs";

// ── SVG (sync) ─────────────────────────────────────────────────

const svg = generateSVG({ width: 600, height: 400, text: "Hello" });

// ── Raster (async) ────────────────────────────────────────────

const png = await generateImage({ width: 800, height: 400 });
writeFileSync("placeholder.png", png);

const jpg = await generateImage({
  width: 800,
  height: 400,
  format: "jpeg",
  quality: 80,
});
writeFileSync("placeholder.jpg", jpg);

const webp = await generateImage({
  width: 400,
  height: 300,
  format: "webp",
  quality: 85,
  backgroundColor: "#1a1a2e",
  textColor: "#e94560",
  text: "BANNER",
});

// ── Data URLs ─────────────────────────────────────────────────

// SVG data URL (sync when format is "svg")
const svgUrl = generateDataUrl({ width: 400, height: 300 });

// Raster data URLs (async)
const pngUrl = await generateDataUrl({
  width: 400,
  height: 300,
  format: "png",
});
// => "data:image/png;base64,..."
```

## API

### `generateSVG(options?)`

Returns an SVG string. Always synchronous.

### `generateImage(options?)`

Returns a `Promise<Buffer>`. Default format is `"png"`.

### `generateDataUrl(options?)`

Returns a base64 data URL. Synchronous for SVG, returns a `Promise<string>` for raster formats.

### `PlaceholderOptions`

| Option             | Type                            | Default                  | Description                             |
| ------------------ | ------------------------------- | ------------------------ | --------------------------------------- |
| `width`            | `number`                        | `300`                    | Image width in pixels                   |
| `height`           | `number`                        | `200`                    | Image height in pixels                  |
| `backgroundColor`  | `string`                        | `"#cccccc"`              | CSS background color                    |
| `textColor`        | `string`                        | `"#333333"`              | CSS text color                          |
| `text`             | `string`                        | `"{width}×{height}"`     | Text displayed on the image             |
| `format`           | `"svg" \| "png" \| "jpeg" \| "webp"` | `"svg"` / `"png"`* | Output image format                     |
| `quality`          | `number`                        | —                        | Quality 1–100 (jpeg / webp only)        |
| `fontSize`         | `number`                        | auto (8% of smaller dimension, min 12px) | Font size in pixels for the label text |
| `fontFamily`       | `string`                        | `"system-ui, -apple-system, sans-serif"` | CSS `font-family` for the label text |
| `style`            | `string`                        | —                        | Raw CSS injected into the SVG `<style>` block — use for `@import` or `@font-face` |
| `fonts`            | `FontFace[]`                    | —                        | Custom fonts embedded as base64 data URIs in the SVG |

\* `"svg"` for `generateSVG` / `generateDataUrl`, `"png"` for `generateImage`.

## External Fonts

Use the `style` option to inject CSS into the SVG. This lets you load fonts
from Google Fonts, Adobe Fonts, or self-hosted `@font-face` declarations.

### Google Fonts

```ts
import { generateSVG } from "lorempixar";

const svg = generateSVG({
  width: 600,
  height: 300,
  fontFamily: "'Bangers', cursive",
  fontSize: 48,
  text: "Custom Font!",
  style: `@import url('https://fonts.googleapis.com/css2?family=Bangers');`,
});
```

### Self-hosted font (base64)

Pass font file buffers directly via the `fonts` option. The library base64-encodes
them and generates `@font-face` rules automatically.

```ts
import { readFileSync } from "node:fs";
import { generateSVG } from "lorempixar";

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

You can also do it manually via `style` if you prefer:

```ts
const svg = generateSVG({
  fontFamily: "'MyFont'",
  text: "Hello",
  style: `
    @font-face {
      font-family: 'MyFont';
      src: url(data:font/woff2;base64,d09GMgABAAAAAA...);
    }
  `,
});
```

### In React

When using the SVG in a React component, embed it as inline SVG (not `<img>`)
so the browser can fetch external fonts:

```tsx
function Placeholder({ width, height }) {
  const svg = generateSVG({
    width,
    height,
    fontFamily: "'Cairo', sans-serif",
    text: "مرحباً",
    style: `@import url('https://fonts.googleapis.com/css2?family=Cairo');`,
  });

  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
```

> **Note:** External font resources in `<img>` tags are blocked by browsers for
> security reasons. Inline the SVG markup (as shown above) for fonts to load.
> For raster output (`generateImage`), the font must be installed on the
> system that runs the rendering.

## License

MIT
