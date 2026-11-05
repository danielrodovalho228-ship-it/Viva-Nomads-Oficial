import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1162 — E468 (#2642, 05/11): na página de Notificações, o vazio de "Atualizações de manutenção" leva ao destino do
 * papel ATIVO (a mesma regra do cabeçalho, papelDaBarra). Parceiro: os pedidos de serviço do painel dele
 * (/dashboard/parceiro#pedidos, "Pedidos"). Dono e morador: Solicitações (/dashboard/solicitacoes). O E468 entrou só com
 * teste de unidade; aqui é a tela, 390 e 1280, com duas contas novas:
 *   1. moradora: link-manutencao vai a /dashboard/solicitacoes ("Solicitações");
 *   2. parceira publicada com o papel de parceiro em uso: link-manutencao vai a /dashboard/parceiro#pedidos ("Pedidos");
 *   3. sem estouro horizontal.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `inq.t1162.${sufixo}@lab.vivanomads.test`, nome: "Mila Manutencao", role: "tenant" as const };
const parceira = { email: `par.t1162.${sufixo}@lab.vivanomads.test`, nome: "Pia Parceira", role: "owner" as const };
const ids: { morador?: string; parceira?: string; parceiro?: string } = {};

test.describe("T1162 — E468: 'Solicitações' em Notificações segue o papel ativo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.morador = await criarConta(morador, senha);
    ids.parceira = await criarConta(parceira, senha);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.parceira, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `[TESTE QA] Pia Reparos T1162 ${sufixo}`, slug: `pia-t1162-${sufixo}`, categorias: ["manutencao"], cidades: ["Uberlândia"], descricao_curta: "Parceira de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    expect(error, error?.message).toBeNull();
    ids.parceiro = data!.id as string;
    const { error: eP } = await adm().from("profiles").update({ papel_ativo: "parceiro" }).eq("id", ids.parceira);
    expect(eP, eP?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.morador, ids.parceira]);
  });

  for (const w of [390, 1280] as const) {
    test(`moradora → Solicitações; parceira → Pedidos do painel (${w})`, async ({ browser }) => {
      for (const caso of [
        { conta: morador, href: "/dashboard/solicitacoes", rotulo: "Solicitações" },
        { conta: parceira, href: "/dashboard/parceiro#pedidos", rotulo: "Pedidos" },
      ]) {
        const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 }, isMobile: w === 390 });
        try {
          const p = await entrarNaPagina(await ctx.newPage(), caso.conta.email, senha);
          await p.goto("/dashboard/notificacoes", { waitUntil: "domcontentloaded" });
          const link = p.getByTestId("link-manutencao");
          await expect(link, caso.conta.nome).toBeVisible({ timeout: 30_000 });
          // O papel de parceiro chega depois da tela (aprovação lida no cliente): espera o destino assentar.
          await expect(link, caso.conta.nome).toHaveAttribute("href", caso.href, { timeout: 20_000 });
          await expect(link).toHaveText(caso.rotulo);
          expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), caso.conta.nome).toBeLessThanOrEqual(1);
        } finally {
          await ctx.close();
        }
      }
    });
  }
});
