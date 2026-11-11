import { expect, test, type Page } from "@playwright/test";

const USUARIO = process.env.E2E_USUARIO ?? "ddtrix";
const SENHA = process.env.E2E_SENHA ?? "senha-de-teste-123";

async function entrar(page: Page, nome: string) {
  await page.goto("/entrar");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  await page.getByLabel("Usuário").fill(USUARIO);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
  await page.getByLabel("Seu nome").fill(nome);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(nome);
}

test("interpretar agenda, conferir e gerar o PDF", async ({ page }, info) => {
  test.setTimeout(120_000);
  const marca = `${info.project.name}${Date.now() % 100000}`;
  await entrar(page, `Teste ${info.project.name}`);

  const agenda = `AGENDA (Quarta-Feira) 11/11
1.
📅 DATA: 11/11/2026
👤 CLIENTE: Cliente Teste ${marca}
📍 SERVIÇO: Limpeza de caixa D'água
🚗 LOCAL: Rua das Flores, 100 - Jardim Teste
⏰ HORÁRIO APROXIMADO: 09Hrs
💰 Preço: R$ 300 cartão
2.
📅 DATA: 11/11/2026
👤 CLIENTE: Outro Teste ${marca}
📍 SERVIÇO: Dedetização completa
🚗 LOCAL: Avenida Brasil, 50 - Centro
⏰ HORÁRIO APROXIMADO: 14:30Hrs`;

  await page.getByLabel("Agenda").fill(agenda);
  await page.getByRole("button", { name: "Interpretar" }).click();
  await expect(page).toHaveURL(/\/emitir\/[0-9a-f-]+$/, { timeout: 30_000 });
  await expect(page.getByText("2 atendimentos encontrados")).toBeVisible();
  await expect(page.getByText("LEVAR A MAQUININHA").first()).toBeVisible();

  // Sem rolagem horizontal.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

  await page.getByRole("link", { name: new RegExp(`Cliente Teste ${marca}`) }).click();
  await expect(page.getByRole("heading", { name: `Cliente Teste ${marca}` })).toBeVisible();
  await expect(page.getByLabel("Rua e número")).toHaveValue("Rua das Flores, 100");

  // Prévia da folha aparece (no celular, pela aba).
  if (info.project.name === "celular") await page.getByRole("tab", { name: "Prévia" }).click();
  await expect(page.getByAltText("Prévia da folha da O.S.")).toBeVisible({ timeout: 60_000 });
  if (info.project.name === "celular") await page.getByRole("tab", { name: "Dados" }).click();

  const download = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByRole("button", { name: "Confirmar e gerar PDF" }).click();
  const arquivo = await download;
  expect(arquivo.suggestedFilename()).toMatch(/^OS_20261111CX.*\.pdf$/);
  await expect(page.getByText("Emitida", { exact: true }).first()).toBeVisible();
});
