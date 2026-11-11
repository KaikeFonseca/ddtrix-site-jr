import { expect, test } from "@playwright/test";

// Usa a conta de desenvolvimento do .env.local (usuário ddtrix).
const USUARIO = process.env.E2E_USUARIO ?? "ddtrix";
const SENHA = process.env.E2E_SENHA ?? "senha-de-teste-123";

test("sem login, qualquer tela leva para Entrar", async ({ page }) => {
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole("heading", { name: "Entrar no sistema" })).toBeVisible();
});

test("senha errada mostra mensagem clara", async ({ page }) => {
  await page.goto("/entrar");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  await page.getByLabel("Usuário").fill(USUARIO);
  await page.getByLabel("Senha").fill("errada");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("p.erro")).toHaveText("Usuário ou senha incorretos.");
});

test("login, quem está usando, início e histórico de alterações", async ({ page }, info) => {
  const nome = `Teste ${info.project.name}`;
  await page.goto("/entrar");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  await page.getByLabel("Usuário").fill(USUARIO);
  await page.getByLabel("Senha").fill(SENHA);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/quem$/);
  await expect(page.getByRole("button", { name: "Continuar" })).toBeEnabled();
  await page.getByLabel("Seu nome").fill(nome);
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: `Olá, ${nome}` })).toBeVisible();
  for (const item of ["Emitir O.S.", "Clientes", "Histórico", "Administração"]) {
    await expect(page.getByRole("link", { name: new RegExp(item) })).toBeVisible();
  }

  // Sem rolagem horizontal (seção 21).
  const larguraExtra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(larguraExtra).toBeLessThanOrEqual(0);

  await page.getByRole("link", { name: /Administração/ }).click();
  await expect(page.getByRole("cell", { name: nome }).first()).toBeVisible();

  // Sessão continua depois de recarregar.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Administração" })).toBeVisible();
});
