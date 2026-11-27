import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1781 — E1183 @E1183 (ORDENS-DUET 791 e 811; Central, nos intervalos).
  O item da "Fila da equipe" (/admin/avaliadores) mostrava só o rótulo e o motivo: a equipe não sabia de que imóvel nem
  de que avaliador era. A cura: o item diz o avaliador e o imóvel, a partir dos dados do próprio pedido, no formato que
  a Central já usa nas outras listas ("nº UDI-002 · Título do anúncio · VN-XXXXXX").
  Massa só no banco, num pedido já cancelado (nenhuma rotina lhe toca); só contas de teste; cidade própria
  (Pedrinópolis). Dois avaliadores: o do pedido e outro.
   1. Item com o pedido: diz o avaliador do pedido e o imóvel (título e código VN). A 390 e a 1280 px, com print.
   2. Item que traz o seu próprio avaliador e o pedido: vale o avaliador do item, com o imóvel do pedido.
   3. Item só com avaliador: diz só o avaliador. Item sem referência nenhuma: a linha não aparece.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Pedrinópolis";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1781.${sufixo}@lab.vivanomads.test`, nome: "Dita Fila", role: "owner" as const };
const avalA = { email: `av.a.t1781.${sufixo}@lab.vivanomads.test`, nome: "Abel Fila", role: "tenant" as const };
const avalB = { email: `av.b.t1781.${sufixo}@lab.vivanomads.test`, nome: "Bia Fila", role: "tenant" as const };
const TITULO = `[TESTE QA] t1781 Casa da fila ${sufixo}`;
const MOTIVO = {
  comPedido: `Item com pedido (t1781 ${sufixo}).`,
  comOsDois: `Item com avaliador próprio e pedido (t1781 ${sufixo}).`,
  soAvaliador: `Item só com avaliador (t1781 ${sufixo}).`,
  semNada: `Item sem referência (t1781 ${sufixo}).`,
};
const ids: Record<string, string> = {};
const numero: Record<"a" | "b", string> = { a: "", b: "" };
/** O código VN que o imóvel já tem em todo o site: "VN-" + os 6 primeiros caracteres do id, em maiúsculas. */
const codigoVN = (id: string) => `VN-${id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase()}`;

async function credenciado(chave: "a" | "b", conta: { nome: string }, userId: string): Promise<void> {
  const { data: parc, error } = await adm()
    .from("parceiros")
    .insert({ user_id: userId, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: conta.nome, slug: `av-${chave}-t1781-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
    .select("id")
    .single();
  if (error) throw error;
  ids[`parc_${chave}`] = parc.id as string;
  const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
  numero[chave] = n as string;
  const { data: c, error: e2 } = await adm()
    .from("avaliadores_credenciamento")
    .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n, status: "ativo", experiencia_link: `https://portfolio.lab.vivanomads.test/t1781-${chave}`, conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
    .select("id")
    .single();
  if (e2) throw e2;
  ids[`cred_${chave}`] = c.id as string;
}

test.describe("T1781 — E1183: o item da Fila da equipe diz de que avaliador e de que imóvel é @E1183", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.avalA = await criarConta(avalA, senha);
    ids.avalB = await criarConta(avalB, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.avalA, ids.avalB]);
    if (t.error) throw t.error;
    await credenciado("a", avalA, ids.avalA);
    await credenciado("b", avalB, ids.avalB);
    expect(numero.a, "os dois avaliadores têm números diferentes").not.toBe(numero.b);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).eq("id", ids.imovel);
    if (cid.error) throw cid.error;
    // O pedido é do avaliador A e está cancelado: nenhuma rotina lhe toca.
    const { data: ped, error } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, teste: true, status: "cancelada", avaliador_id: ids.cred_a })
      .select("id")
      .single();
    if (error) throw error;
    ids.pedido = ped.id as string;
    const itens = await adm()
      .from("vistoria_fila_admin")
      .insert([
        { tipo: "laudo_atrasado", pedido_id: ids.pedido, motivo: MOTIVO.comPedido },
        { tipo: "seguranca_grave", pedido_id: ids.pedido, avaliador_id: ids.cred_b, motivo: MOTIVO.comOsDois },
        { tipo: "devolucao_vencida", avaliador_id: ids.cred_b, motivo: MOTIVO.soAvaliador },
        { tipo: "avaliacao_teste", motivo: MOTIVO.semNada },
      ])
      .select("id");
    if (itens.error) throw itens.error;
    ids.itens = (itens.data ?? []).map((i) => i.id as string).join(",");
  });

  test.afterAll(async () => {
    if (ids.itens) await adm().from("vistoria_fila_admin").delete().in("id", ids.itens.split(","));
    if (ids.pedido) await adm().from("vistoria_pedidos").delete().eq("id", ids.pedido);
    for (const k of ["a", "b"]) {
      if (ids[`cred_${k}`]) await adm().from("avaliadores_credenciamento").delete().eq("id", ids[`cred_${k}`]);
      if (ids[`parc_${k}`]) await adm().from("parceiros").delete().eq("id", ids[`parc_${k}`]);
    }
    if (ids.imovel) await adm().from("properties").delete().eq("id", ids.imovel);
    const contas = [ids.dono, ids.avalA, ids.avalB].filter(Boolean);
    if (contas.length) await adm().from("emails_teste").delete().in("usuario_id", contas);
    await apagarContas(contas);
  });

  test("1. item com o pedido: diz o avaliador do pedido e o imóvel, a 390 e a 1280 px", async ({ browser }) => {
    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const a = await ctx.newPage();
      await a.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
      const fila = a.getByTestId("avaliadores-fila");
      await expect(fila).toBeVisible({ timeout: 30_000 });
      const item = fila.locator('[data-testid="fila-item"][data-tipo="laudo_atrasado"]').filter({ hasText: MOTIVO.comPedido });
      await expect(item, `a ${w} px: o item está na fila`).toHaveCount(1);
      await expect(item.getByTestId("fila-item-de-quem"), `a ${w} px: o avaliador do pedido e o imóvel`).toHaveText(`nº ${numero.a} · ${TITULO} · ${codigoVN(ids.imovel)}`);
      // O rótulo, o motivo e o botão continuam lá.
      await expect(item.locator("strong")).toHaveText("Laudo não enviado no prazo combinado");
      await expect(item).toContainText(MOTIVO.comPedido);
      await expect(item.getByRole("button", { name: "Marcar como resolvido" })).toBeVisible();
      await item.scrollIntoViewIfNeeded();
      expect(await a.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `sem rolagem lateral a ${w} px`).toBeLessThanOrEqual(1);
      await a.screenshot({ path: `${SAIDA}/t1781-fila-da-equipe-${w}.png` });
      await ctx.close();
    }
  });

  test("2. item que traz o seu próprio avaliador e o pedido: vale o avaliador do item, com o imóvel do pedido", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const a = await ctx.newPage();
    await a.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
    const fila = a.getByTestId("avaliadores-fila");
    await expect(fila).toBeVisible({ timeout: 30_000 });
    const item = fila.locator('[data-testid="fila-item"][data-tipo="seguranca_grave"]').filter({ hasText: MOTIVO.comOsDois });
    await expect(item).toHaveCount(1);
    await expect(item.getByTestId("fila-item-de-quem")).toHaveText(`nº ${numero.b} · ${TITULO} · ${codigoVN(ids.imovel)}`);
    await ctx.close();
  });

  test("3. item só com avaliador diz só o avaliador; item sem referência não ganha a linha", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const a = await ctx.newPage();
    await a.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
    const fila = a.getByTestId("avaliadores-fila");
    await expect(fila).toBeVisible({ timeout: 30_000 });
    const soAvaliador = fila.locator('[data-testid="fila-item"][data-tipo="devolucao_vencida"]').filter({ hasText: MOTIVO.soAvaliador });
    await expect(soAvaliador).toHaveCount(1);
    await expect(soAvaliador.getByTestId("fila-item-de-quem")).toHaveText(`nº ${numero.b}`);
    const semNada = fila.locator('[data-testid="fila-item"][data-tipo="avaliacao_teste"]').filter({ hasText: MOTIVO.semNada });
    await expect(semNada).toHaveCount(1);
    await expect(semNada.getByTestId("fila-item-de-quem")).toHaveCount(0);
    await ctx.close();
  });
});
