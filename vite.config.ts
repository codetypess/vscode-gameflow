import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "webview",
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../dist/webview",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
