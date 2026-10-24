import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * Rodada da vigia 24/10 (Pista C): confirmação dos merges no lab-crítico do bloco 19 (t354).
 * T362 — PERFIL-B (ordem do Daniel 23/10 21:03, item 3): os dados das telas do perfil que faltavam.
 *   1. perfil-07-pagamentos, "Como você recebe": o proprietário salva a chave Pix na Conta → Pagamentos. CPF errado
 *      é recusado com mensagem; o certo grava só dígitos e volta MASCARADO; outra conta não lê a linha (RLS da 0236);
 *      remover apaga (390 e 1280).
 *   2. perfil-02-avaliacoes: a avaliação recebida mostra quem avaliou (nome curto, papel), o imóvel e a cidade; as abas
 *      Positivas / Todas e a busca filtram.
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t362.${sufixo}@lab.vivanomads.test`, nome: "Paula Pix Andrade", role: "owner" as const };
const morador = { email: `morador.t362.${sufixo}@lab.vivanomads.test`, nome: "Carlos Mendes Silva", role: "tenant" as const };
const ids: { dono?: string; morador?: string; imovel?: string; contrato?: string } = {};
const CPF_OK = "52998224725";
const marca = `marca${sufixo}`;

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
const linhaPix = async () => (await adm().from("recebimento_pix").select("tipo, chave").eq("user_id", ids.dono!).maybeSingle()).data;

test.describe("T362 — PERFIL-B: chave Pix de recebimento e avaliações recebidas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Casa no Santa Mônica ${sufixo}`, { ativo: true, preco: 2900 });
    await adm().from("properties").update({ city: "Uberlândia" }).eq("id", ids.imovel);
    const { data: ct, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 2900, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 232, qtd_ocupantes: 1, status: "concluido", garantia: "caucao", encerrado_em: new Date(Date.now() - 24 * 3600_000).toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = ct!.id;
    // As duas partes enviam: a avaliação publica (regra da 0089). Cada uma pela própria sessão.
    for (const [quem, alvo, papel, nota, texto] of [
      [morador, ids.dono, "inquilino", 4, `Estadia tranquila, comunicação ótima ${marca}`],
      [dono, ids.morador, "proprietario", 5, `Cuidou muito bem do imóvel ${marca}`],
    ] as const) {
      const sb = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
      await sb.auth.signInWithPassword({ email: quem.email, password: senha });
      const { error: e } = await sb.from("avaliacoes").insert({ contrato_id: ids.contrato, alvo_id: alvo, papel_autor: papel, nota_geral: nota, comentario_publico: texto, status: "enviada" });
      if (e) throw e;
    }
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const largura of [390, 1280]) {
    test(`1. chave Pix: recusa CPF errado, grava o certo mascarado, ninguém mais lê, remove — ${largura} px`, async ({ browser }) => {
      test.setTimeout(150_000);
      const d = await entrar(browser, dono.email, senha);
      await d.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await d.goto("/dashboard/conta/pagamentos", { waitUntil: "domcontentloaded" });
      const bloco = d.getByTestId("conta-pix");
      await expect(bloco).toBeVisible({ timeout: 30_000 });
      await bloco.getByTestId("conta-pix-tipo").selectOption("cpf");
      await bloco.getByTestId("conta-pix-chave").fill("111.111.111-11");
      await bloco.getByTestId("conta-pix-salvar").click();
      await expect(bloco.getByTestId("conta-pix-erro")).toContainText("CPF inválido");
      expect(await linhaPix()).toBeNull();

      await bloco.getByTestId("conta-pix-chave").fill("529.982.247-25");
      await bloco.getByTestId("conta-pix-salvar").click();
      await expect(bloco.getByTestId("conta-pix-salva")).toHaveText("CPF: ***.982.247-**", { timeout: 20_000 });
      expect(await linhaPix()).toEqual({ tipo: "cpf", chave: CPF_OK });
      await semRolagemLateral(d);
      await d.getByTestId("conta-pagamentos").screenshot({ path: `${SAIDA}/t362-pix-salva-${largura}.png` });

      // Outra conta, mesmo logada, não lê a chave de ninguém (RLS da 0236).
      const outra = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
      await outra.auth.signInWithPassword({ email: morador.email, password: senha });
      const { data: vista } = await outra.from("recebimento_pix").select("chave").eq("user_id", ids.dono!);
      expect(vista ?? []).toEqual([]);

      await bloco.getByTestId("conta-pix-remover").click();
      await expect(bloco.getByTestId("conta-pix-chave")).toBeVisible({ timeout: 20_000 });
      await expect.poll(linhaPix, { timeout: 20_000 }).toBeNull();
      await d.context().close();
    });
  }

  test("2. avaliações recebidas: quem avaliou, imóvel e cidade; abas e busca filtram", async ({ browser }) => {
    test.setTimeout(150_000);
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 390, height: 844 });
    await d.goto("/dashboard/avaliacoes", { waitUntil: "domcontentloaded" });
    const cartao = d.getByTestId("avaliacao-recebida").filter({ hasText: marca });
    await expect(cartao).toBeVisible({ timeout: 30_000 });
    await expect(cartao.getByTestId("avaliacao-autor")).toContainText("Carlos S.");
    await expect(cartao.getByTestId("avaliacao-autor")).toContainText("morador");
    await expect(cartao.getByTestId("avaliacao-contexto")).toContainText(/^Recebida em \d{2} [a-z]{3} \d{4} · Casa no Santa Mônica .+ · Uberlândia$/);
    await expect(cartao).not.toContainText("Mendes");
    await semRolagemLateral(d);
    await d.screenshot({ path: `${SAIDA}/t362-avaliacoes-390.png` });

    // Nota 4 é positiva.
    await d.getByTestId("avaliacoes-aba-positivas").click();
    await expect(d).toHaveURL(/aba=positivas/);
    await expect(d.getByTestId("avaliacao-recebida").filter({ hasText: marca })).toBeVisible();
    // Busca sem resultado e busca que acha (sem acento).
    await d.getByTestId("avaliacoes-busca").fill("palavra-que-nao-existe");
    await d.getByTestId("avaliacoes-busca").press("Enter");
    await expect(d.getByTestId("avaliacoes-sem-resultado")).toBeVisible({ timeout: 20_000 });
    await d.getByTestId("avaliacoes-busca").fill("comunicacao otima");
    await d.getByTestId("avaliacoes-busca").press("Enter");
    await expect(d.getByTestId("avaliacao-recebida").filter({ hasText: marca })).toBeVisible({ timeout: 20_000 });
    await d.context().close();
  });
});
