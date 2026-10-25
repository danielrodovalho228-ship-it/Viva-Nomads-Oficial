import { test, expect, devices, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso, type PassoCadastro } from "../fixtures/cadastro";

/*
  T471 — levantamento do Daniel (25/10), Passos 3 e 9:
   E147. Bairro "Minas Gerais" (o estado) é recusado no Passo 3 com a mensagem no próprio passo.
   E136. No celular, as datas do Passo 9 aparecem em pt-BR (25/10/2026), nunca "Oct 25, 2026".
   E137. Janela 25/10→18/11 (24 dias) com mínimo de 30: aviso e o Continuar não avança; com 30 dias, avança.
   E138. Calendário: bloquear o mesmo período duas vezes mostra UM bloqueio; tocar no dia bloqueado oferece Desbloquear.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t476.${sufixo}@lab.vivanomads.test`, nome: "Dalia Datas", role: "owner" as const };
const ids: Record<string, string> = {};
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

async function abrir(p: Page, passo: PassoCadastro) {
  await p.goto(`/dashboard/imoveis/novo?etapa=${passo}`, { waitUntil: "domcontentloaded" });
  const aviso = p.getByTestId("rascunho-aviso");
  await expect(p.getByTestId("passo-titulo").or(aviso).first()).toBeVisible({ timeout: 30_000 });
  if (await aviso.isVisible()) {
    await aviso.getByRole("button", { name: "Começar outro" }).click();
    await p.goto(`/dashboard/imoveis/novo?etapa=${passo}`, { waitUntil: "domcontentloaded" });
  }
  await noPasso(p, passo, 30_000);
}

test.describe("T476 — Passos 3 e 9 (E136, E137, E138, E147)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("E147: bairro = estado é recusado no Passo 3", async ({ browser }) => {
    const p = await entrarNaPagina(await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage(), dono.email, senha);
    await abrir(p, "endereco");
    await p.getByTestId("cadastro-bairro").fill("Minas Gerais");
    await p.getByTestId("cadastro-continuar").click();
    await noPasso(p, "endereco");
    await expect(p.getByTestId("passo-erros")).toContainText("“Minas Gerais” é um estado, não um bairro. Informe o bairro do imóvel.");
    await p.screenshot({ path: `${SAIDA}/t476-bairro-estado-390.png`, fullPage: true });
    await p.context().close();
  });

  test("E136 + E137 + E138: datas em pt-BR, janela curta recusada, calendário sem duplicar e com Desbloquear", async ({ browser }) => {
    const { defaultBrowserType: _t, ...iphone } = devices["iPhone 13"];
    void _t;
    const ctx = await browser.newContext({ ...iphone, locale: "en-US" });
    const p = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
    // O calendário do Passo 9 só aparece num rascunho já salvo no servidor: abre um pronto (criado só aqui, depois do
    // teste do Passo 3, para o aviso "anúncio em andamento" não desviar aquele teste).
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho t476 ${sufixo}`, {});
    await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=disponibilidade`, { waitUntil: "domcontentloaded" });
    await noPasso(p, "disponibilidade", 30_000);
    const de = dia(2);
    const ateCurto = dia(26); // 24 dias
    await p.getByTestId("disponivel-de").fill(de);
    await p.getByTestId("disponivel-ate").fill(ateCurto);
    // E136: o que se lê é pt-BR mesmo com o aparelho em inglês.
    await expect(p.getByTestId("disponivel-de-texto")).toHaveText(br(de));
    await expect(p.getByTestId("disponivel-ate-texto")).toHaveText(br(ateCurto));
    // E137: aviso no passo e o Continuar não avança.
    await expect(p.getByTestId("janela-curta")).toContainText("são 24 dias — menos que a duração mínima de 30 dias");
    await p.getByTestId("cadastro-continuar").tap();
    await noPasso(p, "disponibilidade");
    await expect(p.getByTestId("passo-erros")).toContainText("menos que a duração mínima de 30 dias");
    await p.screenshot({ path: `${SAIDA}/t476-janela-curta-390.png`, fullPage: true });

    // E138: o calendário (aparece com o rascunho salvo): um bloqueio, e o dia bloqueado não se bloqueia de novo.
    const grade = p.getByTestId("calendario-dono-grade");
    await expect(grade).toBeVisible({ timeout: 40_000 });
    const alvo = dia(10);
    const celula = grade.locator(`[data-dia="${alvo}"]`).first();
    await celula.tap();
    await p.getByRole("button", { name: "Bloquear período" }).tap();
    await expect(p.getByTestId("bloqueio-item")).toHaveCount(1, { timeout: 15_000 });
    // Tocar de novo no dia bloqueado NÃO o seleciona para bloquear outra vez (não há caminho para duplicar): abre as
    // opções do dia. A idempotência no servidor (mesmo início e fim = o mesmo bloqueio) tem teste unitário.
    await celula.tap();
    await expect(p.getByTestId("dia-bloqueado-opcoes")).toBeVisible();
    await expect(p.getByRole("button", { name: "Bloquear período" })).toBeDisabled();
    await expect(p.getByTestId("bloqueio-item")).toHaveCount(1);
    await p.screenshot({ path: `${SAIDA}/t476-dia-bloqueado-390.png`, fullPage: true });
    await p.getByTestId("calendario-desbloquear").tap();
    await p.getByTestId("calendario-desbloquear-confirmar").tap();
    await expect(p.getByTestId("bloqueio-item")).toHaveCount(0, { timeout: 15_000 });

    // Com 30 dias a janela cabe e o Continuar avança.
    await p.getByTestId("disponivel-ate").fill(dia(32));
    // Primeiro o valor (o texto pt-BR do campo), depois o aviso: separa "não entrou" de "não recalculou".
    await expect(p.getByTestId("disponivel-ate")).toHaveValue(dia(32));
    await expect(p.getByTestId("disponivel-ate-texto")).toHaveText(br(dia(32)));
    await expect(p.getByTestId("janela-curta")).toHaveCount(0);
    await p.getByTestId("cadastro-continuar").tap();
    await noPasso(p, "revisao", 20_000);
    await ctx.close();
  });
});
