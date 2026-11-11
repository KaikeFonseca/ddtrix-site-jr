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

const semRolagemLateral = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

test("cadastrar cliente, achar na busca e editar", async ({ page }, info) => {
  const nome = `Cliente E2E ${info.project.name} ${Date.now() % 100000}`;
  await entrar(page, `Teste ${info.project.name}`);
  await page.goto("/clientes/novo");
  await expect(page.getByLabel("Nome")).toBeEditable();
  await page.getByLabel("Nome").fill(nome);
  await page.getByLabel("Telefone 1").fill("(15) 98888-7777");
  await page.getByLabel("Rua e número").fill("Rua do Teste, 10");
  await page.getByLabel("Bairro").fill("Centro");
  await page.getByRole("button", { name: "Cadastrar cliente" }).click();
  await expect(page.getByRole("heading", { name: nome })).toBeVisible();
  await expect(page.getByText("Rua do Teste, 10")).toBeVisible();
  await semRolagemLateral(page);

  await page.getByLabel("Observações importantes").fill("Portão azul");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Salvo.")).toBeVisible();

  await page.goto("/clientes");
  await page.getByLabel("Buscar cliente").fill("98888");
  await expect(page.getByRole("link", { name: nome, exact: true })).toBeVisible();
});

test("histórico filtra e reaproveita uma O.S.", async ({ page }, info) => {
  await entrar(page, `Teste ${info.project.name}`);
  await page.goto("/historico");
  await expect(page.getByRole("heading", { name: "Histórico" })).toBeVisible();
  await semRolagemLateral(page);
  await page.getByRole("button", { name: "Dedetização" }).click();
  await expect(page).toHaveURL(/categoria=dedet/);
  const nova = page.getByRole("button", { name: "Nova O.S. a partir desta" }).first();
  await expect(nova).toBeVisible();
  await nova.click();
  await expect(page).toHaveURL(/\/os\/[0-9a-f-]+$/);
  await expect(page.getByLabel("Data")).toHaveValue("");
  await expect(page.getByText(/Falta: data, horário/)).toBeVisible();
});

test("administração mostra modelos, testa e salva a validade do CEVS", async ({ page }, info) => {
  test.setTimeout(90_000);
  await entrar(page, `Teste ${info.project.name}`);
  await page.goto("/administracao");
  await expect(page.getByRole("heading", { name: "O.S. Limpeza de caixas" })).toBeVisible();
  await semRolagemLateral(page);
  const primeira = page.locator(".versao.oficial").first();
  await primeira.getByRole("button", { name: "Testar" }).click();
  await expect(page.getByAltText("Teste do modelo preenchido com dados falsos")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Todos os campos foram preenchidos.")).toBeVisible();

  await page.getByRole("link", { name: "Configurações" }).click();
  const cevs = page.getByLabel("Validade do CEVS");
  const atual = await cevs.inputValue();
  await cevs.fill("99/99");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.locator("p.erro")).toContainText("dd/mm/aaaa");
  await cevs.fill(atual);

  await page.getByRole("link", { name: "Histórico de alterações" }).click();
  await expect(page.getByText(/entrou|criou|alterou|emitiu/).first()).toBeVisible();
});

test("o que um aparelho cadastra aparece no outro sozinho", async ({ browser }, info) => {
  test.skip(info.project.name !== "computador", "basta rodar uma vez");
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await entrar(a, "Aparelho A");
  await entrar(b, "Aparelho B");
  await b.goto("/clientes");
  const nome = `Sincronia ${Date.now() % 100000}`;
  await a.goto("/clientes/novo");
  await expect(a.getByLabel("Nome")).toBeEditable();
  await a.getByLabel("Nome").fill(nome);
  await a.getByRole("button", { name: "Cadastrar cliente" }).click();
  await expect(a.getByRole("heading", { name: nome })).toBeVisible();
  // Sem recarregar a página do aparelho B.
  await expect(b.getByRole("link", { name: nome, exact: true })).toBeVisible({ timeout: 20_000 });
});
