import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { adm, criarConta, novaSenha, novoSufixo, NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T1741 — E1098 @E1098 (ORDEM-DUET-505): a tela de detalhe do chamado da Central, pelo mockup aprovado
  (e1098-central-chamado-detalhe-desktop.html e -mobile.html). Os três comportamentos da ordem, na tela:
   1. a RESPOSTA ao cliente aparece UMA vez;
   2. os RÓTULOS DE PRIORIDADE são os unificados ("Urgente · P1", "Alta · P2", "Normal · P3", "Baixa · P4"), no selo,
      no seletor e no histórico;
   3. há UM SÓ INDICADOR de prazo, no formato "Resolver até hoje, 22/11, às 16:40 · Faltam 8 horas".
  E o que o mockup desenha à volta: o assunto e o estado no topo, os metadados nos selos e no cartão Detalhes, o
  histórico em frases e as ações em tamanho normal. Massa própria (uma conta e dois chamados, com sufixo da corrida).
  Casos:
   1. o chamado do mockup (respondido com a sugestão da Viva), a 1280 e a 390 px, com print de cada um;
   2. o chamado à espera: a sugestão está na caixa e não se repete na conversa; enviada, fica só na mensagem da equipe;
   3. mudar a prioridade pelo seletor: o selo e o histórico dizem o mesmo rótulo.
  Vizinha do E1244 (ORDENS-DUET 1213, 1219 e 1220): corre também no portão desse PR — a fila e o detalhe do chamado da
  Central ganharam a opção "Incluir simulações" e a marca "Simulação".
*/
const sufixo = novoSufixo();
const dono = { email: `dono.t1741.${sufixo}@lab.vivanomads.test`, nome: `Dário Mockup ${sufixo}`, role: "owner" as const };
const RESPOSTA = `Olá, Dário! O site da Viva Nomads está em pré-lançamento, ou seja, em fase de testes, e o lançamento oficial será em 2027 (${sufixo}).`;
const NOTA = `Sugestão da Viva para aprovar (Aprovar e enviar = vai para a pessoa como resposta da equipe).\nResposta sugerida:\n${RESPOSTA}`;
const RESUMO = (geradoEm: string) => ({
  resumo: "Pessoa com conta pergunta quando a Viva Nomads será lançada. Até agora só recebeu a confirmação automática de recebimento, sem resposta da equipe.",
  acoes: [
    { texto: "Responder que o site está em pré-lançamento (fase de testes) e o lançamento oficial é em 2027", para: null },
    { texto: "Informar que, por já ter conta, será avisada das novidades", para: null },
  ],
  origem: "ia",
  geradoEm,
});
const H = 3_600_000;
const ids: string[] = [];
let donoId = "";

const emBrasilia = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...o }).format(new Date(iso));
const diaMes = (iso: string) => emBrasilia(iso, { day: "2-digit", month: "2-digit" });
const hora = (iso: string) => emBrasilia(iso, { hour: "2-digit", minute: "2-digit", hour12: false });

interface Semeado {
  id: string;
  numero: string;
  notaId: number;
  respondidoEm: string;
}

/** Um chamado com a forma do mockup: aberto há 40 h pelo chat, escalado, com a sugestão da Viva como nota interna. */
async function semear(assunto: string, respondido: boolean): Promise<Semeado> {
  const agora = Date.now();
  const t = (horasAtras: number, s = 0) => new Date(agora - horasAtras * H + s * 1000).toISOString();
  const { data: c, error } = await adm()
    .from("chamados")
    .insert({
      usuario_id: donoId,
      tipo: "suporte",
      categoria: "conta",
      prioridade: "p1",
      status: respondido ? "aguardando_usuario" : "aberto",
      canal: "site",
      assunto,
      responsavel_tipo: "humano",
      criado_em: t(40),
      prazo_primeira_resposta: t(28),
      prazo_resolucao: new Date(agora + 8 * H).toISOString(),
      primeira_resposta_em: respondido ? t(1) : null,
      sla_estado: "em_risco",
      simulacao: true,
    })
    .select("id, numero_publico")
    .single();
  if (error) throw error;
  const id = c.id as string;
  ids.push(id);
  const msgs = [
    { autor: "usuario", interno: false, corpo: "Ola quando a viva irá ser lançada?", criado_em: t(40) },
    { autor: "ia", interno: false, corpo: `Recebemos seu chamado ${c.numero_publico} (Conta ou acesso). Um especialista da equipe responde em até 24 horas.`, criado_em: t(40, 5) },
    // O resumo já guardado (como a Viva deixa na abertura): abrir a tela não gera outro nem escreve no histórico.
    { autor: "ia", interno: true, corpo: `[resumo-e-acoes]\n${JSON.stringify(RESUMO(t(40, 15)))}`, criado_em: t(40, 15) },
    { autor: "ia", interno: true, corpo: NOTA, criado_em: t(40, 20) },
    ...(respondido ? [{ autor: "admin", interno: false, corpo: RESPOSTA, criado_em: t(1) }] : []),
  ];
  const { data: ms, error: eM } = await adm().from("chamado_mensagens").insert(msgs.map((m) => ({ ...m, chamado_id: id, simulacao: true }))).select("id, interno, autor");
  if (eM) throw eM;
  const notaId = Math.max(...ms!.filter((m) => m.interno && m.autor === "ia").map((m) => Number(m.id)));
  const eventos = [
    { ator_tipo: "usuario", acao: "aberto", criado_em: t(40) },
    { ator_tipo: "usuario", acao: "pediu_humano", para: "p2", detalhe: 'abriu pelo "Falar com uma pessoa"', criado_em: t(40, 1) },
    { ator_tipo: "sistema", acao: "acolhido", criado_em: t(40, 5) },
    { ator_tipo: "admin", acao: "resumo_ia", detalhe: "gerado ao abrir", criado_em: t(40, 15) },
    { ator_tipo: "admin", acao: "sugestao_ia", criado_em: t(40, 20) },
    { ator_tipo: "sistema", acao: "escalado_2h", criado_em: t(26) },
    { ator_tipo: "sistema", acao: "escalado_6h", criado_em: t(26, 5) },
    { ator_tipo: "sistema", acao: "prioridade_subiu", de: "p2", para: "p1", criado_em: t(26, 10) },
    ...(respondido
      ? [
          { ator_tipo: "admin", acao: "respondido", de: "aberto", para: "aguardando_usuario", criado_em: t(1) },
          // No mesmo instante da resposta: a nota diz a hora deste registo, e um segundo a mais podia virar o minuto.
          { ator_tipo: "admin", acao: "sugestao_aprovada", de: String(notaId), criado_em: t(1) },
        ]
      : []),
  ];
  const { error: eE } = await adm().from("chamado_eventos").insert(eventos.map((e) => ({ ...e, chamado_id: id, simulacao: true })));
  if (eE) throw eE;
  return { id, numero: c.numero_publico as string, notaId, respondidoEm: t(1) };
}

/** Quantas vezes o texto aparece na tela: no que se lê e no que está escrito nas caixas. */
async function vezesNaTela(page: Page, alvo: string): Promise<number> {
  return page.evaluate((s) => {
    const conta = (t: string) => t.split(s).length - 1;
    // innerText é o que se lê (não traz o valor das caixas); o valor das caixas conta à parte.
    const caixas = [...document.querySelectorAll("textarea")].map((x) => (x as HTMLTextAreaElement).value).join("\n");
    return conta((document.querySelector("main") ?? document.body).innerText) + conta(caixas);
  }, alvo);
}

async function abrir(page: Page, id: string) {
  await page.goto(`/admin/atendimento/${id}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("chamado-cabecalho")).toBeVisible({ timeout: 30_000 });
  // O resumo carrega sozinho; espera para a tela (e o print) ficar inteira.
  await expect(page.getByTestId("resumo-texto")).toBeVisible({ timeout: 30_000 });
}

test.describe("T1741 — E1098: o detalhe do chamado da Central pelo mockup @E1098", () => {
  test.use({ storageState: authFile("admin") });
  test.describe.configure({ mode: "default", timeout: 120_000 });
  test.skip(!NO_LABORATORIO, "Precisa do banco do laboratório.");

  test.beforeAll(async () => {
    donoId = await criarConta(dono, novaSenha());
  });
  test.afterAll(async () => {
    // A fila do admin é fotografada por outras specs (t271): os chamados desta corrida saem no fim.
    if (ids.length) await adm().from("chamados").delete().in("id", ids);
  });

  for (const largura of [1280, 390]) {
    test(`1. ${largura} px: o chamado do mockup — resposta uma vez, rótulos unificados, um só prazo`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 900 });
      const c = await semear(`Conversa com a Viva (chat do site) ${sufixo} ${largura}`, true);
      await abrir(page, c.id);

      // O assunto e o estado mandam; os metadados são selos.
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Conversa com a Viva (chat do site) ${sufixo} ${largura}`);
      const selos = page.getByTestId("chamado-selos").locator("li");
      // E1244 (ORDENS-DUET 1213 e 1220, asserção alterada): o chamado semeado aqui é de SIMULAÇÃO (simulacao: true) — o
      // detalhe passa a dizê-lo com o selo "Simulação", logo depois do número.
      await expect(selos).toHaveText([c.numero, "Simulação", "Aguardando resposta do usuário", "Urgente · P1", "Conta ou acesso", "Chat do site"]);

      // (3) UM indicador de prazo, no formato da ordem.
      const prazo = page.getByTestId("chamado-prazo");
      await expect(prazo).toHaveCount(1);
      await expect(prazo).toContainText("Prazo de resolução · em risco");
      await expect(prazo).toContainText(/Resolver até (hoje|amanhã), \d{2}\/\d{2}, às \d{2}:\d{2}/);
      await expect(prazo).toContainText("Faltam 8 horas (horário de Brasília)");
      await expect(page.locator("main")).not.toContainText(/1ª resposta:|restantes|resolver em/);
      // O cartão Prazos lê o mesmo prazo (não é um segundo relógio com outra conta).
      await expect(page.getByTestId("chamado-prazos-resumo")).toHaveText("Resolução · faltam 8 h");

      // (2) rótulos unificados: no selo (acima), no seletor e no histórico.
      const seletor = page.getByTestId("chamado-seletor-prioridade");
      await expect(seletor.locator("option")).toHaveText(["Urgente · P1", "Alta · P2", "Normal · P3", "Baixa · P4"]);
      await expect(seletor).toHaveValue("p1");
      const historico = page.getByTestId("chamado-historico");
      await expect(historico).toContainText("Prioridade aumentada para Urgente · P1");
      await expect(page.locator("main")).not.toContainText(/P1 — |Prioridade alta/);

      // (1) a resposta aparece UMA vez: na mensagem da equipe. A nota da sugestão só aponta para ela.
      await expect(page.getByTestId("mensagem-da-equipe")).toContainText(RESPOSTA);
      await expect(page.getByTestId("nota-sugestao-enviada")).toContainText(
        `Sugestão aprovada e enviada como resposta da equipe em ${diaMes(c.respondidoEm)}, às ${hora(c.respondidoEm)} — o texto está na mensagem da equipe, logo abaixo. A pessoa não vê esta nota.`,
      );
      expect(await vezesNaTela(page, RESPOSTA)).toBe(1);
      await expect(page.getByTestId("chamado-responder").locator("textarea")).toHaveValue("");
      // Caixa vazia: o botão parado diz porquê (o motivo está ligado ao botão, não só por perto).
      await expect(page.getByTestId("enviar-resposta")).toBeDisabled();
      await expect(page.getByTestId("enviar-resposta")).toHaveAttribute("aria-describedby", "chamado-dica-caixa-vazia");
      await expect(page.locator("#chamado-dica-caixa-vazia")).toBeVisible();

      // O histórico em frases, do mais recente para o mais antigo; nenhum código de evento na tela.
      await expect(historico.locator("li p:nth-of-type(2)")).toHaveText([
        "Equipe respondeu à pessoa",
        "Prioridade aumentada para Urgente · P1",
        "Alertas de prazo enviados à equipe",
        "Resumo e sugestão gerados pela Viva (IA)",
        "Confirmação automática enviada à pessoa",
        `Chamado aberto por Dário`,
      ]);
      await expect(historico).toContainText("Pelo chat do site, na opção “Falar com uma pessoa” · Categoria: Conta ou acesso.");
      await expect(historico).toContainText("A sugestão da Viva foi enviada como estava. O chamado passou a aguardar a resposta do usuário.");
      await expect(historico).not.toContainText(/sugestao_|escalado_|prioridade_subiu|→|sistema:/);

      // A lateral do mockup: Detalhes (pessoa, números, linhas), Prazos e Ações em tamanho normal.
      await expect(page.getByTestId("chamado-pessoa")).toContainText("Dário");
      await expect(page.getByTestId("chamado-pessoa")).toContainText("Proprietário · conta desde");
      await expect(page.getByTestId("chamado-numeros").locator("li")).toHaveText([/anúncios/, /pedidos/, /chamados/]);
      for (const rotulo of ["Responsável", "Aberto em", "Canal", "Categoria", "Resolver até", "Primeira resposta da equipe", "Prazo da primeira resposta"]) {
        await expect(page.getByRole("term").filter({ hasText: new RegExp(`^${rotulo}$`) })).toBeVisible();
      }
      const acoes = page.getByTestId("chamado-acoes");
      for (const nome of ["Atribuir a mim", "Aprovação interna", "Marcar como resolvido", "Encerrar chamado"]) {
        const b = acoes.getByRole("button", { name: nome, exact: true });
        await expect(b).toBeVisible();
        const caixa = (await b.boundingBox())!;
        expect(caixa.height, `${nome}: altura normal`).toBeGreaterThanOrEqual(40);
        expect(caixa.height, `${nome}: altura normal`).toBeLessThanOrEqual(48);
      }
      // Os dois primeiros lado a lado; resolver e encerrar na largura inteira, como no mockup.
      const [a, b, r] = await Promise.all(["Atribuir a mim", "Aprovação interna", "Marcar como resolvido"].map(async (n) => (await acoes.getByRole("button", { name: n, exact: true }).boundingBox())!));
      expect(Math.abs(a.y - b.y)).toBeLessThan(2);
      expect(b.x).toBeGreaterThan(a.x + a.width - 1);
      expect(r.width).toBeGreaterThan(a.width * 1.8);

      // Na barra da sugestão, o texto e os botões não se sobrepõem (a 390 px o texto fica na linha de cima).
      const transbordo = () => page.getByTestId("sugestao-pronta").locator("p").evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(await transbordo(), "o texto da barra cabe na largura dele (não escorre por baixo dos botões)").toBeLessThanOrEqual(1);
      // Nada passa da largura da tela.
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      // O painel rola dentro da casca: para o print trazer a tela inteira, a janela cresce até caber tudo.
      await page.setViewportSize({ width: largura, height: largura === 390 ? 4200 : 2400 });
      await page.screenshot({ path: `tests/laboratorio/saida/t1741-1-chamado-respondido-${largura}.png`, fullPage: true });
    });
  }

  test("2. à espera: a sugestão está na caixa e não se repete na conversa; enviada, fica só na mensagem da equipe", async ({ page }) => {
    const c = await semear(`Chamado à espera ${sufixo}`, false);
    await abrir(page, c.id);
    const caixa = page.getByTestId("chamado-responder").locator("textarea");
    await expect(caixa).toHaveValue(RESPOSTA);
    await expect(page.getByTestId("sugestao-pronta")).toContainText("Sugestão da Viva (IA) pronta para este chamado");
    // Na conversa, a nota só aponta para a caixa: o texto está UMA vez na tela.
    await expect(page.getByTestId("nota-sugestao-na-caixa")).toContainText("Sugestão pronta — o texto está na caixa de resposta, logo abaixo. A pessoa não vê esta nota.");
    await expect(page.getByTestId("chamado-conversa")).not.toContainText(RESPOSTA);
    expect(await vezesNaTela(page, RESPOSTA)).toBe(1);
    await page.setViewportSize({ width: 1280, height: 2400 });
    await page.screenshot({ path: "tests/laboratorio/saida/t1741-2-chamado-a-espera-1280.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.getByTestId("enviar-resposta").click();
    await expect(page.getByTestId("mensagem-da-equipe")).toContainText(RESPOSTA, { timeout: 20_000 });
    await expect(page.getByTestId("nota-sugestao-enviada")).toContainText("Sugestão aprovada e enviada como resposta da equipe em");
    await expect(caixa).toHaveValue("");
    expect(await vezesNaTela(page, RESPOSTA)).toBe(1);
    await expect(page.getByTestId("chamado-historico")).toContainText("A sugestão da Viva foi enviada como estava.");
    await expect(page.getByTestId("chamado-status")).toHaveText("Aguardando resposta do usuário");
    // No banco: UMA resposta pública da equipe, com o texto da sugestão.
    const { data: ms } = await adm().from("chamado_mensagens").select("corpo").eq("chamado_id", c.id).eq("autor", "admin").eq("interno", false);
    expect((ms ?? []).map((m) => m.corpo)).toEqual([RESPOSTA]);
  });

  test("3. mudar a prioridade pelo seletor: o selo e o histórico dizem o mesmo rótulo", async ({ page }) => {
    const c = await semear(`Chamado para mudar a prioridade ${sufixo}`, true);
    await abrir(page, c.id);
    await expect(page.getByTestId("chamado-prioridade")).toHaveText("Urgente · P1");
    await page.getByTestId("chamado-seletor-prioridade").selectOption({ label: "Normal · P3" });
    await expect(page.getByTestId("chamado-prioridade")).toHaveText("Normal · P3", { timeout: 20_000 });
    await expect(page.getByTestId("chamado-historico").locator("li").first()).toContainText("Prioridade alterada para Normal · P3");
    const { data } = await adm().from("chamados").select("prioridade").eq("id", c.id).single();
    expect(data?.prioridade).toBe("p3");
  });
});
