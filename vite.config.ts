import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The local-relay worker is an ES module worker spawned via
// `new Worker(new URL("@formstr/local-relay/worker", import.meta.url))`.
// `worker.format: "es"` makes Vite emit it as an ES module in the build.
export default defineConfig({
  plugins: [react()],
  worker: { format: "es" },
});
