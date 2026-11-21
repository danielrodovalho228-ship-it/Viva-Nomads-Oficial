import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, cnpjAleatorio } from "../fixtures/laboratorio";

/*
  T1572 — E682 (#3437, decisão do Daniel): na lista "Escolha o avaliador" (bloco da avaliação, painel do imóvel do dono) cada avaliador mostra SÓ a conduta
  publicada — nunca preço nem prazo ("valor e prazo vêm na proposta, depois da escolha"). Pedido em status "pedido" e um avaliador ativo
  (massa própria); a linha de termos diz "sem avaliações de conduta ainda" e não traz R$, "entrega em" nem "responde em". 390 e 1280 px, sem estouro.
  Só no laboratório (VISTORIA ligada pelo cookie do laboratório, como a t1429).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1572.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const avA = { email: `ava.t1572.${sufixo}@lab.vivanomads.test`, nome: "Caio Avaliador", role: "tenant" as const };
const ids: Record<string, string> = {};

async function comChave(page: Page) {
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url() === "about:blank" ? "http://localhost:3123" : page.url()).origin }]);
}

test.describe("T1572 — E682: a lista de avaliadores não mostra preço nem prazo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.A = await criarConta(avA, senha);
    const { data: p, error: eP } = await adm().from("parceiros").insert({ user_id: ids.A, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avA.nome, slug: `aval-t1572-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"] }).select("id").single();
    if (eP) throw eP;
    ids.parc = p.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: "Uberlândia", numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1572", conduta_versao: "2026-10-23", ativado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = c.id as string;
    ids.im = await criarImovelPronto(ids.dono, `T1572 ${sufixo}`, { ativo: true });
    const { error: eV } = await adm().from("vistoria_pedidos").insert({ property_id: ids.im, owner_id: ids.dono, cidade: "Uberlândia", porte: "q1_2", valor_tabela: 350, status: "pedido" });
    if (eV) throw eV;
  });
  test.afterAll(async () => {
    if (ids.im) await adm().from("vistoria_pedidos").delete().eq("property_id", ids.im);
    if (ids.cred) await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    await apagarContas([ids.A, ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`a ${w} px: "Escolha o avaliador" mostra só a conduta, sem preço nem prazo`, async ({ browser }) => {
      const d = await entrar(browser, dono.email, senha);
      await comChave(d);
      await d.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await d.goto(`/dashboard/imoveis/${ids.im}/nivel`, { waitUntil: "domcontentloaded" });
      const escolha = d.getByTestId("avaliacao-escolha");
      await expect(escolha).toBeVisible({ timeout: 30_000 });
      const termos = d.getByTestId("avaliacao-sugerido-termos");
      await expect(termos.first()).toBeVisible();
      for (const t of await termos.allInnerTexts()) {
        expect(t, `linha de termos: ${t}`).toMatch(/conduta/i);
        expect(t, `sem preço nem prazo: ${t}`).not.toMatch(/R\$|entrega em|responde em|valor e prazo/i);
      }
      expect(await d.evaluate(() => document.documentElement.scrollWidth - innerWidth), "rolagem lateral").toBeLessThanOrEqual(1);
      await d.context().close();
    });
  }
});
