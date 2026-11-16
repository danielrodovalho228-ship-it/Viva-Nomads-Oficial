import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2089 — E509 (Pista 3; varredura "sem spec" do mapa das 142, ronda 08:24Z) @E509 — sem @ao-vivo-seguro: precisa de
  sessão e do laboratório (VERMELHO PENDENTE DE LABORATÓRIO: só corre com INTEGRACOES_SIMULADAS=on e a chave).
  Regra decidida (E509; migração 0300): um anúncio pausado NUNCA fica sem motivo — o gatilho de coerência roda também no
  INSERT (pausado sem motivo nasce como pausa da Viva, 'admin'). E a tela de Meus imóveis trata todos os cartões pela
  mesma regra: só a pausa do DONO abre "Reativar"; a pausa da Viva mostra o porquê e não oferece "Reativar".
  O unitário e509-pausado-consistente.test.ts fixa a regra e a migração; esta spec prova no banco e na tela.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2089.${sufixo}@lab.vivanomads.test`, nome: "Dina Pausa", role: "owner" as const };
const ids: Record<string, string> = {};

const cartao = (p: Page, id: string) => p.locator(`[data-testid="meu-anuncio"][data-imovel="${id}"]`);

test.describe("T2089 — E509: pausado sempre tem motivo; só a pausa do dono reativa @E509", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.doDono = await criarImovelPronto(ids.dono, `Studio pausado pelo dono ${sufixo}`, { ativo: true });
    // Pausa do dono (com motivo).
    await adm().from("properties").update({ status: "paused", pausa_motivo: "dono" }).eq("id", ids.doDono);
    // O caso do E509 (massa do E289): um anúncio INSERIDO já pausado e SEM motivo — antes da 0300 o gatilho só rodava
    // no UPDATE e o anúncio ficava com motivo vazio. Insere a cópia de um anúncio pronto do mesmo dono.
    const base = await criarImovelPronto(ids.dono, `Studio base ${sufixo}`, { ativo: true });
    const { data: linha, error: e1 } = await adm().from("properties").select("*").eq("id", base).single();
    if (e1) throw e1;
    ids.daViva = randomUUID();
    const copia: Record<string, unknown> = { ...(linha as Record<string, unknown>), id: ids.daViva, title: `Studio pausado sem motivo ${sufixo}`, status: "paused", pausa_motivo: null, pausado_em: null };
    // Colunas geradas não aceitam valor no INSERT (autorizacao_anexada 0091, preco_justo 0130/0277).
    for (const k of ["created_at", "updated_at", "autorizacao_anexada", "preco_justo"]) delete copia[k];
    const { error: e2 } = await adm().from("properties").insert(copia);
    if (e2) throw e2;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("banco: um anúncio INSERIDO pausado nunca fica sem motivo (vira pausa da Viva); o do dono segue 'dono'", async () => {
    const { data } = await adm().from("properties").select("id, status, pausa_motivo").in("id", [ids.doDono, ids.daViva]);
    const por = Object.fromEntries((data ?? []).map((r) => [r.id, r]));
    expect(por[ids.doDono]).toMatchObject({ status: "paused", pausa_motivo: "dono" });
    expect(por[ids.daViva].status).toBe("paused");
    expect(por[ids.daViva].pausa_motivo, "pausado sem motivo nunca fica null").not.toBeNull();
    expect(por[ids.daViva].pausa_motivo).toBe("admin");
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px — Meus imóveis: só o pausado pelo dono abre Reativar; o da Viva diz o porquê`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
      // Os pausados podem estar numa aba própria: mostra todos os cartões.
      await expect(async () => {
        const aba = p.getByTestId("imoveis-aba-paused");
        if ((await cartao(p, ids.doDono).count()) === 0 && (await aba.count())) await aba.click();
        await expect(cartao(p, ids.doDono)).toBeVisible({ timeout: 3_000 });
      }).toPass({ timeout: 30_000 });

      // Pausa do dono: o selo é botão de menu e o menu oferece "Reativar".
      await cartao(p, ids.doDono).getByTestId("estado-anuncio").click();
      await expect(cartao(p, ids.doDono).getByTestId("reativar-anuncio")).toBeVisible();
      await p.keyboard.press("Escape");

      // Pausa da Viva: selo sem menu, com o porquê; nunca "Reativar".
      const viva = cartao(p, ids.daViva);
      await expect(viva.getByTestId("pausa-viva")).toBeVisible();
      await expect(viva.getByTestId("estado-anuncio")).toHaveAttribute("data-motivo", "admin");
      await expect(viva.getByTestId("reativar-anuncio")).toHaveCount(0);
      await p.context().close();
    });
  }
});
