import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nunjucks from "nunjucks";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "dist");
const sourceDir = path.join(root, "src");
const pagesDir = path.join(sourceDir, "pages");

const legacyPages = [
  "index.html",
  "gallery.html",
  "custom-order.html",
  "perivelle.html",
  "studio-console-7f3c9a.html"
];

const templateOutputs = {
  "home.njk": "index.html",
  "gallery.njk": "gallery.html",
  "custom-order.njk": "custom-order.html",
  "perivelle.njk": "perivelle.html",
  "admin.njk": "studio-console-7f3c9a.html"
};

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function copyIfPresent(from, to) {
  if (await exists(from)) {
    await fs.cp(from, to, { recursive: true, force: true });
  }
}

async function build() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  // Keep existing public URLs working while pages are migrated one at a time.
  for (const page of legacyPages) {
    await copyIfPresent(path.join(root, page), path.join(outputDir, page));
  }

  // Static assets retain their existing relative paths in the generated site.
  await copyIfPresent(path.join(root, "assets"), path.join(outputDir, "assets"));

  if (await exists(pagesDir)) {
    const env = nunjucks.configure(sourceDir, {
      autoescape: false,
      noCache: true,
      throwOnUndefined: true
    });

    for (const [templateName, outputName] of Object.entries(templateOutputs)) {
      const templatePath = path.join(pagesDir, templateName);
      if (!(await exists(templatePath))) continue;

      const rendered = env.render(path.posix.join("pages", templateName));
      await fs.writeFile(path.join(outputDir, outputName), rendered, "utf8");
      console.log(`Rendered src/pages/${templateName} -> dist/${outputName}`);
    }
  }

  console.log("Perivelle build completed.");
}

build().catch((error) => {
  console.error("Perivelle build failed:", error);
  process.exitCode = 1;
});
