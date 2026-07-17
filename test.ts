import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { generateSVG, generateDataUrl, generateImage } from "./index";
import type { PlaceholderOptions } from "./index";

// ── Test runner ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function assertThrows(fn: () => unknown, label: string): void {
  try {
    fn();
    console.error(`  ✗ ${label} — expected an error but none was thrown`);
    failed++;
  } catch {
    console.log(`  ✓ ${label}`);
    passed++;
  }
}

async function assertThrowsAsync(fn: () => Promise<unknown>, label: string): Promise<void> {
  try {
    await fn();
    console.error(`  ✗ ${label} — expected an error but none was thrown`);
    failed++;
  } catch {
    console.log(`  ✓ ${label}`);
    passed++;
  }
}

function test(name: string, fn: () => void | Promise<void>): void {
  console.log(`\n${name}`);
  const result = fn();
  if (result instanceof Promise) {
    // Tests collected; we'll await them all at the end.
    pending.push(result.catch((err) => {
      console.error(`  ✗ UNCAUGHT: ${err.message}`);
      failed++;
    }));
  }
}

const pending: Promise<void>[] = [];

// ── SVG tests (sync) ───────────────────────────────────────────────────────

test("generateSVG — defaults", () => {
  const svg = generateSVG();

  assert(svg.includes('width="300"'), "default width is 300");
  assert(svg.includes('height="200"'), "default height is 200");
  assert(svg.includes('fill="#cccccc"'), "default background color is #cccccc");
  assert(svg.includes('fill="#333333"'), "default text color is #333333");
  assert(svg.includes("300×200"), "default text shows dimensions");
  assert(svg.startsWith("<svg"), "starts with <svg> tag");
  assert(svg.endsWith("</svg>"), "ends with </svg> tag");
});

test("generateSVG — custom dimensions", () => {
  const svg = generateSVG({ width: 800, height: 600 });

  assert(svg.includes('width="800"'), "custom width 800");
  assert(svg.includes('height="600"'), "custom height 600");
  assert(svg.includes("800×600"), "default text reflects custom dimensions");
});

test("generateSVG — custom colors", () => {
  const svg = generateSVG({
    backgroundColor: "#1a1a2e",
    textColor: "#e94560",
  });

  assert(svg.includes('fill="#1a1a2e"'), "custom background color");
  assert(svg.includes('fill="#e94560"'), "custom text color");
});

test("generateSVG — custom text", () => {
  const svg = generateSVG({ text: "Hello World" });

  assert(svg.includes("Hello World"), "custom text appears in SVG");
});

test("generateSVG — XML escaping", () => {
  const svg = generateSVG({ text: '<>&"\'test' });

  assert(svg.includes("&lt;&gt;&amp;&quot;'test"), "special XML chars are escaped (single quotes pass through)");
  assert(!svg.includes('<>&"\'test'), "raw special chars are not present");
});

test("generateSVG — Unicode text (Persian)", () => {
  const svg = generateSVG({ text: "لورم ایپسوم" });

  assert(svg.includes("لورم ایپسوم"), "Persian text appears verbatim");
  // Unicode chars should NOT get XML-escaped
  assert(!svg.includes("&"), "no spurious XML entities introduced");
});

test("generateSVG — validation", () => {
  assertThrows(() => generateSVG({ width: NaN }), "NaN width throws");
  assertThrows(() => generateSVG({ width: -1 }), "negative width throws");
  assertThrows(() => generateSVG({ width: 0 }), "zero width throws");
  assertThrows(() => generateSVG({ width: Infinity }), "Infinity width throws");
  assertThrows(() => generateSVG({ height: -5 }), "negative height throws");
  assertThrows(
    () => generateSVG({ backgroundColor: "red;color:green" }),
    "semicolon in background color throws",
  );
  assertThrows(
    () => generateSVG({ backgroundColor: "url('x')" }),
    "parens in background color throws",
  );
  assertThrows(
    () => generateSVG({ textColor: "<script>" }),
    "angle brackets in text color throw",
  );
});

test("generateSVG — legal CSS color names", () => {
  const svg = generateSVG({ backgroundColor: "tomato", textColor: "white" });

  assert(svg.includes('fill="tomato"'), "named background color works");
  assert(svg.includes('fill="white"'), "named text color works");
});

test("generateSVG — fontSize scales with image", () => {
  const svg = generateSVG({ width: 1000, height: 1000 });

  assert(svg.includes('font-size="80px"'), "font size is 8% of smallest dimension");
});

test("generateSVG — tiny dimensions clamp font size", () => {
  const svg = generateSVG({ width: 50, height: 30 });

  assert(svg.includes('font-size="12px"'), "font size clamped to 12px minimum");
});

test("generateSVG — custom fontSize", () => {
  const svg = generateSVG({ width: 400, height: 300, fontSize: 48 });

  assert(svg.includes('font-size="48px"'), "custom font size 48px is used");
});

test("generateSVG — custom fontSize overrides auto-scaling", () => {
  const svg = generateSVG({ width: 1000, height: 1000, fontSize: 24 });

  assert(svg.includes('font-size="24px"'), "explicit fontSize overrides auto 80px");
  assert(!svg.includes('font-size="80px"'), "auto-calculated fontSize is not present");
});

test("generateSVG — custom fontSize on tiny images", () => {
  const svg = generateSVG({ width: 80, height: 40, fontSize: 6 });

  assert(svg.includes('font-size="6px"'), "explicit fontSize below the 12px floor is honored");
});

test("generateSVG — fontSize validation", () => {
  assertThrows(() => generateSVG({ fontSize: NaN }), "NaN fontSize throws");
  assertThrows(() => generateSVG({ fontSize: -1 }), "negative fontSize throws");
  assertThrows(() => generateSVG({ fontSize: 0 }), "zero fontSize throws");
  assertThrows(() => generateSVG({ fontSize: Infinity }), "Infinity fontSize throws");
});

test("generateSVG — custom fontFamily", () => {
  const svg = generateSVG({ fontFamily: "Georgia, serif" });

  assert(svg.includes('font-family="Georgia, serif"'), "custom font family is applied");
});

test("generateSVG — default fontFamily", () => {
  const svg = generateSVG();

  assert(svg.includes('font-family="system-ui, -apple-system, sans-serif"'), "default font family is present");
});

test("generateSVG — fontFamily XML escaping prevents injection", () => {
  const svg = generateSVG({ fontFamily: 'Arial" onclick="alert(1)' });

  assert(svg.includes("&quot; onclick=&quot;alert(1)"), "quotes in fontFamily are escaped");
  assert(!svg.includes('" onclick="'), "raw quotes are not present");
});

test("generateSVG — style option injects <style> block", () => {
  const svg = generateSVG({ style: "body { margin: 0; }" });

  assert(svg.includes("<style>"), "<style> tag is present");
  assert(svg.includes("body { margin: 0; }"), "CSS content is injected");
  assert(svg.includes("<![CDATA["), "CDATA section wraps the CSS");
});

test("generateSVG — no style by default", () => {
  const svg = generateSVG();

  assert(!svg.includes("<style>"), "no <style> tag when style option is omitted");
});

test("generateSVG — style with Google Fonts @import", () => {
  const svg = generateSVG({
    fontFamily: "'Bangers', cursive",
    style: "@import url('https://fonts.googleapis.com/css2?family=Bangers');",
    text: "Custom Font",
  });

  assert(svg.includes("@import url('https://fonts.googleapis.com/css2?family=Bangers')"), "@import rule is present");
  assert(svg.includes("font-family=\"'Bangers', cursive\""), "custom font-family is applied");
});

test("generateSVG — fonts option embeds @font-face", () => {
  const fakeFont = Buffer.from("fake-woff2-data");
  const svg = generateSVG({
    fontFamily: "'MyFont'",
    text: "Embedded Font",
    fonts: [{ family: "MyFont", source: fakeFont, format: "woff2" }],
  });

  assert(svg.includes("@font-face"), "@font-face rule is present");
  assert(svg.includes("font-family: 'MyFont'"), "font-family name in @font-face");
  assert(svg.includes("data:font/woff2;base64,"), "base64 data URI for font");
  assert(svg.includes("format('woff2')"), "format hint is present");
  assert(svg.includes("font-weight: normal"), "default weight is normal");
  assert(svg.includes("font-style: normal"), "default style is normal");
});

test("generateSVG — fonts with custom weight and style", () => {
  const svg = generateSVG({
    fontFamily: "'BoldFont'",
    text: "Bold",
    fonts: [{ family: "BoldFont", source: Buffer.from("x"), format: "woff", weight: 700, style: "italic" }],
  });

  assert(svg.includes("font-weight: 700"), "custom weight is applied");
  assert(svg.includes("font-style: italic"), "custom style is applied");
});

test("generateSVG — fonts + style are combined", () => {
  const svg = generateSVG({
    style: "body { margin: 0; }",
    fonts: [{ family: "F", source: Buffer.from("x") }],
  });

  assert(svg.includes("body { margin: 0; }"), "user style is present");
  assert(svg.includes("@font-face"), "embedded font is present");
  // Both should be inside a single <style> block
  const styleTagCount = (svg.match(/<style>/g) ?? []).length;
  assert(styleTagCount === 1, "single <style> block contains both");
});

test("generateSVG — fonts with Uint8Array source", () => {
  const svg = generateSVG({
    fonts: [{ family: "F", source: new Uint8Array([1, 2, 3]) }],
  });

  assert(svg.includes("@font-face"), "Uint8Array source is accepted");
  assert(svg.includes("data:font/woff2;base64,AQID"), "Uint8Array is base64-encoded");
});

test("generateSVG — fonts with ArrayBuffer source", () => {
  const buf = new ArrayBuffer(3);
  new Uint8Array(buf).set([4, 5, 6]);
  const svg = generateSVG({
    fonts: [{ family: "F", source: buf }],
  });

  assert(svg.includes("@font-face"), "ArrayBuffer source is accepted");
});

test("generateSVG — no @font-face when fonts not provided", () => {
  const svg = generateSVG({ text: "No fonts" });

  assert(!svg.includes("@font-face"), "no @font-face when fonts option is omitted");
});

// ── generateDataUrl (SVG, sync) ────────────────────────────────────────────

test("generateDataUrl — SVG data URL", () => {
  const url = generateDataUrl({ width: 100, height: 100 });

  assert(url.startsWith("data:image/svg+xml;base64,"), "starts with correct MIME prefix");
  assert(url.length > 50, "contains encoded data beyond just the prefix");
});

test("generateDataUrl — roundtrip consistency", () => {
  const svg = generateSVG({ width: 200, height: 100, text: "abc" });
  const url = generateDataUrl({ width: 200, height: 100, text: "abc" });

  const base64 = url.slice("data:image/svg+xml;base64,".length);
  const decoded = Buffer.from(base64, "base64").toString("utf-8");

  assert(decoded === svg, "decoded data URL matches original SVG");
});

test("generateDataUrl — unique for different inputs", () => {
  const a = generateDataUrl({ width: 100, height: 100 });
  const b = generateDataUrl({ width: 200, height: 100 });

  assert(a !== b, "different dimensions produce different URLs");
});

// ── generateImage (raster, async) ─────────────────────────────────────────

test("generateImage — defaults to PNG", async () => {
  const buf = await generateImage({ width: 100, height: 100 });

  assert(Buffer.isBuffer(buf), "returns a Buffer");
  assert(buf.length > 0, "buffer is not empty");
  // PNG magic bytes
  assert(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47, "buffer starts with PNG magic bytes");
});

test("generateImage — explicit PNG format", async () => {
  const buf = await generateImage({ width: 50, height: 50, format: "png" });

  assert(Buffer.isBuffer(buf), "returns a Buffer");
  assert(buf[0] === 0x89 && buf[1] === 0x50, "buffer starts with PNG magic bytes");
});

test("generateImage — JPEG format", async () => {
  const buf = await generateImage({ width: 100, height: 100, format: "jpeg" });

  assert(Buffer.isBuffer(buf), "returns a Buffer");
  // JPEG magic bytes: FF D8 FF
  assert(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff, "buffer starts with JPEG magic bytes");
});

test("generateImage — WebP format", async () => {
  const buf = await generateImage({ width: 100, height: 100, format: "webp" });

  assert(Buffer.isBuffer(buf), "returns a Buffer");
  // WebP RIFF header: "RIFF" at 0, "WEBP" at 8
  const riff = buf.toString("ascii", 0, 4);
  const webp = buf.toString("ascii", 8, 12);
  assert(riff === "RIFF", "buffer starts with RIFF header");
  assert(webp === "WEBP", "buffer contains WEBP identifier");
});

test("generateImage — SVG format returns SVG string as buffer", async () => {
  const buf = await generateImage({ width: 100, height: 100, format: "svg" });
  const str = buf.toString("utf-8");

  assert(str.startsWith("<svg"), "SVG buffer contains SVG string");
  assert(str.includes('width="100"'), "SVG buffer has correct width");
});

test("generateImage — JPEG with quality", async () => {
  const high = await generateImage({ width: 200, height: 200, format: "jpeg", quality: 90 });
  const low = await generateImage({ width: 200, height: 200, format: "jpeg", quality: 10 });

  assert(high.length > 0, "high quality JPEG is non-empty");
  assert(low.length > 0, "low quality JPEG is non-empty");
  assert(high.length > low.length, "higher quality JPEG is larger than low quality");
});

test("generateImage — WebP with quality", async () => {
  const high = await generateImage({ width: 200, height: 200, format: "webp", quality: 90 });
  const low = await generateImage({ width: 200, height: 200, format: "webp", quality: 10 });

  assert(high.length > 0, "high quality WebP is non-empty");
  assert(low.length > 0, "low quality WebP is non-empty");
  assert(high.length > low.length, "higher quality WebP is larger than low quality");
});

test("generateImage — invalid format throws", async () => {
  await assertThrowsAsync(
    () => generateImage({ format: "gif" as any }),
    "unsupported format throws",
  );
});

// ── generateDataUrl (raster, async) ───────────────────────────────────────

test("generateDataUrl — PNG data URL", async () => {
  const url = await generateDataUrl({ width: 100, height: 100, format: "png" });

  assert(url.startsWith("data:image/png;base64,"), "starts with correct PNG MIME prefix");
  assert(url.length > 50, "contains encoded data");
});

test("generateDataUrl — JPEG data URL", async () => {
  const url = await generateDataUrl({ width: 100, height: 100, format: "jpeg" });

  assert(url.startsWith("data:image/jpeg;base64,"), "starts with correct JPEG MIME prefix");
});

test("generateDataUrl — WebP data URL", async () => {
  const url = await generateDataUrl({ width: 100, height: 100, format: "webp" });

  assert(url.startsWith("data:image/webp;base64,"), "starts with correct WebP MIME prefix");
});

test("generateDataUrl — raster roundtrip matches raw buffer", async () => {
  const buf = await generateImage({ width: 80, height: 60, format: "png" });
  const url = await generateDataUrl({ width: 80, height: 60, format: "png" });

  const base64 = url.slice("data:image/png;base64,".length);
  const decoded = Buffer.from(base64, "base64");

  assert(decoded.equals(buf), "decoded data URL matches generateImage buffer");
});

// ── Run all tests & generate samples ───────────────────────────────────────

async function main() {
  // Wait for all async tests
  await Promise.all(pending);

  // Summary
  console.log(`\n${"─".repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);

  if (failed > 0) {
    process.exit(1);
  }

  // ── Generate sample images ───────────────────────────────────────────────

  const outDir = "test-images";
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir);

  // SVG samples
  const svgSamples: { name: string; options: PlaceholderOptions }[] = [
    { name: "01-defaults.svg", options: {} },
    { name: "02-custom-dimensions.svg", options: { width: 800, height: 400 } },
    {
      name: "03-dark-theme.svg",
      options: { backgroundColor: "#1a1a2e", textColor: "#e94560", text: "LOREM PIXAR", width: 600, height: 300 },
    },
    {
      name: "04-named-colors.svg",
      options: { backgroundColor: "tomato", textColor: "white", text: "Tomato & Cream", width: 500, height: 250 },
    },
    {
      name: "05-small-badge.svg",
      options: { backgroundColor: "#4caf50", textColor: "white", text: "ACTIVE", width: 120, height: 40 },
    },
    {
      name: "06-large-billboard.svg",
      options: { backgroundColor: "#0d47a1", textColor: "#ffeb3b", text: "1200×400", width: 1200, height: 400 },
    },
    {
      name: "07-square-thumbnail.svg",
      options: { backgroundColor: "#f3e5f5", textColor: "#6a1b9a", text: "Photo", width: 400, height: 400 },
    },
    {
      name: "08-skinny-skyscraper.svg",
      options: { backgroundColor: "#263238", textColor: "#eceff1", text: "Sidebar", width: 160, height: 600 },
    },
    {
      name: "08b-custom-fontsize.svg",
      options: { backgroundColor: "#37474f", textColor: "#ffab40", text: "BIG TEXT", width: 600, height: 200, fontSize: 60 },
    },
    {
      name: "08c-persian.svg",
      options: { backgroundColor: "#1a1a2e", textColor: "#00bfa5", text: "لورم ایپسوم", width: 600, height: 250, fontSize: 42 },
    },
  ];

  for (const { name, options } of svgSamples) {
    writeFileSync(`${outDir}/${name}`, generateSVG(options), "utf-8");
  }

  // Font family showcase — same canvas, different typefaces
  const fontFamilies: { name: string; family: string }[] = [
    { name: "ff-01-monospace.svg", family: "Courier New, monospace" },
    { name: "ff-02-serif.svg", family: "Georgia, Times New Roman, serif" },
    { name: "ff-03-sans-serif.svg", family: "Arial, Helvetica, sans-serif" },
    { name: "ff-04-cursive.svg", family: "Brush Script MT, Comic Sans MS, cursive" },
    { name: "ff-05-fantasy.svg", family: "Impact, Papyrus, fantasy" },
  ];
  for (const { name, family } of fontFamilies) {
    const svg = generateSVG({
      width: 500,
      height: 120,
      backgroundColor: "#37474f",
      textColor: "#eceff1",
      text: family,
      fontSize: 22,
      fontFamily: family,
    });
    writeFileSync(`${outDir}/${name}`, svg, "utf-8");
  }

  // External font samples (Google Fonts via @import)
  const externalFontSamples: { name: string; fontFamily: string; importUrl: string; text: string }[] = [
    {
      name: "ef-01-bangers.svg",
      fontFamily: "'Bangers', cursive",
      importUrl: "https://fonts.googleapis.com/css2?family=Bangers",
      text: "BANGERS!",
    },
    {
      name: "ef-02-cairo.svg",
      fontFamily: "'Cairo', sans-serif",
      importUrl: "https://fonts.googleapis.com/css2?family=Cairo",
      text: "الخط العربي",
    },
    {
      name: "ef-03-pacifico.svg",
      fontFamily: "'Pacifico', cursive",
      importUrl: "https://fonts.googleapis.com/css2?family=Pacifico",
      text: "Pacifico Script",
    },
  ];
  for (const { name, fontFamily, importUrl, text } of externalFontSamples) {
    const svg = generateSVG({
      width: 500,
      height: 150,
      backgroundColor: "#263238",
      textColor: "#ffab40",
      text,
      fontFamily,
      fontSize: 40,
      style: `@import url('${importUrl}');`,
    });
    writeFileSync(`${outDir}/${name}`, svg, "utf-8");
  }

  // Font size showcase — same canvas, different sizes
  const fontSizes = [8, 12, 16, 24, 36, 48, 72, 96, 128];
  for (const size of fontSizes) {
    const name = `fnt-${String(size).padStart(3, "0")}px.svg`;
    const svg = generateSVG({
      width: 500,
      height: 150,
      backgroundColor: "#2c3e50",
      textColor: "#ecf0f1",
      text: `${size}px`,
      fontSize: size,
    });
    writeFileSync(`${outDir}/${name}`, svg, "utf-8");
  }

  // Raster samples (same design, different formats)
  const rasterSamples: { name: string; options: PlaceholderOptions }[] = [
    { name: "09-default.png", options: { width: 600, height: 300 } },
    { name: "10-dark.jpg", options: { width: 600, height: 300, backgroundColor: "#1a1a2e", textColor: "#e94560", text: "JPEG Sample", format: "jpeg", quality: 80 } },
    { name: "11-badge.webp", options: { width: 200, height: 60, backgroundColor: "#ff5722", textColor: "white", text: "SALE", format: "webp", quality: 85 } },
    { name: "12-billboard.png", options: { width: 1200, height: 400, backgroundColor: "#01579b", textColor: "#ffeb3b", text: "Hero — PNG", format: "png" } },
    { name: "13-thumb.jpg", options: { width: 300, height: 300, backgroundColor: "#e8eaf6", textColor: "#1a237e", text: "Avatar", format: "jpeg", quality: 70 } },
    { name: "14-low-quality.webp", options: { width: 400, height: 200, backgroundColor: "#263238", textColor: "#eceff1", text: "Low Q WebP", format: "webp", quality: 5 } },
    { name: "15-skyscraper.png", options: { width: 160, height: 600, backgroundColor: "#4a148c", textColor: "#f3e5f5", text: "AD", format: "png" } },
  ];

  for (const { name, options } of rasterSamples) {
    const buf = await generateImage(options);
    writeFileSync(`${outDir}/${name}`, buf);
  }

  const total = svgSamples.length + fontFamilies.length + externalFontSamples.length + fontSizes.length + rasterSamples.length;
  console.log(`\nGenerated ${total} sample images in "${outDir}/"`);
}

main();
