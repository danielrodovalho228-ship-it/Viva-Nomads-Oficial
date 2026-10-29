// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T484 — E148-A: ao entrar no Passo 7 com título E descrição vazios, o passo chama a sugestão uma vez e preenche os dois
  campos (editáveis, "Sugestão, edite à vontade"). Sem IA (no laboratório a rota responde 503), o modelo fixo monta o
  texto com os dados do cadastro: o passo nunca abre vazio. O texto do dono nunca é sobrescrito; "Gerar de novo" por
  cima dele pede confirmação.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t484.${sufixo}@lab.vivanomads.test`, nome: "Telma Texto", role: "owner" as const };
const ids: Record<string, string> = {};
const DADOS = { propertyType: "apartamento", bedrooms: "2", bathrooms: "1", areaM2: "58", neighborhood: "Santa Mônica", internetMbps: "300", amenityKeys: { ar_condicionado: true, maquina_lavar: true } };
/** Abre o Passo 7 do rascunho com a rota da IA simulada ANTES de a página carregar (a sugestão sai na entrada). */
async function abrirComIa(browser: Browser, id: string, largura: number, conta: { chamadas: number }): Promise<Page> {
  const contexto = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
  await contexto.route("**/api/ai/anuncio", async (r) => {
    conta.chamadas++;
    await new Promise((ok) => setTimeout(ok, 800));
    await r.fulfill({ json: { titulo: "Apartamento mobiliado com varanda no Santa Mônica", descricao: "Dois quartos, ar-condicionado e internet de 300 Mbps, pronto para o morador em estadias de 30 a 180 dias." } });
  });
  const page = await entrarNaPagina(await contexto.newPage(), dono.email, senha);
  await page.goto(`/dashboard/imoveis/novo?draft=${id}&etapa=descricao`, { waitUntil: "domcontentloaded" });
  await noPasso(page, "descricao", 30_000);
  return page;
}
const PROIBIDAS = /\b(alugu[eé]l|temporada|inquilin[oa]s?|comiss[ãa]o)\b/i;

test.describe("T484 — E148-A: título e descrição sugeridos no Passo 7", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — IA respondendo: preenche os dois campos uma vez, com o rótulo e "Gerar de novo"`, async ({ browser }) => {
      const id = await prepararRascunho(ids.dono, `Rascunho t484 ${sufixo}`, { ...DADOS, title: "", description: "" }, 0);
      const conta = { chamadas: 0 };
      const page = await abrirComIa(browser, id, largura, conta);
      await expect(page.getByTestId("cadastro-titulo")).toHaveValue("Apartamento mobiliado com varanda no Santa Mônica", { timeout: 30_000 });
      await expect(page.getByTestId("cadastro-descricao")).toHaveValue(/estadias de 30 a 180 dias/);
      await expect(page.getByTestId("sugestao-rotulo")).toHaveText("Sugestão, edite à vontade.");
      await expect(page.getByTestId("sugestao-gerar-de-novo")).toBeVisible();
      // Um só botão cheio no passo: o Continuar.
      await expect(page.locator('[data-cta="primary"]:visible')).toHaveCount(1);
      await page.screenshot({ path: `${SAIDA}/t484-sugestao-ia-${largura}.png` });
      // Os campos seguem editáveis; o dono troca a descrição e "Gerar de novo" pede confirmação antes de substituir.
      await page.getByTestId("cadastro-descricao").fill("Descrição que eu mesmo escrevi.");
      await page.getByTestId("sugestao-gerar-de-novo").click();
      await expect(page.getByTestId("sugestao-gerar-de-novo-confirmacao")).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/t484-gerar-de-novo-confirma-${largura}.png` });
      await page.getByTestId("sugestao-gerar-de-novo-cancelar").click();
      await expect(page.getByTestId("cadastro-descricao")).toHaveValue("Descrição que eu mesmo escrevi.");
      expect(conta.chamadas, "uma chamada só ao entrar").toBe(1);
      await page.context().close();
      await adm().from("properties").delete().eq("id", id);
    });
  }

  test("IA fora do ar (503 no laboratório): o modelo fixo preenche com os dados do cadastro, sem palavra proibida", async ({ browser }) => {
    const id = await prepararRascunho(ids.dono, `Rascunho t484b ${sufixo}`, { ...DADOS, title: "", description: "" }, 0);
    const page = await abrirPasso(browser, { email: dono.email, senha }, id, "descricao", 390);
    await expect(page.getByTestId("cadastro-titulo")).toHaveValue("Apartamento mobiliado de 2 quartos no Santa Mônica", { timeout: 30_000 });
    const descricao = await page.getByTestId("cadastro-descricao").inputValue();
    expect(descricao).toContain("2 quartos, 1 banheiro e 58 m²");
    expect(descricao).toContain("Internet de 300 Mbps");
    expect(descricao).toContain("Para estadias de 30 a 180 dias.");
    expect(descricao).not.toMatch(PROIBIDAS);
    // Texto pronto não é IA: sem "Gerar de novo" (que só faz sentido com a IA respondendo).
    await expect(page.getByTestId("sugestao-gerar-de-novo")).toHaveCount(0);
    await page.screenshot({ path: `${SAIDA}/t484-modelo-fixo-390.png` });
    await page.context().close();
    await adm().from("properties").delete().eq("id", id);
  });

  test("texto do dono já escrito: o passo não pede sugestão nem troca nada", async ({ browser }) => {
    const id = await prepararRascunho(ids.dono, "Meu título escrito à mão", { ...DADOS, description: "" }, 0);
    const conta = { chamadas: 0 };
    const page = await abrirComIa(browser, id, 1280, conta);
    await expect(page.getByTestId("cadastro-titulo")).toHaveValue("Meu título escrito à mão", { timeout: 30_000 });
    await page.waitForTimeout(2_000);
    await expect(page.getByTestId("cadastro-titulo")).toHaveValue("Meu título escrito à mão");
    await expect(page.getByTestId("cadastro-descricao")).toHaveValue("");
    expect(conta.chamadas).toBe(0);
    await page.context().close();
    await adm().from("properties").delete().eq("id", id);
  });
});
