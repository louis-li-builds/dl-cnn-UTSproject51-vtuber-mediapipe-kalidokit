import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "node:url";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectAssetsDir = path.resolve(__dirname, "assets");

/**
 * Serve `vtuber-demo/assets/` at `/assets/*` in dev (Windows often lacks a
 * working `public/assets` symlink). Copy the same tree into `dist/assets` on
 * build so `preview`/static hosts see VRM + gesture ONNX.
 */
function projectAssetsPlugin() {
  return {
    name: "project-assets-from-repo",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0];
        if (!pathname.startsWith("/assets/")) return next();

        const rel = pathname.replace(/^\/assets\/?/, "").replace(/\\/g, "/");
        if (!rel || rel.includes("..")) return next();

        const abs = path.resolve(projectAssetsDir, rel);
        const root = path.resolve(projectAssetsDir);
        if (!abs.startsWith(root + path.sep) && abs !== root) return next();

        if (!existsSync(abs)) return next();
        let st;
        try {
          st = statSync(abs);
        } catch {
          return next();
        }
        if (!st.isFile()) return next();

        const buf = readFileSync(abs);
        if (pathname.endsWith(".vrm")) {
          res.setHeader("Content-Type", "model/gltf-binary");
        } else if (pathname.endsWith(".json")) {
          res.setHeader("Content-Type", "application/json");
        } else if (pathname.endsWith(".onnx")) {
          res.setHeader("Content-Type", "application/octet-stream");
        }
        res.end(buf);
      });
    },
    writeBundle() {
      const dest = path.join(__dirname, "dist", "assets");
      mkdirSync(dest, { recursive: true });
      if (existsSync(projectAssetsDir)) {
        cpSync(projectAssetsDir, dest, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  build: {
    /** Avoid clash with emitted `/assets/` (VRM + ONNX tree). */
    assetsDir: "_bundle",
  },
  plugins: [
    react(),
    tailwindcss(),
    projectAssetsPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  assetsInclude: ["**/*.svg", "**/*.csv"],
});
