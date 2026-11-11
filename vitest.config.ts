import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Os testes de banco usam o mesmo banco de teste: arquivos rodam um de cada vez.
  test: { include: ["src/**/*.test.ts"], environment: "node", fileParallelism: false },
});
