import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1746 — E1128 @E1128 (ORDENS 563 e 565, linha Parceiros): o aviso da visita de avaliação lê o estado ATUAL do pedido, e
  um laudo emitido apaga o aviso de visita. Só contas de teste; laboratório, não é prova ao vivo no site.
  Vizinha do E1242 (ORDENS-DUET 1213 e 1247): corre também no portão do E1242 (e do reaberto), porque o sino tira o aviso de assinar
  resolvido e a rede grava a resolução conferida com referência (sino.ts, route.ts).
  A massa repete o caso de produção: no imóvel A há um pedido concluído (laudo emitido, a visita foi ontem) e um pedido
  novo, ainda sem data de visita. No imóvel B há um pedido com a visita marcada para amanhã.
   1. No sino da dona só aparece a visita do imóvel B (a que ainda vai acontecer), e só ela conta como não lida — a cor
      do sino é a dela (normal), não a do lembrete urgente que saiu. O aviso
      do imóvel A sai — tanto o antigo (gravado sem o pedido) como o gravado com o pedido. Na lista de todos os avisos,
      os do imóvel A ficam marcados "resolvido" e o do imóvel B não. 390 e 1280 px.
   2. Quando o pedido do imóvel B passa a "laudo emitido", o aviso dele também sai do sino na carga seguinte, e o sino
      fica sem avisos por ler. 390 e 1280 px.
  A gravação do "resolvido" no momento em que a visita é concluída ou o laudo é emitido (pela ação do avaliador) não é
  exercitada aqui: está na trava de unidade e1128-aviso-de-visita-estado-atual.test.ts.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Ituiutaba";
const senha = novaSenha();
const sufixo = novoSufixo();
const dona = { email: `dona.t1746.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const ids: Record<string, string> = {};
const titulos = { a: `[TESTE QA] t1746 Casa A ${sufixo}`, b: `[TESTE QA] t1746 Casa B ${sufixo}` };
const horas = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const urlDoImovel = (id: string) => `/dashboard/imoveis/${id}/nivel#avaliacao`;

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const topo = (p: Page, w: number) => (w === 390 ? p.getByTestId("topo-celular") : p.getByTestId("topo-dono"));
const sino = (p: Page, w: number) => topo(p, w).getByTestId(w === 390 ? "sino-dono-celular" : "sino-dono");
const painel = (p: Page, w: number) => topo(p, w).getByTestId(w === 390 ? "sino-dono-celular-painel" : "sino-dono-painel");

async function pedido(imovel: string, linha: { status: string; agendado_para?: string | null; criado_em: string }): Promise<string> {
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dona, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, teste: true, ...linha })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
async function semearAvisos() {
  await adm().from("avisos").delete().eq("usuario_id", ids.dona);
  const base = { usuario_id: ids.dona, evento: "vistoria_agendada", prioridade: "normal" };
  const linhas = [
    // O aviso ANTIGO do imóvel A: gravado sem o pedido (como os de produção até aqui).
    { ...base, titulo: `Visita de avaliação agendada · ${titulos.a}`, url: urlDoImovel(ids.a), ref_id: null, criado_em: horas(-30) },
    // O lembrete da véspera do mesmo pedido, já gravado com o pedido.
    { ...base, evento: "vistoria_lembrete", prioridade: "urgente", titulo: `Visita de avaliação amanhã · ${titulos.a}`, url: urlDoImovel(ids.a), ref_id: ids.pedidoConcluido, criado_em: horas(-28) },
    // O aviso do imóvel B: a visita ainda vai acontecer.
    { ...base, titulo: `Visita de avaliação agendada · ${titulos.b}`, url: urlDoImovel(ids.b), ref_id: ids.pedidoAgendado, criado_em: horas(-2) },
  ];
  const { error } = await adm().from("avisos").insert(linhas);
  if (error) throw error;
}
const resolvidos = async () => {
  const { data, error } = await adm().from("avisos").select("titulo, resolvido_em").eq("usuario_id", ids.dona);
  if (error) throw error;
  return ((data ?? []) as { titulo: string; resolvido_em: string | null }[]).filter((a) => a.resolvido_em).map((a) => a.titulo).sort();
};

test.describe("T1746 — E1128: o aviso da visita de avaliação lê o estado atual do pedido @E1128", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dona = await criarConta(dona, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dona);
    if (t.error) throw t.error;
    ids.a = await criarImovelPronto(ids.dona, titulos.a, { ativo: true });
    ids.b = await criarImovelPronto(ids.dona, titulos.b, { ativo: true });
    // Imóvel A: o pedido concluído (a visita foi ontem, o laudo está emitido) e um pedido novo, sem data.
    ids.pedidoConcluido = await pedido(ids.a, { status: "laudo_emitido", agendado_para: horas(-26), criado_em: horas(-72) });
    ids.pedidoNovo = await pedido(ids.a, { status: "pedido", agendado_para: null, criado_em: horas(-1) });
    // Imóvel B: a visita está marcada para amanhã.
    ids.pedidoAgendado = await pedido(ids.b, { status: "agendado", agendado_para: horas(24), criado_em: horas(-48) });
  });

  test.afterAll(async () => {
    if (ids.dona) await adm().from("avisos").delete().eq("usuario_id", ids.dona);
    const imoveis = [ids.a, ids.b].filter(Boolean);
    if (imoveis.length) {
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
      await adm().from("properties").delete().in("id", imoveis);
    }
    await apagarContas([ids.dona].filter(Boolean));
  });

  test("1. laudo emitido: o aviso da visita do imóvel A sai do sino (o antigo e o novo); o do imóvel B, com a visita por acontecer, fica", async ({ browser }) => {
    const p = await entrar(browser, dona.email, senha);
    for (const w of LARGURAS) {
      await semearAvisos();
      await largura(p, w);
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(sino(p, w), `a ${w} px: só a visita do imóvel B conta`).toHaveAttribute("aria-label", "Notificações: 1 não lidas", { timeout: 30_000 });
      // A cor do sino é a do aviso que continua (normal), não a do lembrete que saiu (urgente).
      await expect(sino(p, w).getByTestId(w === 390 ? "sino-dono-celular-contagem" : "sino-dono-contagem"), `a ${w} px: a cor não é a do aviso que saiu`).toHaveAttribute("data-prioridade", "normal");
      await sino(p, w).click();
      const itens = painel(p, w).getByTestId("sino-aviso");
      await expect(itens).toHaveCount(1);
      await expect(itens.first()).toContainText(titulos.b);
      await expect(painel(p, w), `a ${w} px: nada do imóvel A no sino`).not.toContainText(titulos.a);
      await p.screenshot({ path: `${SAIDA}/t1746-1-sino-${w}.png` });
      // A conferência fica gravada: os dois avisos do imóvel A estão resolvidos; o do imóvel B, não.
      await expect.poll(resolvidos, { timeout: 15_000 }).toEqual([`Visita de avaliação agendada · ${titulos.a}`, `Visita de avaliação amanhã · ${titulos.a}`].sort());

      // Na lista de todos os avisos, o histórico continua, marcado.
      await p.goto("/dashboard/notificacoes#avisos", { waitUntil: "domcontentloaded" });
      const lista = p.getByTestId("avisos-caixa").getByTestId("avisos-item");
      await expect(lista).toHaveCount(3, { timeout: 30_000 });
      await expect(lista.filter({ hasText: `Visita de avaliação agendada · ${titulos.a}` })).toContainText("resolvido");
      await expect(lista.filter({ hasText: `Visita de avaliação amanhã · ${titulos.a}` })).toContainText("resolvido");
      await expect(lista.filter({ hasText: titulos.b })).not.toContainText("resolvido");
      await p.getByTestId("avisos-caixa").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t1746-1-lista-${w}.png` });
    }
    await p.context().close();
  });

  test("2. o estado muda, o sino acompanha: com o laudo do imóvel B emitido, o aviso dele também sai e não sobra aviso por ler", async ({ browser }) => {
    const p = await entrar(browser, dona.email, senha);
    for (const w of LARGURAS) {
      // Volta ao estado "visita marcada" e semeia de novo, para as duas larguras partirem do mesmo ponto.
      const volta = await adm().from("vistoria_pedidos").update({ status: "agendado" }).eq("id", ids.pedidoAgendado);
      if (volta.error) throw volta.error;
      await semearAvisos();
      await largura(p, w);
      await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await expect(sino(p, w), `a ${w} px, antes: a visita do imóvel B conta`).toHaveAttribute("aria-label", "Notificações: 1 não lidas", { timeout: 30_000 });

      const emitido = await adm().from("vistoria_pedidos").update({ status: "laudo_emitido" }).eq("id", ids.pedidoAgendado);
      if (emitido.error) throw emitido.error;
      await p.reload({ waitUntil: "domcontentloaded" });
      await expect(sino(p, w), `a ${w} px, depois do laudo: nenhum aviso por ler`).toHaveAttribute("aria-label", "Notificações", { timeout: 30_000 });
      await sino(p, w).click();
      await expect(painel(p, w)).toBeVisible();
      await expect(painel(p, w).getByTestId("sino-aviso")).toHaveCount(0);
      await expect(painel(p, w)).not.toContainText("Visita de avaliação");
      await p.screenshot({ path: `${SAIDA}/t1746-2-sino-sem-visita-${w}.png` });
    }
    await p.context().close();
  });
});
