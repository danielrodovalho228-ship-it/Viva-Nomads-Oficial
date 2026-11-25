import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1764 — E1158 @E1158 (ORDENS-DUET 654, 656, 658 e 659; linha Parceiros). O item tira 23 textos gémeos das telas e
  dos e-mails da avaliação; a trava de unidade confere cada um na fonte. Aqui, na tela, os que mudam o que se LÊ e têm
  massa simples:
   1. A equipe (/admin/avaliadores): "Pedidos recentes" e os pedidos sem avaliador mostram o estado e o tipo com os
      rótulos da casa — antes saía o código da base ("verificacao", "ausencia", "inicial").
   2. O candidato a avaliador (/dashboard/parceiro/avaliacao): o subtítulo é a frase do painel do parceiro — "o
      proprietário escolhe o avaliador de imóveis; você define o seu valor e o seu prazo."
  Os outros sub-pontos com tela já têm spec: a etapa "Escolhido" (t315), o plural do prazo (t1750) e o pagamento
  ainda não ativo (t250). Os e-mails e as fontes ficam na unidade.
  Contas criadas pelo spec; a dona é conta de teste. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Douradoquara";
const DIA = 86_400_000;
const senha = novaSenha();
const sufixo = novoSufixo();
const dona = { email: `dona.t1764.${sufixo}@lab.vivanomads.test`, nome: "Dora Rótulos", role: "owner" as const };
const candidato = { email: `cand.t1764.${sufixo}@lab.vivanomads.test`, nome: "[TESTE QA] Caio Candidato", role: "tenant" as const };
const ids: Record<string, string> = {};
const ha = (dias: number) => new Date(Date.now() - dias * DIA).toISOString();

async function pedido(chave: string, linha: Record<string, unknown>): Promise<void> {
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ owner_id: ids.dona, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, teste: true, ...linha })
    .select("id")
    .single();
  if (error) throw error;
  ids[chave] = data.id as string;
}

test.describe("T1764 — E1158: a equipe e o avaliador leem os rótulos da casa, de uma fonte @E1158", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dona = await criarConta(dona, senha);
    ids.candidato = await criarConta(candidato, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dona);
    if (t.error) throw t.error;
    for (const k of ["imovelA", "imovelB"]) ids[k] = await criarImovelPronto(ids.dona, `Lar dos rótulos ${k} ${sufixo}`, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovelA, ids.imovelB]);
    if (cid.error) throw cid.error;
    // Três pedidos que nenhuma rotina mexe: uma verificação que acabou em ausência, uma contestação cancelada e um
    // pedido parado numa cidade sem avaliador (o único aberto do imóvel dele).
    await pedido("ausencia", { property_id: ids.imovelA, tipo: "verificacao", verificacao_motivo: "outro", status: "ausencia", criado_em: ha(0.002) });
    await pedido("cancelada", { property_id: ids.imovelA, tipo: "contestacao", status: "cancelada", criado_em: ha(0.001) });
    await pedido("parado", { property_id: ids.imovelB, status: "pedido", aguardando_avaliador: true });
  });

  test.afterAll(async () => {
    const imoveis = [ids.imovelA, ids.imovelB].filter(Boolean);
    if (imoveis.length) {
      const { data: meus } = await adm().from("vistoria_pedidos").select("id").in("property_id", imoveis);
      const pedidos = (meus ?? []).map((x) => x.id as string);
      if (pedidos.length) {
        await adm().from("avisos").delete().in("ref_id", pedidos);
        await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
        await adm().from("vistoria_designacoes").delete().in("pedido_id", pedidos);
      }
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
      await adm().from("properties").delete().in("id", imoveis);
    }
    const contas = [ids.dona, ids.candidato].filter(Boolean);
    if (contas.length) await adm().from("emails_teste").delete().in("usuario_id", contas);
    await apagarContas(contas);
  });

  test("1. a equipe lê o estado e o tipo do pedido com os rótulos da casa, não o código da base", async ({ browser }) => {
    for (const w of [1280, 390] as const) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("avaliacoes-decidir")).toBeVisible({ timeout: 30_000 });

      // "Pedidos recentes": o tipo e o estado por extenso.
      const recentes = p.locator(`[data-testid="pedido-admin"]`).filter({ hasText: CIDADE });
      await expect(recentes.filter({ hasText: "Verificação aberta pela Viva" }), "a verificação que acabou em ausência").toHaveText(new RegExp(`^${CIDADE} · Verificação aberta pela Viva · Ausência registrada`));
      await expect(recentes.filter({ hasText: "2ª avaliação (contestação)" }), "a contestação cancelada").toHaveText(new RegExp(`^${CIDADE} · 2ª avaliação \\(contestação\\) · Cancelada`));
      await expect(recentes.filter({ hasText: "Avaliação inicial" }), "o pedido parado").toHaveText(new RegExp(`^${CIDADE} · Avaliação inicial · Aguardando avaliador`));
      // Nenhum código da base nas linhas desta spec: antes a linha era "Cidade · inicial · aguardando avaliador".
      for (const cru of ["verificacao", "contestacao", "inicial", "ausencia", "cancelada", "aguardando avaliador"]) {
        await expect(recentes.filter({ hasText: new RegExp(`· ${cru}( ·|$)`) }), `"${cru}" em bruto`).toHaveCount(0);
      }

      // O pedido sem avaliador (de conta de teste: fica à parte) também diz o tipo por extenso.
      const parado = p.locator(`[data-testid="sem-avaliador-item"][data-pedido="${ids.parado}"]`);
      await expect(parado).toContainText(`${CIDADE} · Avaliação inicial · desde `);
      // O título do painel e o número do topo saem da mesma fonte.
      await expect(p.getByTestId("avaliacoes-sem-avaliador").getByRole("heading").first()).toHaveText("Pedidos sem avaliador elegível");
      await expect(p.getByTestId("decidir-numero-sem-avaliador")).toContainText("pedidos sem avaliador elegível");
      await expect(p.getByTestId("avaliacoes-recusas").getByRole("heading").first()).toHaveText("Recusas e ausências (30 dias)");
      await expect(p.getByTestId("decidir-numero-recusas")).toContainText("recusas e ausências (30 dias)");

      expect(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), "sem rolagem lateral").toBe(true);
      await recentes.first().scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t1764-1-pedidos-recentes-${w}.png` });
      await ctx.close();
    }
  });

  test("2. o candidato a avaliador lê no subtítulo a frase do painel do parceiro", async ({ browser }) => {
    const page = await entrar(browser, candidato.email, senha);
    for (const w of [1280, 390] as const) {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Avaliação de imóveis", { timeout: 30_000 });
      await expect(page.getByText("Credenciamento de avaliador: o proprietário escolhe o avaliador de imóveis; você define o seu valor e o seu prazo.", { exact: true })).toHaveCount(1);
      await expect(page.getByText("o proprietário escolhe o avaliador e você define")).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t1764-2-subtitulo-${w}.png` });
    }
    await page.context().close();
  });
});
