import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/bin.ts"],
  format: "esm",
  target: "node20",
  splitting: true,
  clean: true,
  dts: { resolve: ["@opsy/contracts"] },
  external: ["yaml", "commander"],
  noExternal: ["@opsy/contracts"],
});
