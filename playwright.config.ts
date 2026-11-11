import { defineConfig, devices } from "@playwright/test";

const PORTA = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  expect: { timeout: 15_000 },
  use: { baseURL: `http://localhost:${PORTA}` },
  projects: [
    { name: "computador", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next dev -p ${PORTA}`,
    url: `http://localhost:${PORTA}/entrar`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
