// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TITULO_PASSO, type PassoCadastro } from "../fixtures/cadastro";

/*
  T455 — E108–E110 (textos do assistente de cadastro), na QA do Muse. Só no laboratório (conta nova de proprietário).
   1. Nos 10 passos, o texto da tela não tem "Prompt NN", "inquilino" nem "Em breve" (E108, E109, E110).
   2. Passo 6: "Regras da casa" só no título do passo, não repetido como subtítulo (E110).
   3. Passo 8: um horizonte só — a taxa do simulador e o comparador do Airbnb acompanham os mesmos meses (E110, E140);
      sem o seguro-fiança "Em breve" (E110).
   4. Passo 9: a faixa de 30 a 90 dias diz "proprietário e morador" (E109).
  A 390 e 1280 px, com prints.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.textos.${sufixo}@lab.vivanomads.test`, nome: "Rui Textos", role: "owner" as const };
const ids: { dono?: string } = {};
const SAIDA = "tests/laboratorio/saida";
const PASSOS = Object.keys(TITULO_PASSO) as PassoCadastro[];
const PROIBIDO = /\bPrompt \d+|\binquilin[oa]s?\b|\bem breve\b/i;

async function irPara(page: Page, passo: PassoCadastro) {
  // Com rascunho no servidor (o autosave cria no meio da volta), o "Novo anúncio" ignora o ?etapa= e oferece retomar:
  // abre o próprio rascunho no passo (?draft=<id>&etapa=), que sempre vai ao passo pedido.
  const { data } = await adm().from("properties").select("id").eq("owner_id", ids.dono!).eq("status", "draft").limit(1);
  const draft = data?.[0]?.id as string | undefined;
  await page.goto(`/dashboard/imoveis/novo?${draft ? `draft=${draft}&` : ""}etapa=${passo}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("passo-titulo")).toHaveText(TITULO_PASSO[passo], { timeout: 30_000 });
}

test.describe("T455 — E108–E110: textos do assistente de cadastro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: sem 'Prompt NN', 'inquilino' nem 'Em breve'; Regras sem repetir; Passo 8 com um horizonte só`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });

      for (const passo of PASSOS) {
        await irPara(page, passo);
        const texto = await page.locator("main").innerText();
        expect(texto.match(PROIBIDO)?.[0] ?? null, `Passo ${passo}`).toBeNull();
      }

      // 2. Passo 6: o título do passo e nenhum subtítulo igual.
      await irPara(page, "regras");
      await expect(page.getByText("Regras da casa", { exact: true })).toHaveCount(1);
      await page.screenshot({ path: `${SAIDA}/t455-regras-${w}.png` });

      // 3. Passo 8 (E110 → E139/E140): um período só — o simulador e o comparador do Airbnb dizem os mesmos meses.
      await irPara(page, "preco");
      await page.getByTestId("cadastro-preco").fill("3600");
      const simulador = page.getByTestId("simulador-bolso");
      const meses = simulador.getByTestId("bolso-meses");
      await expect(simulador.getByTestId("bolso-taxa-detalhe")).toContainText(`× ${await meses.inputValue()} =`);
      await meses.fill("6");
      await expect(simulador.getByTestId("bolso-taxa-detalhe")).toContainText("(R$ 3.600 × 6 = R$ 21.600)");
      const comparar = page.getByTestId("preco-sugerido");
      await comparar.getByRole("button", { name: /Comparar com o Airbnb/ }).click();
      await expect(comparar).toContainText("pelos mesmos 6 meses");
      await expect(page.getByText("Seguro-fiança")).toHaveCount(0);
      await simulador.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t455-preco-${w}.png` });

      // 4. Passo 9: a faixa de 30 a 90 dias com "morador".
      await irPara(page, "disponibilidade");
      const aviso = page.getByText(/proprietário e morador combinam a saída/);
      await expect(aviso).toBeVisible();
      await aviso.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t455-disponibilidade-${w}.png` });
      await page.context().close();
    });
  }
});
