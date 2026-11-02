import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1041 — E433 (#2333, auditoria de links dos e-mails, 02/11): o botão "Publicar meu anúncio" tem UM destino em todos os
 * e-mails, /dashboard/imoveis/<id>/publicar, que decide NO CLIQUE, pelo status de agora, o caminho mais curto até o
 * botão Publicar. Pela navegação real (a rota redireciona), 390 e 1280:
 *   1. rascunho → Revisão do assistente (/dashboard/imoveis/novo?draft=<id>&etapa=9);
 *   2. anúncio publicado → editor (/dashboard/imoveis/<id>/editar);
 *   3. anúncio pausado → editor;
 *   4. RASCUNHO de outra conta (a RLS não devolve a linha) → Meus anúncios (/dashboard/imoveis), sem revelar o imóvel;
 *   5. anúncio PUBLICADO de outra conta: a leitura pública devolve a linha e a rota leva ao /editar dele, que mostra
 *      "Imóvel não encontrado" (o editor não abre: confere o dono) — mas a promessa do E433 era Meus anúncios: L-90,
 *      test.fail até a rota conferir o dono (ver registro-defeitos).
 * O link de cada modelo de e-mail (catálogo e envio real) fica com o e433-publicar-destino.test.ts.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dona = { email: `dona.t1041.${sufixo}@lab.vivanomads.test`, nome: "Paula Publicar Souza", role: "owner" as const };
const outro = { email: `outro.t1041.${sufixo}@lab.vivanomads.test`, nome: "Otávio Outro Souza", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T1041 — E433: 'Publicar meu anúncio' com um destino só, que decide no clique", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dona = await criarConta(dona, senha);
    ids.outro = await criarConta(outro, senha);
    ids.rascunho = await criarImovelPronto(ids.dona, `Rascunho publicar t1041 ${sufixo}`);
    ids.ativo = await criarImovelPronto(ids.dona, `Ativo publicar t1041 ${sufixo}`, { ativo: true });
    ids.pausado = await criarImovelPronto(ids.dona, `Pausado publicar t1041 ${sufixo}`, { ativo: true });
    const { error } = await adm().from("properties").update({ status: "paused" }).eq("id", ids.pausado);
    if (error) throw error;
    ids.alheio = await criarImovelPronto(ids.outro, `Alheio publicar t1041 ${sufixo}`, { ativo: true });
    ids.alheioRascunho = await criarImovelPronto(ids.outro, `Alheio rascunho t1041 ${sufixo}`);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dona, ids.outro]);
  });

  for (const w of [390, 1280] as const) {
    test(`rascunho → Revisão; publicado e pausado → editor; de outra conta → Meus anúncios (${w})`, async ({ browser }) => {
      const p = await entrar(browser, dona.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      await p.goto(`/dashboard/imoveis/${ids.rascunho}/publicar`, { waitUntil: "domcontentloaded" });
      await expect(p).toHaveURL(new RegExp(`/dashboard/imoveis/novo\\?draft=${esc(ids.rascunho)}&etapa=9$`), { timeout: 30_000 });

      for (const chave of ["ativo", "pausado"] as const) {
        await p.goto(`/dashboard/imoveis/${ids[chave]}/publicar`, { waitUntil: "domcontentloaded" });
        await expect(p, chave).toHaveURL(new RegExp(`/dashboard/imoveis/${esc(ids[chave])}/editar$`), { timeout: 30_000 });
      }

      // 4. Rascunho de outra conta: a RLS não devolve a linha → Meus anúncios.
      await p.goto(`/dashboard/imoveis/${ids.alheioRascunho}/publicar`, { waitUntil: "domcontentloaded" });
      await expect(p).toHaveURL(/\/dashboard\/imoveis$/, { timeout: 30_000 });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      expect(await p.content(), "o rascunho de outra conta não aparece").not.toContain(`Alheio rascunho t1041 ${sufixo}`);

      // 5. Publicado de outra conta: o editor não abre para quem não é dona ("Imóvel não encontrado", sem o formulário).
      // O título de um anúncio PUBLICADO é público (a ficha mostra a qualquer um), então não é ele que se confere aqui.
      await p.goto(`/dashboard/imoveis/${ids.alheio}/publicar`, { waitUntil: "domcontentloaded" });
      await expect(p).not.toHaveURL(/\/publicar$/, { timeout: 30_000 });
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      if (/\/editar$/.test(new URL(p.url()).pathname)) {
        await expect(p.getByRole("heading", { name: "Imóvel não encontrado" })).toBeVisible({ timeout: 30_000 });
        await expect(p.locator("form")).toHaveCount(0);
      }
      await p.context().close();
    });

    test(`L-90: anúncio publicado de outra conta → Meus anúncios, como prometido no E433 (${w})`, async ({ browser }) => {
      // L-90 (registro-defeitos): a rota /publicar lê o imóvel pela sessão, e a leitura pública devolve o anúncio
      // publicado de qualquer conta → vai ao /editar dele ("Imóvel não encontrado"), não a Meus anúncios. Quem corrigir
      // (conferir owner_id na rota) tira este test.fail.
      test.fail(true, "L-90: /publicar não confere o dono; anúncio publicado de outra conta vai ao /editar dele");
      const p = await entrar(browser, dona.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await p.goto(`/dashboard/imoveis/${ids.alheio}/publicar`, { waitUntil: "domcontentloaded" });
      await expect(p).toHaveURL(/\/dashboard\/imoveis$/, { timeout: 20_000 });
      await p.context().close();
    });
  }
});
