import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2201 — E985 @E985: o assistente grava a escolha por CARTÃO feita logo depois de abrir o rascunho. Antes, abrir o
  rascunho deixava o autosave "aguardando a base" e só input/change contavam como edição: o clique no cartão (botão
  role="radio") nos primeiros 2 s virava base e não era gravado. Rascunho com "Casa" → abre o passo Tipo → escolhe
  "Apartamento" na hora → o draft_data no banco passa a "apartamento". Só no laboratório (banco local + chave de serviço).
  ORDEM-DUET-828 (trava oca): sem relógio fixo, o toque chegava depois da janela dos 2 s e a spec passava também sem a
  cura (10/10). Agora o relógio da página fica parado desde antes de abrir o rascunho: o toque cai DENTRO da janela por
  construção, e só depois o relógio anda os 2,5 s que fecham a janela — é aí que o autosave decide "base" ou "edição".
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2201.${sufixo}@lab.vivanomads.test`, nome: "Rita Cartão", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

test.describe("T2201 — E985: a escolha por cartão logo depois de abrir o rascunho é gravada", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Rascunho do cartão ${sufixo}`);
    const { error } = await adm()
      .from("properties")
      .update({ status: "draft", draft_data: { title: `Rascunho do cartão ${sufixo}`, propertyType: "casa", city: "Uberlândia", uf: "MG", step: 0 } })
      .eq("id", ids.imovel);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px — escolher "Apartamento" na hora grava o tipo no rascunho`, async ({ browser }) => {
      await adm().from("properties").update({ draft_data: { title: `Rascunho do cartão ${sufixo}`, propertyType: "casa", city: "Uberlândia", uf: "MG", step: 0 } }).eq("id", ids.imovel!);
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: 900 });
      // O relógio da página parado: a janela da base (2 s depois de o rascunho assentar) não fecha sozinha.
      await p.clock.install();
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=tipo`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("tipo-casa")).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
      // Dentro da janela em que o autosave ainda aguarda a base — garantido, porque o relógio não andou.
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
