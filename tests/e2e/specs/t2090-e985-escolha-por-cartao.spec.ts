import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2090 — E985 @E985: o assistente grava a escolha por CARTÃO feita logo depois de abrir o rascunho. Antes, abrir o
  rascunho deixava o autosave "aguardando a base" e só input/change contavam como edição: o clique no cartão (botão
  role="radio") nos primeiros 2 s virava base e não era gravado. Rascunho com "Casa" → abre o passo Tipo → escolhe
  "Apartamento" na hora → o draft_data no banco passa a "apartamento". Só no laboratório (banco local + chave de serviço).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2090.${sufixo}@lab.vivanomads.test`, nome: "Rita Cartão", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

test.describe("T2090 — E985: a escolha por cartão logo depois de abrir o rascunho é gravada", () => {
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
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=tipo`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("tipo-casa")).toHaveAttribute("aria-checked", "true", { timeout: 30_000 });
      // Na hora (dentro da janela em que o autosave ainda aguarda a base).
      await p.getByTestId("tipo-apartamento").click();
      await expect(p.getByTestId("tipo-apartamento")).toHaveAttribute("aria-checked", "true");
      await expect
        .poll(async () => ((await adm().from("properties").select("draft_data").eq("id", ids.imovel!).single()).data?.draft_data as { propertyType?: string } | null)?.propertyType, { timeout: 20_000 })
        .toBe("apartamento");
      await p.screenshot({ path: `docs/capturas/e985/preview-e985-tipo-${largura}.png` });
      await p.context().close();
    });
  }
});
