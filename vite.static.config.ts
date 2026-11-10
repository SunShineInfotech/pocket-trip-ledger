import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  root: "static",
  base: "/trip/build_v1/",
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: resolve("src/routes"),
      generatedRouteTree: resolve("src/routeTree.gen.ts"),
    }),
    react(),
    tailwindcss(),
    tsconfigPaths({ projects: [resolve("tsconfig.json")] }),
  ],
  build: {
    outDir: "../dist-upload",
    emptyOutDir: true,
    rollupOptions: { input: resolve("static/index.html") },
  },
});
