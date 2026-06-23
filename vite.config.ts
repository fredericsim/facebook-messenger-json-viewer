import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react(), inlineBuildAssets()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

function inlineBuildAssets(): Plugin {
  return {
    name: "inline-build-assets",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const htmlFile = bundle["index.html"];

      if (!htmlFile || htmlFile.type !== "asset") {
        return;
      }

      let html = String(htmlFile.source);

      for (const [fileName, file] of Object.entries(bundle)) {
        if (file.type === "chunk" && fileName.endsWith(".js")) {
          html = html.replace(scriptTagPattern(fileName), () => `<script type="module">\n${file.code}\n</script>`);
          delete bundle[fileName];
        }

        if (file.type === "asset" && fileName.endsWith(".css")) {
          html = html.replace(styleTagPattern(fileName), () => `<style>\n${String(file.source)}\n</style>`);
          delete bundle[fileName];
        }
      }

      htmlFile.source = html;
    },
  };
}

function scriptTagPattern(fileName: string): RegExp {
  return new RegExp(`<script type="module" crossorigin src="\\./${escapeRegExp(fileName)}"></script>`);
}

function styleTagPattern(fileName: string): RegExp {
  return new RegExp(`<link rel="stylesheet" crossorigin href="\\./${escapeRegExp(fileName)}">`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
