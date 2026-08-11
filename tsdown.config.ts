import { defineConfig } from "tsdown";

export default defineConfig({
  unbundle: true,
  entry: ["src/**/*"],
  deps: { neverBundle: ["vscode"] }
});
