import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, definirPlano, entrar, novaSenha, novoSufixo, publicarPeloEditor, statusDoImovel } from "../fixtures/laboratorio";

/*
  T427 — E141 (levantamento do Daniel, 25/10; correção na Pista A). O dono no plano Essencial publica SEM foto de prova:
  a foto feita na hora (FOTO-NA-HORA-B) é só para os itens de nível (Conforto/Premium), nunca condição para publicar.
  Rascunho completo do laboratório (8 fotos, documento aprovado), nenhuma linha em nivel_itens. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t427.${sufixo}@lab.vivanomads.test`, nome: "Ester Essencial", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

test.describe("T427 — E141: Essencial publica sem foto de prova", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await definirPlano(ids.dono, "essential");
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Essencial ${sufixo}`);
    await adm().from("nivel_itens").delete().eq("property_id", ids.imovel);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. sem nenhuma foto de prova, o anúncio publica e fica ativo", async ({ browser }) => {
    const { data: provas } = await adm().from("nivel_itens").select("id").eq("property_id", ids.imovel!);
    expect(provas ?? [], "o imóvel do teste não tem foto de prova").toHaveLength(0);
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await publicarPeloEditor(page, ids.imovel!);
    await expect(page.getByTestId("prontidao")).toHaveText("Anúncio publicado", { timeout: 20_000 });
    expect(await statusDoImovel(ids.imovel!)).toBe("active");
    await page.context().close();
  });
});
