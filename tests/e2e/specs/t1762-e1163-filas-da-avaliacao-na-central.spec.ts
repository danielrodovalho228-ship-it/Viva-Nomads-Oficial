import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1762 — E1163 @E1163 (ORDENS-DUET 684, 685 e 706; linha Parceiros). As três filas da avaliação que esperam a equipe —
  pedido sem avaliador elegível, laudo atrasado, credenciamento para decidir — não chegavam à Central: quem não abrisse
  /admin/avaliadores não as via. Passam a ser três linhas da Central (/admin/pendencias), cada uma com o MESMO número
  do "Para decidir" da página dos avaliadores e o link para a seção dela.
  A página contava sozinha, e uma das contas estava errada: "sem avaliador" olhava só os 50 pedidos mais recentes. A
  massa tem a mordida disso: um pedido parado há 40 dias e, depois dele, 51 pedidos mais novos já cancelados.
   1. Central: as três linhas existem, com o texto, o botão e o destino; contam no total do título.
   2. Um número, uma fonte: o número de cada linha da Central é o do "Para decidir" da página, e o do banco sem as
      contas de teste.
   3. Página: o pedido parado mais antigo está na lista (atrás dos 51 mais novos); número = lista nas três filas; o que é
      de conta de teste aparece à parte, com "Mais N de conta de teste, fora do número:".
   4. Cada linha da Central leva à seção dela.
  Outras specs correm ao mesmo tempo no portão e mexem nas mesmas filas: os números são lidos juntos e a comparação
  repete se alguma fila mudou a meio. A rotina de hora em hora de outra spec não desfaz esta massa: a cidade é só
  desta spec e não tem avaliador (o pedido continua parado), e o atraso do laudo já está gravado.
  Contas criadas pelo spec; a de teste é marcada como tal. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Cascalho Rico";
const DIA = 86_400_000;
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = (chave: string, nome: string, role: "owner" | "tenant") => ({ email: `${chave}.t1762.${sufixo}@lab.vivanomads.test`, nome, role });
const donoReal = conta("dono", "Dália Espera", "owner");
const donoTeste = conta("dono.teste", "Tito Teste", "owner");
const candReal = conta("cand", "Caio Candidato", "tenant");
const candTeste = conta("cand.teste", "Tânia Teste", "tenant");
const ids: Record<string, string> = {};
const numero: Record<string, string> = {};
const ha = (dias: number, minutos = 0) => new Date(Date.now() - dias * DIA - minutos * 60_000).toISOString();

const FILAS = [
  { decisao: "avaliacao_sem_avaliador", texto: /^\d+ (pedido de avaliação sem avaliador elegível|pedidos de avaliação sem avaliador elegível)$/, acao: "Ver", href: "/admin/avaliadores#sem-avaliador", numeroDaPagina: "sem-avaliador" },
  { decisao: "avaliacao_laudo_atrasado", texto: /^\d+ (laudo de avaliação atrasado|laudos de avaliação atrasados)$/, acao: "Cobrar", href: "/admin/avaliadores#contestacoes", numeroDaPagina: "laudos-atrasados" },
  { decisao: "avaliacao_credenciamento", texto: /^\d+ (credenciamento de avaliador para decidir|credenciamentos de avaliador para decidir)$/, acao: "Decidir", href: "/admin/avaliadores#credenciamento", numeroDaPagina: "credenciamentos" },
] as const;

async function admin(browser: Browser, w: number): Promise<Page> {
  const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: w, height: w === 390 ? 844 : 900 } });
  return ctx.newPage();
}
const linhaDaCentral = (p: Page, decisao: string) => p.locator(`[data-testid="central-linha-decisao"][data-decisao="${decisao}"]`);
async function abrirCentral(p: Page) {
  await p.goto("/admin/pendencias", { waitUntil: "domcontentloaded" });
  await expect(p.getByTestId("central-decisoes").getByRole("heading", { level: 2 })).toBeVisible({ timeout: 30_000 });
}
async function abrirAvaliadores(p: Page) {
  await p.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
  await expect(p.getByTestId("avaliacoes-decidir")).toBeVisible({ timeout: 30_000 });
}
const numerosDaCentral = async (p: Page) => {
  await abrirCentral(p);
  const r: Record<string, number> = {};
  for (const f of FILAS) r[f.decisao] = Number(await linhaDaCentral(p, f.decisao).getAttribute("data-n", { timeout: 15_000 }));
  return r;
};
const numerosDaPagina = async (p: Page) => {
  await abrirAvaliadores(p);
  const r: Record<string, number> = {};
  for (const f of FILAS) r[f.decisao] = Number(await p.getByTestId(`decidir-numero-${f.numeroDaPagina}`).getAttribute("data-valor"));
  return r;
};
/** A conta do banco, sem as contas de teste — independente do módulo do site. */
async function numerosDoBanco(): Promise<Record<string, number>> {
  const { data: t, error: eT } = await adm().from("profiles").select("id").eq("is_teste", true).limit(5000);
  if (eT) throw eT;
  const teste = new Set((t ?? []).map((x) => x.id as string));
  const [parados, atrasados, creds] = await Promise.all([
    adm().from("vistoria_pedidos").select("owner_id").eq("status", "pedido").eq("aguardando_avaliador", true),
    adm().from("vistoria_pedidos").select("owner_id").eq("status", "realizada").not("laudo_atrasado_em", "is", null),
    adm().from("avaliadores_credenciamento").select("user_id, parceiros(user_id)").eq("status", "solicitado"),
  ]);
  for (const l of [parados, atrasados, creds]) if (l.error) throw l.error;
  const reais = (donos: (string | null | undefined)[]) => donos.filter((d) => !d || !teste.has(d)).length;
  return {
    avaliacao_sem_avaliador: reais((parados.data ?? []).map((x) => x.owner_id as string | null)),
    avaliacao_laudo_atrasado: reais((atrasados.data ?? []).map((x) => x.owner_id as string | null)),
    avaliacao_credenciamento: reais(((creds.data ?? []) as unknown as { user_id: string | null; parceiros: { user_id: string | null } | null }[]).map((c) => c.user_id ?? c.parceiros?.user_id)),
  };
}

async function credenciar(c: { nome: string }, userId: string, chave: string): Promise<void> {
  const { data: parc, error: eP } = await adm()
    .from("parceiros")
    .insert({ user_id: userId, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: c.nome, slug: `${chave}-t1762-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
    .select("id")
    .single();
  if (eP) throw eP;
  ids[`parc_${chave}`] = parc.id as string;
  const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
  const { data: cred, error: eC } = await adm()
    .from("avaliadores_credenciamento")
    .insert({ parceiro_id: parc.id, cidade: CIDADE, numero_credenciado: n as string, status: "solicitado", experiencia_link: `https://portfolio.lab.vivanomads.test/t1762-${chave}`, conduta_versao: "2026-10-23" })
    .select("id")
    .single();
  if (eC) throw eC;
  ids[`cred_${chave}`] = cred.id as string;
  numero[chave] = n as string;
}
async function pedido(chave: string, linha: Record<string, unknown>): Promise<void> {
  const { data, error } = await adm().from("vistoria_pedidos").insert({ cidade: CIDADE, porte: "q1_2", valor_tabela: 350, ...linha }).select("id").single();
  if (error) throw error;
  ids[chave] = data.id as string;
}

test.describe("T1762 — E1163: as três filas da avaliação contam na Central, pelo mesmo número da página dos avaliadores @E1163", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    for (const [k, c] of [["donoReal", donoReal], ["donoTeste", donoTeste], ["candReal", candReal], ["candTeste", candTeste]] as const) ids[k] = await criarConta(c, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.donoTeste, ids.candTeste]);
    if (t.error) throw t.error;
    for (const [k, dono, titulo] of [["imovelParado", ids.donoReal, "Lar parado"], ["imovelAtraso", ids.donoReal, "Lar com laudo atrasado"], ["imovelTeste", ids.donoTeste, "Lar de teste"]] as const) {
      ids[k] = await criarImovelPronto(dono, `${titulo} ${sufixo}`, { ativo: true });
    }
    const cid = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovelParado, ids.imovelAtraso, ids.imovelTeste]);
    if (cid.error) throw cid.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: porte === "q1_2" ? 350 : 300 })));
    if (eT) throw eT;

    // O pedido parado há 40 dias, numa cidade sem avaliador.
    await pedido("pedidoParado", { property_id: ids.imovelParado, owner_id: ids.donoReal, status: "pedido", aguardando_avaliador: true, criado_em: ha(40) });
    // A mordida: 51 pedidos MAIS NOVOS que ele, já cancelados. A conta antiga olhava só os 50 mais recentes.
    const { error: eC } = await adm()
      .from("vistoria_pedidos")
      .insert(Array.from({ length: 51 }, (_, i) => ({ property_id: ids.imovelParado, owner_id: ids.donoReal, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "cancelada", criado_em: ha(2, i) })));
    if (eC) throw eC;
    // O laudo atrasado, como a rotina o deixa: a visita feita e o atraso gravado.
    await pedido("pedidoAtrasado", { property_id: ids.imovelAtraso, owner_id: ids.donoReal, status: "realizada", visita_concluida_em: ha(10), laudo_atrasado_em: ha(7), criado_em: ha(15) });
    // Os mesmos dois casos numa conta de teste: ficam fora do número, à parte.
    await pedido("pedidoParadoTeste", { property_id: ids.imovelTeste, owner_id: ids.donoTeste, status: "pedido", aguardando_avaliador: true, teste: true, criado_em: ha(60) });
    await pedido("pedidoAtrasadoTeste", { property_id: ids.imovelTeste, owner_id: ids.donoTeste, status: "realizada", teste: true, visita_concluida_em: ha(12), laudo_atrasado_em: ha(9), criado_em: ha(20) });
    // Dois pedidos de credenciamento por decidir: um de conta real, um de conta de teste.
    await credenciar(candReal, ids.candReal, "real");
    await credenciar(candTeste, ids.candTeste, "teste");
  });

  test.afterAll(async () => {
    const imoveis = [ids.imovelParado, ids.imovelAtraso, ids.imovelTeste].filter(Boolean);
    const contas = [ids.donoReal, ids.donoTeste, ids.candReal, ids.candTeste].filter(Boolean);
    const creds = [ids.cred_real, ids.cred_teste].filter(Boolean);
    if (contas.length) await adm().from("emails_teste").delete().in("usuario_id", contas);
    if (imoveis.length) {
      const { data: meus } = await adm().from("vistoria_pedidos").select("id").in("property_id", imoveis);
      const pedidos = (meus ?? []).map((x) => x.id as string);
      if (pedidos.length) {
        await adm().from("avisos").delete().in("ref_id", pedidos);
        await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
        await adm().from("vistoria_designacoes").delete().in("pedido_id", pedidos);
      }
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    }
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    if (creds.length) {
      await adm().from("vistoria_fila_admin").delete().in("avaliador_id", creds);
      await adm().from("avaliadores_credenciamento").delete().in("id", creds);
    }
    const parceiros = [ids.parc_real, ids.parc_teste].filter(Boolean);
    if (parceiros.length) await adm().from("parceiros").delete().in("id", parceiros);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(contas);
  });

  test("1. Central: as três linhas existem, com o texto, o botão e o destino, e contam no total do título", async ({ browser }) => {
    for (const w of [1280, 390] as const) {
      const p = await admin(browser, w);
      await abrirCentral(p);
      for (const f of FILAS) {
        const linha = linhaDaCentral(p, f.decisao);
        await expect(linha, `a linha ${f.decisao} está na Central`).toHaveCount(1, { timeout: 20_000 });
        expect(Number(await linha.getAttribute("data-n"))).toBeGreaterThanOrEqual(1);
        await expect(linha.locator("p").first()).toHaveText(f.texto);
        const link = linha.getByRole("link", { name: f.acao, exact: true });
        await expect(link).toHaveAttribute("href", f.href);
      }
      // A linha diz há quanto tempo espera a mais antiga (o pedido da spec está parado há 40 dias).
      await expect(linhaDaCentral(p, "avaliacao_sem_avaliador")).toContainText("mais antigo");
      // Conta no título: o total da Central é a soma dos filtros e das linhas — as três incluídas.
      const secao = p.getByTestId("central-decisoes");
      const filtros = secao.locator('[data-testid^="central-filtro-"]:not([data-testid="central-filtro-todos"])');
      const outras = p.getByTestId("central-linha-decisao");
      let soma = 0;
      for (let i = 0; i < (await filtros.count()); i++) soma += Number(await filtros.nth(i).getAttribute("data-n"));
      for (let i = 0; i < (await outras.count()); i++) soma += Number(await outras.nth(i).getAttribute("data-n"));
      expect(soma, "o título conta a soma da fila, com as três linhas da avaliação").toBe(Number(await secao.getAttribute("data-total")));
      await linhaDaCentral(p, "avaliacao_sem_avaliador").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t1762-1-central-${w}.png` });
      await p.context().close();
    }
  });

  test("2. um número, uma fonte: a Central, o 'Para decidir' da página e o banco (sem contas de teste) dizem o mesmo", async ({ browser }) => {
    const central = await admin(browser, 1280);
    const pagina = await admin(browser, 1280);
    // Outras specs mexem nas mesmas filas: a comparação só vale quando as leituras à volta coincidem; senão, repete.
    await expect(async () => {
      const banco = await numerosDoBanco();
      const naCentral = await numerosDaCentral(central);
      const naPagina = await numerosDaPagina(pagina);
      const bancoDepois = await numerosDoBanco();
      expect(bancoDepois, "as filas não mudaram a meio da leitura").toEqual(banco);
      expect(naCentral, "a Central conta o que o banco tem, sem as contas de teste").toEqual(banco);
      expect(naPagina, "o 'Para decidir' da página é o número da Central").toEqual(naCentral);
    }).toPass({ timeout: 120_000, intervals: [1_000, 3_000, 5_000] });
    await central.context().close();
    await pagina.context().close();
  });

  test("3. página: o pedido parado mais antigo está na lista; número = lista; o que é de conta de teste fica à parte", async ({ browser }) => {
    for (const w of [1280, 390] as const) {
      const p = await admin(browser, w);
      await abrirAvaliadores(p);
      const topo = p.getByTestId("avaliacoes-decidir");

      // Sem avaliador: o pedido de 40 dias está na lista, apesar dos 51 mais novos.
      const semAvaliador = p.getByTestId("avaliacoes-sem-avaliador");
      const parado = semAvaliador.locator(`[data-testid="sem-avaliador-item"][data-pedido="${ids.pedidoParado}"]`);
      await expect(parado, "o pedido parado mais antigo aparece").toHaveCount(1);
      await expect(parado).toHaveAttribute("data-conta-teste", "nao");
      await expect(parado).toContainText(CIDADE);
      await expect(topo.getByTestId("decidir-numero-sem-avaliador")).toHaveAttribute("data-valor", String(await semAvaliador.locator('[data-testid="sem-avaliador-item"][data-conta-teste="nao"]').count()));
      const paradosDeTeste = semAvaliador.getByTestId("sem-avaliador-de-teste");
      await expect(paradosDeTeste.locator(`[data-testid="sem-avaliador-item"][data-pedido="${ids.pedidoParadoTeste}"]`)).toHaveAttribute("data-conta-teste", "sim");
      await expect(paradosDeTeste.locator("p").first()).toHaveText(`Mais ${await paradosDeTeste.getAttribute("data-valor")} de conta de teste, fora do número:`);
      await expect(paradosDeTeste.getByTestId("sem-avaliador-item")).toHaveCount(Number(await paradosDeTeste.getAttribute("data-valor")));

      // Laudos atrasados: o que a rotina gravou.
      const atrasados = p.getByTestId("laudos-atrasados");
      await expect(atrasados.locator(`[data-testid="laudo-atrasado-item"][data-pedido="${ids.pedidoAtrasado}"]`)).toHaveAttribute("data-conta-teste", "nao");
      await expect(topo.getByTestId("decidir-numero-laudos-atrasados")).toHaveAttribute("data-valor", String(await atrasados.locator('[data-testid="laudo-atrasado-item"][data-conta-teste="nao"]').count()));
      const atrasadosDeTeste = atrasados.getByTestId("laudos-atrasados-de-teste");
      await expect(atrasadosDeTeste.locator(`[data-testid="laudo-atrasado-item"][data-pedido="${ids.pedidoAtrasadoTeste}"]`)).toHaveAttribute("data-conta-teste", "sim");
      await expect(atrasadosDeTeste.locator("p").first()).toHaveText(`Mais ${await atrasadosDeTeste.getAttribute("data-valor")} de conta de teste, fora do número:`);

      // Credenciamentos: a seção "a decidir" tem o de conta real e conta o mesmo que o topo; o de teste fica à parte.
      const aDecidir = p.getByTestId("credenciamento-secao-a-decidir");
      await expect(aDecidir.locator(`[data-testid="credenciamento-item"][data-numero="${numero.real}"]`)).toHaveCount(1);
      await expect(aDecidir.locator(`[data-testid="credenciamento-item"][data-numero="${numero.teste}"]`)).toHaveCount(0);
      await expect(topo.getByTestId("decidir-numero-credenciamentos")).toHaveAttribute("data-valor", (await aDecidir.getAttribute("data-total"))!);
      await expect(aDecidir.getByTestId("credenciamento-item")).toHaveCount(Number(await aDecidir.getAttribute("data-total")));
      const aDecidirDeTeste = p.getByTestId("credenciamento-secao-a-decidir-de-teste");
      await expect(aDecidirDeTeste.locator(`[data-testid="credenciamento-item"][data-numero="${numero.teste}"]`)).toHaveCount(1);
      await expect(aDecidirDeTeste.getByRole("heading", { level: 3 })).toHaveText(`Mais ${await aDecidirDeTeste.getAttribute("data-total")} de conta de teste, fora do número:`);

      // Sem rolagem lateral, e as telas.
      expect(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), "sem rolagem lateral").toBe(true);
      await topo.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t1762-3-para-decidir-${w}.png` });
      await aDecidirDeTeste.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t1762-3-credenciamento-de-teste-${w}.png` });
      await paradosDeTeste.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t1762-3-sem-avaliador-${w}.png` });
      await atrasadosDeTeste.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t1762-3-laudos-atrasados-${w}.png` });
      await p.context().close();
    }
  });

  test("4. cada linha da Central leva à seção dela na página dos avaliadores", async ({ browser }) => {
    const p = await admin(browser, 1280);
    const destinos = [
      { decisao: "avaliacao_sem_avaliador", ancora: "sem-avaliador", dentro: `[data-testid="sem-avaliador-item"][data-pedido="${ids.pedidoParado}"]` },
      { decisao: "avaliacao_laudo_atrasado", ancora: "contestacoes", dentro: `[data-testid="laudo-atrasado-item"][data-pedido="${ids.pedidoAtrasado}"]` },
      { decisao: "avaliacao_credenciamento", ancora: "credenciamento", dentro: `[data-testid="credenciamento-item"][data-numero="${numero.real}"]` },
    ];
    for (const d of destinos) {
      await abrirCentral(p);
      await linhaDaCentral(p, d.decisao).getByRole("link").click();
      await expect(p).toHaveURL(new RegExp(`/admin/avaliadores#${d.ancora}$`), { timeout: 30_000 });
      // A âncora existe e a fila está dentro dela.
      await expect(p.locator(`#${d.ancora}`).locator(d.dentro)).toHaveCount(1, { timeout: 20_000 });
    }
    await p.context().close();
  });
});
