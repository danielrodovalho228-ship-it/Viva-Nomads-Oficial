import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2201 — E985 @E985: o assistente grava a escolha por CARTÃO feita logo depois de abrir o rascunho. Antes, abrir o
  rascunho deixava o autosave "aguardando a base" e só input/change contavam como edição: o clique no cartão (botão
  role="radio") nos primeiros 2 s virava base e não era gravado. Rascunho com "Casa" → abre o passo Tipo → escolhe
  "Apartamento" na hora → o draft_data no banco passa a "apartamento". Só no laboratório (banco local + chave de serviço).
  ORDEM-DUET-828 (trava oca): a spec passava também sem a cura (10/10). Duas coisas a deixavam oca: o rascunho fora da
  ordem atual (abrir no passo Tipo contava como troca de passo, que grava sozinha) e o toque sem garantia de cair na
  janela dos 2 s. Agora o rascunho está na ordem atual e já no Tipo, e o relógio da página fica parado: o toque cai
  DENTRO da janela por construção, e só depois o relógio anda os 2,5 s em que o autosave decide "base" ou "edição".
  A sonda da ORDEM-DUET-829 provou o caminho: clock.install() sozinho não para o tempo; o toque corria contra o
  temporizador da base (sem a cura, o toque a 76 ms da carga virava base e não gravava; mais tarde, gravava).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2201.${sufixo}@lab.vivanomads.test`, nome: "Rita Cartão", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
/**
 * ORDEM-DUET-828: o rascunho na ordem atual dos passos (versão 5), já no passo Tipo (0). Sem isto, o rascunho reabria
 * na "primeira etapa incompleta" e o `?etapa=tipo` contava como troca de passo — e a troca grava em silêncio (E614)
 * com o conteúdo dentro, com ou sem a cura do E985. A trava passava sem o produto (10/10).
 */
const NA_ORDEM_ATUAL = { ordemEtapas: 5, step: 0, etapaMax: 0 };

test.describe("T2201 — E985: a escolha por cartão logo depois de abrir o rascunho é gravada", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Rascunho do cartão ${sufixo}`);
    const { error } = await adm()
      .from("properties")
      .update({ status: "draft", draft_data: { title: `Rascunho do cartão ${sufixo}`, propertyType: "casa", city: "Uberlândia", uf: "MG", ...NA_ORDEM_ATUAL } })
      .eq("id", ids.imovel);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px — escolher "Apartamento" na hora grava o tipo no rascunho`, async ({ browser }) => {
      await adm().from("properties").update({ draft_data: { title: `Rascunho do cartão ${sufixo}`, propertyType: "casa", city: "Uberlândia", uf: "MG", ...NA_ORDEM_ATUAL } }).eq("id", ids.imovel!);
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: 900 });
      // O relógio falso da página (install não o para: ele segue o tempo real até pauseAt).
      await p.clock.install();
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=tipo`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("tipo-casa")).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
      // O rascunho acabou de ser aplicado: o relógio PARA aqui, com a janela da base (2 s) aberta — não fecha sozinha.
      // +100 ms: o relógio falso anda entre a leitura e o pauseAt, e pauseAt não volta atrás (a janela tem 2 000 ms).
      await p.clock.pauseAt((await p.evaluate(() => Date.now())) + 100);
      // Dentro da janela em que o autosave ainda aguarda a base — garantido, porque o relógio não anda.
      await p.getByTestId("tipo-apartamento").click();
      await expect(p.getByTestId("tipo-apartamento")).toHaveAttribute("aria-checked", "true");
      // Agora a janela fecha: o autosave decide se o toque foi edição (grava) ou base (não grava).
      await p.clock.runFor(2_500);
      await expect
        .poll(async () => ((await adm().from("properties").select("draft_data").eq("id", ids.imovel!).single()).data?.draft_data as { propertyType?: string } | null)?.propertyType, { timeout: 20_000, message: "a escolha por cartão dentro da janela da base foi gravada" })
        .toBe("apartamento");
      await p.screenshot({ path: `docs/capturas/e985/preview-e985-tipo-${largura}.png` });
      await p.context().close();
    });
  }
});
