import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { devolverAVezDaRotinaDaVistoria, pegarAVezDaRotinaDaVistoria } from "../fixtures/vez-da-rotina-da-vistoria";

/*
  T1775 — E1179 @E1179 (ORDENS-DUET 780 e 788; linha Parceiros). Desde a migração 0313 a regra dos tipos da fila da
  equipe deixou de aceitar quatro tipos: laudo_atrasado, ressalva_vencida, devolucao_vencida e seguranca_grave. A rotina
  do laudo continuou a gravá-los, o banco recusava em silêncio, e o item nunca chegava à "Fila da equipe".
  A migração 0363 devolve os quatro à regra. Massa própria, só contas de teste; a rotina corre num 2º servidor do mesmo
  build (porta própria).
   1. A rotina grava os três itens que o código gera: o laudo fora do prazo combinado, a ressalva vencida (pedido que
      não é verificação) e a devolução da contestação não confirmada.
   2. O banco aceita "segurança grave" (nenhum código o grava hoje; a tela sabe rotulá-lo).
   3. A "Fila da equipe" de /admin/avaliadores mostra os quatro, cada um com o seu rótulo e o seu motivo, a 390 e a
      1280 px, sem rolagem lateral.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Coromandel";
const PORTA = 3156;
const SEGREDO = `lab-t1775-${Math.random().toString(36).slice(2)}`;
const ROTULO = {
  laudo_atrasado: "Laudo não enviado no prazo combinado",
  ressalva_vencida: "Ressalva vencida: avaliar abrir verificação",
  devolucao_vencida: "Devolução da contestação não confirmada em 15 dias",
  seguranca_grave: "Segurança grave a acompanhar",
} as const;
const MOTIVO = {
  laudo_atrasado: "Laudo não enviado no prazo combinado: 3 dias úteis depois da visita.",
  ressalva_vencida: "Ressalva não corrigida em 15 dias: avaliar abrir verificação.",
  devolucao_vencida: "Devolução da contestação não confirmada em 15 dias: proposta de descredenciamento.",
} as const;
const senha = novaSenha();
const sufixo = novoSufixo();
const MOTIVO_GRAVE = `Fechadura da porta de entrada não conforme (t1775 ${sufixo}).`;
const dono = { email: `dono.t1775.${sufixo}@lab.vivanomads.test`, nome: "Dalva Fila", role: "owner" as const };
const avaliador = { email: `aval.t1775.${sufixo}@lab.vivanomads.test`, nome: "Abel Fila", role: "tenant" as const };
const ids: Record<string, string> = {};
const IMOVEIS = ["atraso", "ressalva", "devolucao"] as const;
const ha = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString();
let servidor: ChildProcess | null = null;

type Item = { id: string; tipo: string; motivo: string | null };
const itens = async (tipo: string, ref: { pedido?: string; avaliador?: string }) => {
  let q = adm().from("vistoria_fila_admin").select("id, tipo, motivo").eq("tipo", tipo).is("resolvido_em", null);
  q = ref.pedido ? q.eq("pedido_id", ref.pedido) : q.eq("avaliador_id", ref.avaliador as string).is("pedido_id", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Item[];
};

async function pedido(chave: string, linha: Record<string, unknown>): Promise<string> {
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, teste: true, avaliador_id: ids.cred, designado_em: ha(40), ...linha })
    .select("id")
    .single();
  if (error) throw error;
  ids[chave] = data.id as string;
  return ids[chave];
}

test.describe("T1775 — E1179: a fila da equipe volta a aceitar os quatro tipos do laudo @E1179", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    // A rotina corre sobre o banco inteiro: esta spec só monta a massa quando nenhuma outra spec de rotina está a meio.
    await pegarAVezDaRotinaDaVistoria("t1775");
    for (const [k, c] of [["dono", dono], ["avaliador", avaliador]] as const) {
      ids[k] = await criarConta(c, senha);
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[k]);
      if (t.error) throw t.error;
    }
    const { data: parc, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1775-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (error) throw error;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: c, error: e2 } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1775", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (e2) throw e2;
    ids.cred = c.id as string;
    for (const i of IMOVEIS) ids[`imovel_${i}`] = await criarImovelPronto(ids.dono, `Casa ${i} t1775 ${sufixo}`, { ativo: true });
    const naCidade = await adm().from("properties").update({ city: CIDADE }).in("id", IMOVEIS.map((i) => ids[`imovel_${i}`]));
    if (naCidade.error) throw naCidade.error;

    // (a) O laudo fora do prazo: a visita foi feita há 20 dias, o prazo combinado era de 3 dias úteis, e não há laudo.
    await pedido("pedidoAtraso", { property_id: ids.imovel_atraso, status: "realizada", agendado_para: ha(20), visita_concluida_em: ha(20), prazo_laudo_dias_uteis: 3 });

    // (b) A ressalva vencida: laudo com ressalvas emitido há 20 dias, sem correção, num pedido que NÃO é verificação
    // (a 1ª avaliação pedida pelo dono não gera strike: gera o item na fila da equipe).
    await pedido("pedidoRessalva", { property_id: ids.imovel_ressalva, status: "laudo_emitido", agendado_para: ha(25), visita_concluida_em: ha(25) });
    const laudo = await adm()
      .from("vistoria_laudos")
      .insert({ pedido_id: ids.pedidoRessalva, pedido_versao_id: ids.pedidoRessalva, property_id: ids.imovel_ressalva, owner_id: ids.dono, avaliador_id: ids.cred, resultado: "com_ressalvas", nivel_sustentado: "essencial", emitido_em: ha(20), prazo_ressalva_ate: ha(5), teste: true })
      .select("id")
      .single();
    if (laudo.error) throw laudo.error;
    ids.laudo = laudo.data.id as string;

    // (c) A devolução não confirmada: a contestação deu razão ao dono, o prazo da devolução venceu ontem.
    await pedido("pedidoOriginal", { property_id: ids.imovel_devolucao, status: "laudo_emitido", agendado_para: ha(30), visita_concluida_em: ha(30) });
    await pedido("pedidoContestacao", { property_id: ids.imovel_devolucao, status: "laudo_emitido", tipo: "contestacao", origem_pedido_id: ids.pedidoOriginal, avaliador_id: null, designado_em: null });
    const dev = await adm()
      .from("vistoria_devolucoes")
      .insert({ pedido_contestacao_id: ids.pedidoContestacao, pedido_original_id: ids.pedidoOriginal, avaliador_id: ids.cred, owner_id: ids.dono, valor: 350, criado_em: ha(16), prazo_ate: ha(1) })
      .select("id")
      .single();
    if (dev.error) throw dev.error;
    ids.devolucao = dev.data.id as string;
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const pedidos = [ids.pedidoAtraso, ids.pedidoRessalva, ids.pedidoContestacao, ids.pedidoOriginal].filter(Boolean);
    const imoveis = IMOVEIS.map((i) => ids[`imovel_${i}`]).filter(Boolean);
    const contas = [ids.dono, ids.avaliador].filter(Boolean);
    if (contas.length) {
      await adm().from("emails_teste").delete().in("usuario_id", contas);
      await adm().from("avisos").delete().in("usuario_id", contas);
    }
    if (ids.devolucao) await adm().from("vistoria_devolucoes").delete().eq("id", ids.devolucao);
    if (ids.laudo) await adm().from("vistoria_laudos").delete().eq("id", ids.laudo);
    if (pedidos.length) await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
    if (ids.cred) await adm().from("vistoria_fila_admin").delete().eq("avaliador_id", ids.cred);
    if (ids.dono) await adm().from("proprietario_strikes").delete().eq("owner_id", ids.dono);
    // A contestação aponta para o pedido de origem: sai primeiro.
    if (ids.pedidoContestacao) await adm().from("vistoria_pedidos").delete().eq("id", ids.pedidoContestacao);
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    if (ids.cred) await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(contas);
    devolverAVezDaRotinaDaVistoria();
  });

  test("1. a rotina grava na fila o laudo fora do prazo, a ressalva vencida e a devolução não confirmada", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    // Antes do tique, nada na fila para esta massa.
    expect(await itens("laudo_atrasado", { pedido: ids.pedidoAtraso })).toHaveLength(0);
    expect(await itens("ressalva_vencida", { pedido: ids.pedidoRessalva })).toHaveLength(0);
    expect(await itens("devolucao_vencida", { avaliador: ids.cred })).toHaveLength(0);

    const log = createWriteStream(`${SAIDA}/t1775-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/vistoria`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
    const r = await fetch(`http://localhost:${PORTA}/api/cron/vistoria`, { headers: { authorization: `Bearer ${SEGREDO}` } });
    expect(r.status, await r.text().catch(() => "")).toBe(200);

    // A rotina marcou os três — e, agora, o item de cada um existe mesmo na fila, com o motivo que ela escreve.
    const marcas = await Promise.all([
      adm().from("vistoria_pedidos").select("laudo_atrasado_em").eq("id", ids.pedidoAtraso).single(),
      adm().from("vistoria_laudos").select("ressalva_vencida_em").eq("id", ids.laudo).single(),
      adm().from("vistoria_devolucoes").select("fila_em").eq("id", ids.devolucao).single(),
    ]);
    expect(marcas[0].data?.laudo_atrasado_em, "a rotina marcou o laudo atrasado").not.toBeNull();
    expect(marcas[1].data?.ressalva_vencida_em, "a rotina marcou a ressalva vencida").not.toBeNull();
    expect(marcas[2].data?.fila_em, "a rotina marcou a devolução vencida").not.toBeNull();
    expect((await itens("laudo_atrasado", { pedido: ids.pedidoAtraso })).map((i) => i.motivo), "o item do laudo fora do prazo").toEqual([MOTIVO.laudo_atrasado]);
    expect((await itens("ressalva_vencida", { pedido: ids.pedidoRessalva })).map((i) => i.motivo), "o item da ressalva vencida").toEqual([MOTIVO.ressalva_vencida]);
    expect((await itens("devolucao_vencida", { avaliador: ids.cred })).map((i) => i.motivo), "o item da devolução não confirmada").toEqual([MOTIVO.devolucao_vencida]);
    // A 1ª avaliação pedida pelo dono não gera strike: o caminho da ressalva foi mesmo o da fila.
    expect(((await adm().from("proprietario_strikes").select("id").eq("owner_id", ids.dono)).data ?? []).length).toBe(0);
  });

  test("2. o banco aceita 'segurança grave' na fila da equipe", async () => {
    const { data, error } = await adm().from("vistoria_fila_admin").insert({ tipo: "seguranca_grave", pedido_id: ids.pedidoOriginal, motivo: MOTIVO_GRAVE }).select("id").single();
    expect(error, error?.message).toBeNull();
    ids.itemGrave = data?.id as string;
    // A regra continua a recusar um tipo que não existe.
    const errado = await adm().from("vistoria_fila_admin").insert({ tipo: "tipo_que_nao_existe", pedido_id: ids.pedidoOriginal, motivo: "t1775" });
    expect(errado.error?.message ?? "", "tipo desconhecido tem de ser recusado").toContain("vistoria_fila_admin_tipo_check");
  });

  test("3. a 'Fila da equipe' mostra os quatro itens, cada um com o seu rótulo e o seu motivo (390 e 1280)", async ({ browser }) => {
    for (const w of LARGURAS) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const a = await ctx.newPage();
      await a.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
      const fila = a.getByTestId("avaliadores-fila");
      await expect(fila).toBeVisible({ timeout: 30_000 });
      for (const tipo of ["laudo_atrasado", "ressalva_vencida", "devolucao_vencida"] as const) {
        const item = fila.locator(`[data-testid="fila-item"][data-tipo="${tipo}"]`).filter({ hasText: MOTIVO[tipo] }).first();
        await expect(item, `${tipo} a ${w} px`).toBeVisible();
        await expect(item.locator("strong")).toHaveText(ROTULO[tipo]);
      }
      const grave = fila.locator('[data-testid="fila-item"][data-tipo="seguranca_grave"]').filter({ hasText: MOTIVO_GRAVE });
      await expect(grave).toHaveCount(1);
      await expect(grave.locator("strong")).toHaveText(ROTULO.seguranca_grave);
      await expect(grave.getByRole("button", { name: "Marcar como resolvido" })).toBeVisible();
      await grave.scrollIntoViewIfNeeded();
      expect(await a.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `sem rolagem lateral a ${w} px`).toBeLessThanOrEqual(1);
      await a.screenshot({ path: `${SAIDA}/t1775-fila-da-equipe-${w}.png` });
      await ctx.close();
    }
  });
});
