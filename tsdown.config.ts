import { defineConfig } from "tsdown";

export default defineConfig({
  deps: { neverBundle: ["vscode"] },
  entry: ["src/**/*"],
  unbundle: true,
});
