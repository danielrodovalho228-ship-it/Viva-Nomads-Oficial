import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1646 — E180, passo 0 da Família 7 (ORDEM-DUET-027): o mecanismo da auditoria de 28/10 exatamente. O dono tem um
  rascunho NO SERVIDOR com a Qualificação já RESPONDIDA e parado num passo do cadastro; em Meus imóveis toca em
  "Novo anúncio". Esperado: a tela abre na Qualificação (1 de 5) — não no Passo 1 com a faixa —, e o rascunho é oferecido
  como retomada explícita ("Continuar de onde parei"), que só abre com o clique. A 390 e 1280 px. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1646.${sufixo}@lab.vivanomads.test`, nome: "Quitéria Qualificada", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T1646 — E180: rascunho com Qualificação respondida não sequestra o 'Novo anúncio'", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `Rascunho qualificado t1646 ${sufixo}`);
    // O estado que o autosave guarda: Qualificação respondida, parado no Passo 4.
    const { error } = await adm()
      .from("properties")
      .update({ draft_data: { title: `Rascunho qualificado t1646 ${sufixo}`, step: 3, etapaMax: 3, qualificacaoConforto: { status: "respondida", respostas: { cama: true } } } })
      .eq("id", ids.rascunho);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px — 'Novo anúncio' abre na Qualificação; o rascunho é retomada explícita`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      await p.getByRole("link", { name: "Novo anúncio" }).first().click();
      await expect(p).toHaveURL(/\/dashboard\/imoveis\/novo$/, { timeout: 30_000 });
      const qual = p.getByTestId("qualificacao");
      await expect(qual).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("qualificacao-progresso")).toContainText("1 de 5");
      await expect(p.getByTestId("passo-titulo")).toHaveCount(0);
      const aviso = qual.getByTestId("rascunho-aviso");
      await expect(aviso).toBeVisible({ timeout: 30_000 });
      await aviso.getByTestId("rascunho-continuar").click();
      await expect(p).toHaveURL(new RegExp(`draft=${ids.rascunho}`), { timeout: 30_000 });
      await p.context().close();
    });
  }
});
