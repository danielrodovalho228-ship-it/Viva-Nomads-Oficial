import { test, expect, type Browser } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, criarLead, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T443 — ONDA 2 (Muse): prova do DISPARO AUTOMÁTICO da limpeza 5 dias antes da saída (Prompt 38), laboratório.
  Medição, não correção: monta o cenário com contas is_teste, roda o passo diário pelo mecanismo real
  (Admin › "Rodar a automação de hoje" → rodarAutomacaoAgora → automacaoDaEstadia, a MESMA função que o cron
  /api/cron/automacoes chama) e registra no log o que saiu: pedidos (parceiro, status, janela, gatilho) e e-mails
  (destinatário e assunto do modelo) e LÊ POR DENTRO o que foi gerado: o corpo de cada e-mail (LAB_OUTBOX) e as
  mensagens que o pedido abre no chat do parceiro (datas da janela e valor do serviço).
   A) saída em D+5, limpeza ATIVA (automático)   → pedido ao parceiro de limpeza + "Novo pedido de orçamento";
   B) saída em D+6, limpeza ATIVA (automático)   → fora da janela: nenhum pedido;
   C) saída em D+5, SEM limpeza vinculada        → aviso ao dono "Saída em 5 dias: quer agendar a limpeza?";
   D) saída em D+5, limpeza ATIVA (confirmar)    → pedido parado esperando o dono + "Confirme o pedido de serviço do imóvel".
   E) saída em D+2, SEM limpeza vinculada        → o aviso ao dono também sai (está dentro da janela); o log registra
      o texto, que diz "5 dias" mesmo faltando 2 (achado de vocabulário, medido e não corrigido aqui).
  A 2ª rodada não duplica nada.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dia = (n: number) => new Date(Date.now() - 3 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);
const contas = {
  donoA: { email: `donoa.t443.${sufixo}@lab.vivanomads.test`, nome: "Ana Dona Janela", role: "owner" as const },
  donoC: { email: `donoc.t443.${sufixo}@lab.vivanomads.test`, nome: "Caio Dono Semparceiro", role: "owner" as const },
  morA: { email: `mora.t443.${sufixo}@lab.vivanomads.test`, nome: "Mara Moradora Cinco", role: "tenant" as const },
  morB: { email: `morb.t443.${sufixo}@lab.vivanomads.test`, nome: "Beto Morador Seis", role: "tenant" as const },
  morC: { email: `morc.t443.${sufixo}@lab.vivanomads.test`, nome: "Ciro Morador Cinco", role: "tenant" as const },
  morD: { email: `mord.t443.${sufixo}@lab.vivanomads.test`, nome: "Duda Moradora Cinco", role: "tenant" as const },
  donoE: { email: `donoe.t443.${sufixo}@lab.vivanomads.test`, nome: "Eva Dona Doisdias", role: "owner" as const },
  morE: { email: `more.t443.${sufixo}@lab.vivanomads.test`, nome: "Enzo Morador Dois", role: "tenant" as const },
  limpa: { email: `limpa.t443.${sufixo}@lab.vivanomads.test`, nome: "Lia Limpeza Teste", role: "owner" as const },
};
const ids: Record<string, string> = {};
const cenario: Record<"A" | "B" | "C" | "D" | "E", { imovel: string; contrato: string }> = {} as never;

async function rodarAutomacao(browser: Browser): Promise<string> {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
  const a = await ctx.newPage();
  await a.goto("/admin/parceiros/pedidos", { waitUntil: "domcontentloaded" });
  await a.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await a.getByTestId("rodar-automacao").click();
  const res = a.getByTestId("rodar-automacao-resultado");
  await expect(res).toContainText("Feito:", { timeout: 60_000 });
  const texto = (await res.textContent()) ?? "";
  await ctx.close();
  return texto;
}

async function estadia(chave: "A" | "B" | "C" | "D" | "E", donoId: string, moradorId: string, saida: number) {
  const imovel = await criarImovelPronto(donoId, `Disparo ${chave} ${sufixo}`, { ativo: true, preco: 3000 });
  await adm().from("properties").update({ checkout_before: "11:00", checkin_after: "14:00" }).eq("id", imovel);
  const lead = await criarLead(donoId, moradorId, imovel, true);
  const agora = new Date().toISOString();
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({
      lead_id: lead, property_id: imovel, tenant_id: moradorId, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60,
      aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 600, qtd_ocupantes: 1, capacidade_snapshot: 2,
      assinado_proprietario_em: agora, assinado_inquilino_em: agora, status: "ativo", garantia: "caucao",
    })
    .select("id")
    .single();
  if (error) throw error;
  const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio: dia(saida - 60), fim: dia(saida), meses: 2, valor: 6000, caucao: 3000, status: "ativo" });
  if (eb) throw eb;
  cenario[chave] = { imovel, contrato: c.id as string };
}

function recebeuAssunto(emails: Array<Record<string, unknown>>, para: string, assunto: RegExp): number {
  return emails.filter((e) => e.para === para && assunto.test(String(e.assunto))).length;
}

async function pedidos(contrato: string) {
  const { data } = await adm()
    .from("parceiro_pedidos")
    .select("id, parceiro_id, cliente_id, status, origem, gatilho, aguardando_dono, enviado_em, janela_inicio, janela_fim, chave_automacao")
    .eq("contrato_id", contrato)
    .order("criado_em");
  return (data ?? []) as Record<string, string | boolean | null>[];
}

test.describe("T443 — disparo automático da limpeza em D-5 (Prompt 38)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "Sem a conta admin de teste: a automação do dia é rodada pelo admin.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    for (const [k, c] of Object.entries(contas)) ids[k] = await criarConta(c, senha);
    // Só contas de teste no cenário.
    await adm().from("profiles").update({ is_teste: true }).in("id", Object.values(ids));
    const { data: p, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.limpa, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Lia Limpa ${sufixo}`, slug: `lia-t443-${sufixo}`, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceira de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = p.id as string;
    const { data: s } = await adm().from("parceiro_servicos").insert({ parceiro_id: ids.parceiro, categoria: "limpeza", titulo: "Limpeza completa", preco_base: 250, unidade: "por serviço", ativo: true }).select("id").single();
    ids.servico = (s as { id: string }).id;
    await estadia("A", ids.donoA, ids.morA, 5);
    await estadia("B", ids.donoA, ids.morB, 6);
    await estadia("C", ids.donoC, ids.morC, 5);
    await estadia("D", ids.donoA, ids.morD, 5);
    await estadia("E", ids.donoE, ids.morE, 2);
    // Vínculo ATIVO (o caminho pendente → aceite → ativo já foi provado no t264; aqui ele é o ponto de partida).
    for (const [k, modo] of [["A", "automatico"], ["B", "automatico"], ["D", "confirmar"]] as const) {
      const { error: ev } = await adm().from("imovel_parceiros").insert({ property_id: cenario[k].imovel, categoria: "limpeza", parceiro_id: ids.parceiro, servico_id: ids.servico, modo, status: "ativo", respondido_em: new Date().toISOString() });
      if (ev) throw ev;
    }
  });

  test.afterAll(async () => {
    const contratos = Object.values(cenario).map((c) => c.contrato);
    const imoveis = Object.values(cenario).map((c) => c.imovel);
    if (contratos.length) await adm().from("parceiro_pedidos").delete().in("contrato_id", contratos);
    if (imoveis.length) await adm().from("imovel_parceiros").delete().in("property_id", imoveis);
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    if (contratos.length) await adm().from("contratos").delete().in("id", contratos);
    await apagarContas(Object.entries(ids).filter(([k]) => k in contas).map(([, v]) => v));
  });

  test("disparo D-5: pedido ao parceiro certo, só dentro da janela, avisos com os modelos certos; a 2ª rodada não duplica", async ({ browser }) => {
    test.setTimeout(180_000);
    const antes = (await lerSaida()).length;
    const resultado1 = await rodarAutomacao(browser);
    console.log(`[T443] hoje (Brasília) ${dia(0)} · janela até ${dia(5)} · resultado da rodada 1: ${resultado1.trim()}`);

    const pA = await pedidos(cenario.A.contrato);
    const pB = await pedidos(cenario.B.contrato);
    const pC = await pedidos(cenario.C.contrato);
    const pD = await pedidos(cenario.D.contrato);
    const pE = await pedidos(cenario.E.contrato);
    const saidaDe = { A: 5, B: 6, C: 5, D: 5, E: 2 } as const;
    for (const [k, p] of [["A", pA], ["B", pB], ["C", pC], ["D", pD], ["E", pE]] as const) console.log(`[T443] pedidos ${k} (saída ${dia(saidaDe[k])}): ${JSON.stringify(p.map(({ id, ...r }) => ({ ...r, id: String(id).slice(0, 8) })))}`);

    const emails = (await lerSaida()).slice(antes).filter((e) => e.servico === "email");
    const nossos = new Map(Object.entries(contas).map(([k, c]) => [c.email, k]));
    const linhas = emails.filter((e) => nossos.has(String(e.para))).map((e) => `${nossos.get(String(e.para))} <${e.para}> — "${e.assunto}"`);
    console.log(`[T443] e-mails do cenário (destinatário — assunto do modelo):\n  ${linhas.join("\n  ") || "(nenhum)"}`);
    // Leitura por dentro: o corpo que sairia em cada e-mail (texto puro; o destino dos botões entre parênteses).
    for (const e of emails.filter((x) => nossos.has(String(x.para)))) console.log(`[T443] corpo → ${nossos.get(String(e.para))} "${e.assunto}": ${e.corpo}`);

    // Caixa de e-mails de teste (contas is_teste): o NOME DO MODELO (evento) de cada envio, para a QA ler o conteúdo.
    const quem = new Map(Object.entries(contas).map(([k]) => [ids[k], k]));
    const { data: caixa } = await adm().from("emails_teste").select("evento, assunto, usuario_id").in("usuario_id", Object.keys(contas).map((k) => ids[k])).order("criado_em");
    const modelos = ((caixa ?? []) as { evento: string; assunto: string; usuario_id: string }[]).map((r) => `${quem.get(r.usuario_id)} — modelo "${r.evento}" — "${r.assunto}"`);
    console.log(`[T443] caixa de e-mails de teste (destinatário — modelo — assunto):\n  ${modelos.join("\n  ") || "(nenhum)"}`);

    // A: automático em D+5 → um pedido para a parceira de limpeza, já enviado, com a janela da saída.
    expect(pA).toHaveLength(1);
    expect(pA[0]).toMatchObject({ parceiro_id: ids.parceiro, cliente_id: ids.donoA, status: "solicitado", origem: "automatico", gatilho: "saida_limpeza", aguardando_dono: false });
    expect(pA[0].enviado_em).not.toBeNull();
    expect(new Date(String(pA[0].janela_inicio)).toISOString()).toBe(new Date(`${dia(5)}T13:00:00-03:00`).toISOString());
    expect(new Date(String(pA[0].janela_fim)).toISOString()).toBe(new Date(`${dia(7)}T11:00:00-03:00`).toISOString());
    // Por dentro do pedido A: as mensagens que abrem o chat do parceiro (janela em horário de Brasília + serviço e valor).
    const { data: msgs } = await adm().from("messages").select("sender_id, receiver_id, body").eq("parceiro_pedido_id", String(pA[0].id)).order("created_at");
    const chat = (msgs ?? []) as { sender_id: string; receiver_id: string; body: string }[];
    for (const m of chat) console.log(`[T443] chat do pedido A (${quem.get(m.sender_id)} → ${quem.get(m.receiver_id)}): ${m.body}`);
    const ddmm = (n: number) => `${dia(n).slice(8, 10)}/${dia(n).slice(5, 7)}`;
    expect(chat.length, "boas-vindas + descrição do pedido").toBe(2);
    expect(chat.every((m) => m.sender_id === ids.donoA && m.receiver_id === ids.limpa), "do dono para a parceira").toBe(true);
    expect(chat[1].body).toContain(`Limpeza depois da saída do morador: entre ${ddmm(5)} às 13:00 e ${ddmm(7)} às 11:00.`);
    // O valor sai do Intl pt-BR: "R$" e o número separados por espaço inseparável (U+00A0).
    expect(chat[1].body.replace(/\u00a0/g, " ")).toContain("Serviço: Limpeza completa (a partir de R$ 250,00 por serviço).");
    // Por dentro dos e-mails: quem recebe, o que diz e para onde o botão leva.
    const corpo = (quem: keyof typeof contas, assunto: RegExp) => String(emails.find((e) => e.para === contas[quem].email && assunto.test(String(e.assunto)))?.corpo ?? "");
    const cParceira = corpo("limpa", /^Novo pedido de orçamento/);
    expect(cParceira).toContain("você recebeu um pedido de orçamento pela Viva Nomads");
    // O botão leva à página do PRÓPRIO pedido (não ao painel genérico do modelo).
    expect(cParceira).toContain(`Ver o pedido (${new URL(`/dashboard/servicos/pedidos/${pA[0].id}`, String(cParceira.match(/https?:\/\/[^/\s)]+/)?.[0])).href})`);
    const cConfirmar = corpo("donoA", /^Confirme o pedido de serviço do imóvel/);
    expect(cConfirmar).toContain("confirme com 1 toque");
    expect(cConfirmar).toContain(`Confirmar o pedido (${new URL(`/dashboard/servicos/pedidos/${pD[0].id}`, String(cConfirmar.match(/https?:\/\/[^/\s)]+/)?.[0])).href})`);
    const cSemParceiro = corpo("donoC", /^Saída em 5 dias/);
    expect(cSemParceiro).toContain("o imóvel não tem limpeza fixa");
    expect(cSemParceiro).toMatch(/Buscar limpeza \(https?:\/\/[^)]*\/parceiros\/buscar\?categoria=limpeza/);
    // Os e-mails do disparo não levam valor nem dado de contato.
    for (const c of [cParceira, cConfirmar, cSemParceiro]) expect(c).not.toMatch(/R\$\s?\d/);
    // E: saída em D+2 sem limpeza → o aviso sai (dentro da janela). O texto fixo diz "5 dias": registrado, não corrigido.
    expect(pE).toHaveLength(0);
    console.log(`[T443] E (saída em ${dia(2)}, faltam 2 dias) — aviso ao dono: ${corpo("donoE", /^Saída em 5 dias/) || "(nenhum)"}`);
    expect(recebeuAssunto(emails, contas.donoE.email, /^Saída em 5 dias: quer agendar a limpeza\?( · Viva Nomads)?$/)).toBe(1);
    // B: D+6 está fora da janela de 5 dias.
    expect(pB).toHaveLength(0);
    // C: sem limpeza vinculada → nenhum pedido; o dono recebe o aviso.
    expect(pC).toHaveLength(0);
    // D: modo "confirmar" → pedido parado até o dono confirmar (não vai ao parceiro).
    expect(pD).toHaveLength(1);
    expect(pD[0]).toMatchObject({ parceiro_id: ids.parceiro, status: "solicitado", gatilho: "saida_limpeza", aguardando_dono: true, enviado_em: null });

    // O assunto sai com o sufixo " · Viva Nomads" (camada do e-mail).
    const recebeu = (quem: keyof typeof contas, assunto: RegExp) => emails.filter((e) => e.para === contas[quem].email && assunto.test(String(e.assunto))).length;
    expect(recebeu("limpa", /^Novo pedido de orçamento( · Viva Nomads)?$/), "A: a parceira recebe 1 aviso de pedido novo (D não vai ao parceiro)").toBe(1);
    expect(recebeu("donoC", /^Saída em 5 dias: quer agendar a limpeza\?( · Viva Nomads)?$/)).toBe(1);
    expect(recebeu("donoA", /^Confirme o pedido de serviço do imóvel( · Viva Nomads)?$/), "D: o dono confirma com 1 toque").toBe(1);
    expect(recebeu("donoA", /^Saída em 5 dias/), "A/B/D têm limpeza vinculada: sem aviso de 'sem parceiro'").toBe(0);

    // 2ª rodada (o cron roda todo dia): nada novo.
    const meio = (await lerSaida()).length;
    const resultado2 = await rodarAutomacao(browser);
    console.log(`[T443] resultado da rodada 2: ${resultado2.trim()}`);
    expect(await pedidos(cenario.A.contrato)).toHaveLength(1);
    expect(await pedidos(cenario.D.contrato)).toHaveLength(1);
    const novos = (await lerSaida()).slice(meio).filter((e) => e.servico === "email" && nossos.has(String(e.para)));
    console.log(`[T443] e-mails do cenário na rodada 2: ${novos.length}`);
    expect(novos, "a 2ª rodada não reenvia nada").toHaveLength(0);
  });
});
