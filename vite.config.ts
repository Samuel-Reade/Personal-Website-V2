import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Deep imports into three/examples aren't discovered by Vite's dependency
    // scan, so in dev they load three's raw ESM while the app gets the
    // pre-bundled copy — two module instances, which three warns about and
    // which quietly breaks instanceof checks across the boundary.
    include: [
      "three/examples/jsm/loaders/FontLoader.js",
      "three/examples/jsm/geometries/TextGeometry.js",
      "three/examples/jsm/utils/BufferGeometryUtils.js",
    ],
  },
});
