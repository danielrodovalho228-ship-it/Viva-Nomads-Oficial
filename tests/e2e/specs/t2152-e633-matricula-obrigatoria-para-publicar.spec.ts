import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, statusDoImovel } from "../fixtures/laboratorio";
import { DETALHE_MATRICULA_OBRIGATORIA, ROTULO_MATRICULA_ATUALIZADA } from "../../../src/lib/documento/matricula-titularidade";

/*
  T2152 — E633 @E633: com a chave MATRICULA_OBRIGATORIA ligada, a matrícula atualizada é obrigatória para publicar.
  Regra decidida (E633; unitário e633-matricula-titularidade.test.ts): a matrícula atualizada do imóvel (~R$ 35) nasce
  opcional; com NEXT_PUBLIC_MATRICULA_OBRIGATORIA="on" (chave de BUILD, inlinada no next build) ela vira item
  OBRIGATÓRIO da prontidão de quem ainda vai publicar ("Matrícula atualizada do imóvel", detalhe "a certidão custa
  cerca de R$ 35 no cartório"). Conta como enviada qualquer conferência do dono para o imóvel em
  property_ownership_checks (inclusive a que caiu em revisão manual — prontidao-servidor.ts). O já publicado segue sem item.
  A prova (só no job do laboratório com as chaves de build ligadas — @chave-build):
    - A: anúncio pronto pelo laboratório (criarImovelPronto) SEM matrícula → em Meus imóveis o card deixa de estar
      "Pronto para publicar" e lista a matrícula em "Falta para publicar", com o custo;
    - B (controle): o mesmo anúncio pronto COM uma conferência de matrícula (em_revisao) → sem a pendência e 100% pronto;
    - C: pausado pelo dono SEM matrícula → Reativar é recusado pelo servidor (a mesma porta do Publicar), a lista do que
      falta traz a matrícula e o banco continua "paused".
  390 e 1280 px na tela; a recusa do servidor em 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2152.${sufixo}@lab.vivanomads.test`, nome: "Matias Matrícula", role: "owner" as const };
const ids: Record<string, string> = {};
const TITULO_A = `Sem matrícula T2152 ${sufixo}`;
const TITULO_B = `Com matrícula T2152 ${sufixo}`;
const TITULO_C = `Pausado sem matrícula T2152 ${sufixo}`;

test.describe("T2152 — E633: com a chave ligada, sem a matrícula atualizada o anúncio não publica @E633 @chave-build", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.skip(process.env.NEXT_PUBLIC_MATRICULA_OBRIGATORIA !== "on", "Só no job do laboratório com as chaves de build ligadas.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.a = await criarImovelPronto(ids.dono, TITULO_A);
    ids.b = await criarImovelPronto(ids.dono, TITULO_B);
    // A matrícula enviada pelo dono para B: a linha que a conferência grava (cliente de serviço). Em revisão manual
    // também conta como enviada.
    const { error } = await adm().from("property_ownership_checks").insert({
      property_id: ids.b, user_id: ids.dono, arquivo_path: `${ids.dono}/matricula-t2152.pdf`, resultado: "em_revisao",
    });
    if (error) throw error;
    // C: estava no ar e o dono pausou (Reativar passa pela mesma prontidão do Publicar).
    ids.c = await criarImovelPronto(ids.dono, TITULO_C, { ativo: true });
    const { error: ePausa } = await adm().from("properties").update({ status: "paused", pausa_motivo: "dono" }).eq("id", ids.c);
    if (ePausa) throw ePausa;
  });

  test.afterAll(async () => {
    await adm().from("property_ownership_checks").delete().eq("user_id", ids.dono ?? "");
    for (const k of ["a", "b", "c"]) if (ids[k]) await adm().from("properties").delete().eq("id", ids[k]);
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — sem matrícula: "Falta para publicar" com a matrícula e o custo; com matrícula (controle): pronto`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });

      const cardA = p.locator(`[data-testid="meu-anuncio"][data-imovel="${ids.a}"]`);
      const cardB = p.locator(`[data-testid="meu-anuncio"][data-imovel="${ids.b}"]`);
      await expect(cardA.getByTestId("prontidao"), "o card de A mostra a prontidão").toBeVisible({ timeout: 30_000 });
      await expect(cardB.getByTestId("prontidao"), "o card de B mostra a prontidão").toBeVisible({ timeout: 30_000 });

      // A: pronto pelo laboratório, mas a matrícula (obrigatória com a chave) o tira de "pronto".
      await expect(cardA.getByTestId("prontidao"), "sem matrícula não está pronto para publicar").not.toContainText("Pronto para publicar");
      const pendA = cardA.getByTestId("falta-publicar").getByTestId("pendencia-matricula_atualizada");
      await expect(pendA, "a matrícula é pendência obrigatória").toHaveCount(1);
      await expect(pendA).toContainText(ROTULO_MATRICULA_ATUALIZADA);
      await expect(pendA, "o custo é dito, sem 'opcional'").toContainText(DETALHE_MATRICULA_OBRIGATORIA);
      await expect(pendA).not.toContainText("opcional");
      await expect(cardA.getByTestId("melhorar-matricula_atualizada"), "não aparece como melhoria opcional").toHaveCount(0);

      // B (controle): a matrícula enviada resolve o item; o anúncio volta a estar pronto.
      await expect(cardB.getByTestId("pendencia-matricula_atualizada"), "com matrícula, não pende").toHaveCount(0);
      await expect(cardB.getByTestId("prontidao")).toContainText("Pronto para publicar");
      await p.context().close();
    });
  }

  test("1280 px — Reativar sem matrícula é recusado pelo servidor; o anúncio continua pausado", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    const cardC = p.locator(`[data-testid="meu-anuncio"][data-imovel="${ids.c}"]`);
    const selo = cardC.locator('[data-testid="estado-anuncio"][data-status="paused"][data-motivo="dono"]');
    await expect(selo, "o pausado pelo dono tem o menu").toHaveCount(1, { timeout: 30_000 });
    await selo.click();
    await cardC.getByTestId("reativar-anuncio").click();

    const faltas = cardC.getByTestId("reativar-faltas");
    await expect(faltas, "a recusa lista o que falta").toBeVisible({ timeout: 30_000 });
    await expect(faltas).toContainText(`${ROTULO_MATRICULA_ATUALIZADA}: ${DETALHE_MATRICULA_OBRIGATORIA}`);
    // O servidor não publicou: o banco segue pausado.
    expect(await statusDoImovel(ids.c), "o anúncio sem matrícula não volta ao ar").toBe("paused");
    await p.context().close();
  });
});
