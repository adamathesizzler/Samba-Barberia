// Empaqueta el prototipo en un solo HTML (CSS y JS en línea) para publicarlo como página de vista previa.
// Uso: npm run build:preview  →  app/preview/samba.html + app/preview/photos/
import { readFileSync, writeFileSync, readdirSync, mkdirSync, cpSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;
const assets = join(dist, "assets");
const files = readdirSync(assets);
const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(assets, f), "utf8")).join("\n");
const js = files
  .filter((f) => f.endsWith(".js"))
  .map((f) => readFileSync(join(assets, f), "utf8"))
  .join("\n")
  // Un «</script» dentro del código cerraría la etiqueta antes de tiempo.
  .replace(/<\/script/gi, "<\\/script");

const html = `<title>Samba Barbería</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<meta name="color-scheme" content="light dark">
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;

const out = new URL("../preview/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "samba.html"), html);
// Las fotos de muestra se publican junto a la página (photos/*.jpg).
cpSync(join(dist, "photos"), join(out, "photos"), { recursive: true });
console.log(`preview/samba.html · ${(html.length / 1024).toFixed(0)} KB`);
