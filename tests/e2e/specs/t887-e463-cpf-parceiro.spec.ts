import { test, expect, type Browser } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T887 — E463 (PC7): o CPF do parceiro divergia entre telas da mesma conta (aba Dados do painel de parceiro mostrava o
 * documento do pedido de parceria; Conta → Dados dizia "Ainda não informado"). Agora as duas telas leem o perfil:
 *  - conta COM CPF no perfil: a aba Dados e Conta → Dados mostram a MESMA máscara;
 *  - conta SEM CPF no perfil (parceiros.documento preenchido): as duas dizem "Ainda não informado", e a aba Dados leva
 *    a Conta → Documento. 390 e 1280 px.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const comCpf = { email: `parc.cpf.t887.${sufixo}@lab.vivanomads.test`, nome: "Paula Com Cpf", role: "tenant" as const };
const semCpf = { email: `parc.semcpf.t887.${sufixo}@lab.vivanomads.test`, nome: "Rui Sem Cpf", role: "tenant" as const };
const ids: { com?: string; sem?: string } = {};

async function parceiro(userId: string, slug: string) {
  const { error } = await adm().from("parceiros").insert({
    user_id: userId,
    tipo_pessoa: "pf",
    documento: cpfAleatorio(),
    nome_publico: `Parceiro ${slug}`,
    slug,
    categorias: ["fotografia"],
    cidades: ["Uberlândia"],
    status: "rascunho",
  });
  if (error) throw error;
}

async function abaDados(browser: Browser, email: string, largura: number) {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto("/dashboard/parceiro", { waitUntil: "domcontentloaded" });
  await page.getByTestId("parceiro-aba-dados").click({ timeout: 30_000 });
  return page;
}

test.describe("T887 — E463: CPF do parceiro com fonte única", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.com = await criarConta(comCpf, senha);
    ids.sem = await criarConta(semCpf, senha, false);
    await parceiro(ids.com, `t887-com-${sufixo}`);
    await parceiro(ids.sem, `t887-sem-${sufixo}`);
  });

  test.afterAll(async () => {
    await adm().from("parceiros").delete().in("user_id", [ids.com, ids.sem].filter(Boolean) as string[]);
    await apagarContas([ids.com, ids.sem]);
  });

  for (const largura of [390, 1280]) {
    test(`a ${largura}px: com CPF no perfil, a aba Dados e Conta → Dados mostram a mesma máscara`, async ({ browser }) => {
      const page = await abaDados(browser, comCpf.email, largura);
      const doc = page.getByTestId("parceiro-documento");
      await expect(doc).toHaveText(/^\*\*\*\.\d{3}\.\d{3}-\*\*$/, { timeout: 20_000 });
      const noPainel = (await doc.textContent())?.trim();
      await page.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("dados-documento")).toHaveValue(noPainel!, { timeout: 20_000 });
      await page.context().close();
    });

    test(`a ${largura}px: sem CPF no perfil, as duas telas dizem "Ainda não informado" e levam a Conta → Documento`, async ({ browser }) => {
      const page = await abaDados(browser, semCpf.email, largura);
      await expect(page.getByTestId("parceiro-documento")).toHaveText("Ainda não informado", { timeout: 20_000 });
      await expect(page.getByTestId("parceiro-documento-informar")).toHaveAttribute("href", "/dashboard/conta/dados#documento");
      await page.goto("/dashboard/conta/dados", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("dados-documento")).toHaveValue("", { timeout: 20_000 });
      await expect(page.getByTestId("dados-documento")).toHaveAttribute("placeholder", "Ainda não informado");
      await page.context().close();
    });
  }
});
