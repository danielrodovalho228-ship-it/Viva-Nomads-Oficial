import { test, expect, type Browser, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { authFile } from "../fixtures/auth";
import { diaUtilNoEnsaio } from "../fixtures/feriados-do-ensaio";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { devolverAVezDaRotinaDaVistoria, pegarAVezDaRotinaDaVistoria } from "../fixtures/vez-da-rotina-da-vistoria";

/*
  T1765 — E1160 @E1160 (ORDENS-DUET 659, 674 e 675; linha Parceiros). Os e-mails da avaliação de imóvel passam a dizer
  o que de facto aconteceu e o passo de quem os lê. Esta spec faz acontecer cada momento (pela rotina ou pela tela) e lê
  o e-mail gravado na caixa de teste do laboratório.
  Só contas de teste. Duas cidades próprias da spec:
   • A, com dois avaliadores ativos (há sempre outro para o dono escolher);
   • B, com um avaliador só, suspenso antes do tique (não sobra ninguém para escolher).
  A rotina corre num 2º servidor do mesmo build (porta 3155, CRON_SECRET só dele) e, por correr sobre o banco inteiro,
  esta spec pega a vez da rotina — e devolve-a logo que o tique dela acaba (os outros casos não dependem do relógio).
   1. A rotina: o avaliador que não respondeu → o dono lê "não respondeu no prazo… escolha outro" (e nunca "aceitar");
      a proposta que expirou sem sobrar avaliador → "a equipe da Viva foi avisada", com o botão "Ver a avaliação", e o
      avaliador lê "voltou ao proprietário"; o lembrete da véspera sem o convite a mudar — o dono e o avaliador com a
      regra do reagendamento, o morador com o texto dele.
   2. O avaliador recusa pela tela → o dono lê "recusou… escolha outro" e a página dele tem a escolha aberta. Print a
      390 e a 1280 px.
   3. O avaliador envia a proposta pela tela → o dono lê que há proposta e até quando aceita. Depois o dono marca a
      visita e troca a data: o 2º e-mail diz "nova data" e qual era a anterior, aos dois.
   4. A equipe abre uma verificação pela tela → o dono lê o passo dele (escolher o avaliador).
   5. A página do dono na cidade sem avaliador diz o mesmo que o e-mail do caso 1. Print a 390 e a 1280 px.
  O e-mail do laudo (assinado pelo avaliador credenciado nº X) não tem caso de tela aqui: emitir um laudo pela tela é a
  jornada inteira do avaliador. E1188: esse caso é a t1785, que faz o laudo sair pela tela e lê o e-mail.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE_A = "Indianópolis";
const CIDADE_B = "Grupiara";
const PORTA = 3155;
const SEGREDO = `lab-t1765-${Math.random().toString(36).slice(2)}`;
const HORA = 3_600_000;
const ROTA_AVALIADOR = "/dashboard/parceiro/avaliacao";
const REGRA = "Reagendar sem custo: uma vez, com pelo menos 24 horas de aviso."; // REGRA_DO_REAGENDAMENTO (regras.ts)
const NOTA_DIAS_UTEIS = "Dias úteis: segunda a sexta, sem feriados nacionais."; // NOTA_DIAS_UTEIS (calendario/dias-uteis.ts), E1192
// E1177 (asserções alteradas, ORDEM-DUET-778): sem avaliador para escolher, o e-mail e a página já não prometem o
// aviso — dizem que a equipe foi avisada (SEM_OUTRO_AVALIADOR e TEXTO_DA_ESPERA, em espera-de-avaliador.ts).
const A_EQUIPE_FOI_AVISADA = "A equipe da Viva foi avisada.";
const SEM_OUTRO = `Não há outro avaliador disponível agora. ${A_EQUIPE_FOI_AVISADA}`;
const ESCOLHA_OUTRO = "Escolha outro avaliador na página da avaliação.";
const senha = novaSenha();
const sufixo = novoSufixo();
const contas = {
  dono: { email: `dono.t1765.${sufixo}@lab.vivanomads.test`, nome: "Dora Aviso", role: "owner" as const },
  morador: { email: `mora.t1765.${sufixo}@lab.vivanomads.test`, nome: "Ana Mora", role: "tenant" as const },
  avalA1: { email: `aval1.t1765.${sufixo}@lab.vivanomads.test`, nome: "Valdo Primeiro", role: "tenant" as const },
  avalA2: { email: `aval2.t1765.${sufixo}@lab.vivanomads.test`, nome: "Vera Segunda", role: "tenant" as const },
  avalB: { email: `avalb.t1765.${sufixo}@lab.vivanomads.test`, nome: "Beto Único", role: "tenant" as const },
};
const TITULO = {
  silencio: `Casa silêncio t1765 ${sufixo}`,
  expira: `Casa expira t1765 ${sufixo}`,
  lembrete: `Casa lembrete t1765 ${sufixo}`,
  recusa: `Casa recusa t1765 ${sufixo}`,
  proposta: `Casa proposta t1765 ${sufixo}`,
  verificacao: `Casa verificação t1765 ${sufixo}`,
} as const;
type Caso = keyof typeof TITULO;
const ids: Record<string, string> = {};
const imovel = {} as Record<Caso, string>;
const pedido = {} as Record<Exclude<Caso, "verificacao">, string>;
let servidor: ChildProcess | null = null;

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const semRolagemLateral = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const linha = async (id: string) => (await adm().from("vistoria_pedidos").select("status, avaliador_id, proposta_em, agendado_para, aguardando_avaliador").eq("id", id).single()).data!;
type Email = { assunto: string; corpo: string };
/** Os e-mails de um evento que a conta recebeu sobre UM imóvel (o corpo nomeia o imóvel). */
const emails = async (usuario: string, evento: string, titulo: string) =>
  (((await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuario).eq("evento", evento).order("criado_em", { ascending: true })).data ?? []) as Email[]).filter((e) => e.corpo.includes(titulo));
const avisos = async (usuario: string, evento: string, pedidoId: string) => ((await adm().from("avisos").select("url").eq("usuario_id", usuario).eq("evento", evento).eq("ref_id", pedidoId)).data ?? []) as { url: string }[];
const umEmail = async (usuario: string, evento: string, titulo: string, quantos = 1): Promise<Email[]> => {
  await expect.poll(async () => (await emails(usuario, evento, titulo)).length, { timeout: 30_000, message: `${quantos} e-mail(s) "${evento}" sobre ${titulo}` }).toBe(quantos);
  return emails(usuario, evento, titulo);
};
/** "06/11/2026 às 14:30" em Brasília — como o e-mail escreve a data da visita. */
const quando = (iso: string) => {
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const v = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} às ${v("hour")}:${v("minute")}`;
};
/**
 * E1188: a data do laudo como o e-mail a escreve ("03/12/2026") — N dias úteis depois da visita, de segunda a sexta, em
 * Brasília. Conta feita aqui, à parte do produto: a visita que cai num fim de semana começa a contar na segunda, 0 h.
 * E1192 (ORDEM-DUET-861): o dia útil pula também os feriados nacionais (lista do ensaio, à parte do produto) — sem isto
 * a spec passava a esperar a data errada sempre que houvesse um feriado entre a visita e o laudo (Natal, 1.º de janeiro).
 */
const laudoAte = (visitaIso: string, diasUteis: number) => {
  const DIA = 24 * HORA;
  // O relógio de Brasília como se fosse UTC (−3 h fixas), para ler o dia da semana e a data.
  let t = Date.parse(visitaIso) - 3 * HORA;
  const naoUtil = (x: number) => !diaUtilNoEnsaio(new Date(x).toISOString().slice(0, 10));
  if (naoUtil(t)) {
    t = Math.floor(t / DIA) * DIA + DIA;
    while (naoUtil(t)) t += DIA;
  }
  for (let i = 0; i < diasUteis; i++) {
    t += DIA;
    while (naoUtil(t)) t += DIA;
  }
  const d = new Date(t);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
};
/** O dia de Brasília daqui a `dias` dias (AAAA-MM-DD). */
const diaDeBrasilia = (dias: number) => new Date(Date.now() + dias * 24 * HORA - 3 * HORA).toISOString().slice(0, 10);

async function avaliadorNaCidade(chave: "avalA1" | "avalA2" | "avalB", cidade: string): Promise<void> {
  const { data: parc, error: eP } = await adm()
    .from("parceiros")
    .insert({ user_id: ids[chave], tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: contas[chave].nome, slug: `${chave.toLowerCase()}-t1765-${sufixo}`, categorias: ["fotografia"], cidades: [cidade] })
    .select("id")
    .single();
  if (eP) throw eP;
  ids[`parc_${chave}`] = parc.id as string;
  const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
  const { data: cred, error: eC } = await adm()
    .from("avaliadores_credenciamento")
    .insert({ parceiro_id: parc.id, cidade, numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1765", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
    .select("id")
    .single();
  if (eC) throw eC;
  ids[`cred_${chave}`] = cred.id as string;
}

/** Um pedido do dono com o avaliador escolhido há `horas` horas; os campos de `mais` dizem em que ponto ele está. */
async function novoPedido(caso: Exclude<Caso, "verificacao">, cidade: string, cred: string, horas: number, mais: Record<string, unknown>, resposta: "aceita" | null): Promise<void> {
  const escolha = new Date(Date.now() - horas * HORA).toISOString();
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel[caso], owner_id: ids.dono, cidade, porte: "q1_2", valor_tabela: 350, status: "designado", teste: true, avaliador_id: cred, designado_em: escolha, escolhido_em: escolha, ...mais })
    .select("id")
    .single();
  if (error) throw error;
  pedido[caso] = data.id as string;
  const d = await adm()
    .from("vistoria_designacoes")
    .insert({ pedido_id: data.id, avaliador_id: cred, designado_em: escolha, ...(resposta ? { resposta, respondido_em: (mais.proposta_em as string | undefined) ?? escolha } : {}) });
  if (d.error) throw d.error;
}

async function paginaDoDono(browser: Browser, caso: Caso): Promise<Page> {
  const d = await entrar(browser, contas.dono.email, senha);
  await d.goto(`/dashboard/imoveis/${imovel[caso]}/nivel`, { waitUntil: "domcontentloaded" });
  return d;
}

test.describe("T1765 — E1160: os e-mails da avaliação dizem o que aconteceu e o passo de quem os lê @E1160", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    // A rotina corre sobre o banco inteiro: esta spec só monta a massa quando nenhuma outra spec de rotina está a meio.
    await pegarAVezDaRotinaDaVistoria("t1765");
    for (const [k, c] of Object.entries(contas)) {
      ids[k] = await criarConta(c, senha);
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[k]);
      if (t.error) throw t.error;
      const p = await adm().from("vistoria_piloto").insert({ user_id: ids[k], nota: "T1765 (laboratório)" });
      if (p.error) throw p.error;
    }
    await avaliadorNaCidade("avalA1", CIDADE_A);
    await avaliadorNaCidade("avalA2", CIDADE_A);
    await avaliadorNaCidade("avalB", CIDADE_B);
    for (const caso of Object.keys(TITULO) as Caso[]) imovel[caso] = await criarImovelPronto(ids.dono, TITULO[caso], { ativo: true });
    const naB = [imovel.expira];
    const naA = (Object.keys(TITULO) as Caso[]).map((c) => imovel[c]).filter((i) => !naB.includes(i));
    for (const [cidade, lista] of [[CIDADE_A, naA], [CIDADE_B, naB]] as const) {
      const cid = await adm().from("properties").update({ city: cidade }).in("id", lista);
      if (cid.error) throw cid.error;
      const { error: eT } = await adm()
        .from("vistoria_precos")
        .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade, porte, valor: porte === "q1_2" ? 350 : 300 })));
      if (eT) throw eT;
    }
    const proposta = (h: number) => ({ valor_proposto: 380, prazo_proposto_dias: 5, proposta_em: new Date(Date.now() - h * HORA).toISOString() });
    // Para a rotina: o avaliador calado há 30 horas (o prazo dele é de 24); a proposta de há 75 horas (o prazo do dono é
    // de 72), na cidade onde não sobra ninguém; e a visita de amanhã às 10:00, num imóvel com morador.
    await novoPedido("silencio", CIDADE_A, ids.cred_avalA1, 30, {}, null);
    await novoPedido("expira", CIDADE_B, ids.cred_avalB, 77, proposta(75), "aceita");
    const amanha = `${diaDeBrasilia(1)}T13:00:00.000Z`;
    await novoPedido("lembrete", CIDADE_A, ids.cred_avalA1, 30, { ...proposta(28), proposta_aceita_em: new Date(Date.now() - 26 * HORA).toISOString(), status: "agendado", agendado_para: amanha, ocupado: true, morador_id: ids.morador, concordancia_em: new Date(Date.now() - 20 * HORA).toISOString() }, "aceita");
    ids.amanha = amanha;
    // Para a tela: dois pedidos acabados de chegar ao avaliador (a rotina não lhes toca).
    await novoPedido("recusa", CIDADE_A, ids.cred_avalA1, 0, {}, null);
    await novoPedido("proposta", CIDADE_A, ids.cred_avalA1, 0, {}, null);
    // Na cidade B não sobra ninguém: o único avaliador fica suspenso (a proposta dele continua a expirar).
    const s = await adm().from("avaliadores_credenciamento").update({ status: "suspenso" }).eq("id", ids.cred_avalB);
    if (s.error) throw s.error;
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const imoveis = Object.values(imovel).filter(Boolean);
    const todas = Object.keys(contas).map((k) => ids[k]).filter(Boolean);
    const creds = ["avalA1", "avalA2", "avalB"].map((k) => ids[`cred_${k}`]).filter(Boolean);
    const parcs = ["avalA1", "avalA2", "avalB"].map((k) => ids[`parc_${k}`]).filter(Boolean);
    if (todas.length) {
      await adm().from("emails_teste").delete().in("usuario_id", todas);
      await adm().from("avisos").delete().in("usuario_id", todas);
    }
    if (imoveis.length) {
      const { data: ps } = await adm().from("vistoria_pedidos").select("id").in("property_id", imoveis);
      const pedidos = ((ps ?? []) as { id: string }[]).map((p) => p.id);
      if (pedidos.length) {
        await adm().from("avisos").delete().in("ref_id", pedidos);
        await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
        await adm().from("vistoria_designacoes").delete().in("pedido_id", pedidos);
      }
      await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    }
    await adm().from("vistoria_precos").delete().in("cidade", [CIDADE_A, CIDADE_B]);
    if (todas.length) await adm().from("vistoria_piloto").delete().in("user_id", todas);
    if (creds.length) {
      await adm().from("vistoria_designacoes").delete().in("avaliador_id", creds);
      await adm().from("avaliadores_credenciamento").delete().in("id", creds);
    }
    if (parcs.length) await adm().from("parceiros").delete().in("id", parcs);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(todas);
    devolverAVezDaRotinaDaVistoria();
  });

  test("1. a rotina: sem resposta, expiração sem avaliador e lembrete — cada e-mail diz o seu caso", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    try {
      // Antes do tique nada aconteceu.
      expect(await emails(ids.dono, "vistoria_sem_resposta_dono", TITULO.silencio)).toHaveLength(0);
      expect(await emails(ids.dono, "vistoria_proposta_expirada_dono", TITULO.expira)).toHaveLength(0);
      expect(await emails(ids.morador, "vistoria_lembrete", TITULO.lembrete)).toHaveLength(0);

      const log = createWriteStream(`${SAIDA}/t1765-servidor-cron.log`);
      servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
        env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
        stdio: ["ignore", "pipe", "pipe"],
      });
      servidor.stdout?.pipe(log);
      servidor.stderr?.pipe(log);
      await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/vistoria`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
      const rodar = async () => {
        const r = await fetch(`http://localhost:${PORTA}/api/cron/vistoria`, { headers: { authorization: `Bearer ${SEGREDO}` } });
        const corpo = (await r.json().catch(() => ({}))) as { ok?: boolean; expiradas?: number; lembretes?: number };
        expect(r.status, JSON.stringify(corpo)).toBe(200);
        return corpo;
      };
      const tique = await rodar();
      expect(tique.expiradas ?? 0, "o silêncio e a proposta vencida").toBeGreaterThanOrEqual(2);
      expect(tique.lembretes ?? 0, "a visita de amanhã").toBeGreaterThanOrEqual(1);
      // A 2ª rodada não repete nada.
      await rodar();

      // (1) O avaliador não respondeu: o pedido voltou ao dono, e há outro avaliador na cidade.
      const silencio = await linha(pedido.silencio);
      expect(silencio.status).toBe("pedido");
      expect(silencio.aguardando_avaliador, "na cidade A sobra outro avaliador").toBe(false);
      const [calou] = await umEmail(ids.dono, "vistoria_sem_resposta_dono", TITULO.silencio);
      expect(calou.assunto).toMatch(/^(O avaliador não respondeu no prazo: |Avaliador sem resposta: )Casa silêncio/);
      expect(calou.assunto.length, `"${calou.assunto}" cabe em 70 caracteres`).toBeLessThanOrEqual(70);
      expect(calou.corpo).toContain(`Olá Dora, o avaliador credenciado que você escolheu não respondeu no prazo ao pedido de avaliação de ${TITULO.silencio}. ${ESCOLHA_OUTRO}`);
      expect(calou.corpo, "não há proposta nenhuma para aceitar").not.toMatch(/aceitar|72 horas|respondeu, recusou ou não respondeu/);
      expect(calou.corpo).toContain("Escolher avaliador");
      expect(await avisos(ids.dono, "vistoria_designado_dono", pedido.silencio), "o aviso genérico já não sai no silêncio").toHaveLength(0);
      expect(await avisos(ids.dono, "vistoria_sem_resposta_dono", pedido.silencio)).toHaveLength(1);

      // (4) A proposta expirou e não sobra avaliador: o e-mail não manda "escolher de novo".
      const expirou = await linha(pedido.expira);
      expect(expirou.status).toBe("pedido");
      expect(expirou.aguardando_avaliador, "na cidade B não sobra ninguém").toBe(true);
      const [aoDono] = await umEmail(ids.dono, "vistoria_proposta_expirada_dono", TITULO.expira);
      expect(aoDono.corpo).toContain(`Olá Dora, o prazo de 72 horas para aceitar a proposta de avaliação de ${TITULO.expira} terminou, e ela expirou. ${SEM_OUTRO}`);
      expect(aoDono.corpo).not.toContain("O pedido voltou para você escolher de novo.");
      expect(aoDono.corpo, "o botão não promete uma escolha que não há").toContain("Ver a avaliação");
      expect(aoDono.corpo).not.toContain("Escolher avaliador");
      const [aoAvaliador] = await umEmail(ids.avalB, "vistoria_proposta_expirada", TITULO.expira);
      expect(aoAvaliador.corpo).toContain("no prazo de 72 horas, e ela expirou. O pedido voltou ao proprietário. Você não precisa fazer nada.");
      expect(aoAvaliador.corpo).not.toContain("escolher de novo");

      // (5) O lembrete da véspera: sem o convite a mudar; a regra só para as duas partes; o morador com o texto dele.
      const amanha = `${quando(ids.amanha)} (horário de Brasília)`;
      for (const [quem, conta] of [["o dono", ids.dono], ["o avaliador", ids.avalA1]] as const) {
        const [l] = await umEmail(conta, "vistoria_lembrete", TITULO.lembrete);
        expect(l.corpo, quem).toContain(`a visita de avaliação de ${TITULO.lembrete} é amanhã, ${amanha}. ${REGRA}`);
        expect(l.corpo, quem).not.toMatch(/Se precisar mudar|avise pelas mensagens/);
      }
      const [aoMorador] = await umEmail(ids.morador, "vistoria_lembrete", TITULO.lembrete);
      expect(aoMorador.corpo).toContain(`Olá Ana, a visita de avaliação de ${TITULO.lembrete}, imóvel onde você mora, é amanhã, ${amanha}. O avaliador não fotografa os seus pertences.`);
      expect(aoMorador.corpo, "a regra do reagendamento não é para o morador").not.toMatch(/Reagendar|Se precisar mudar|avise pelas mensagens/);
    } finally {
      // Daqui para a frente nada depende do relógio: a vez da rotina volta já para as outras specs.
      servidor?.kill("SIGTERM");
      servidor = null;
      devolverAVezDaRotinaDaVistoria();
    }
  });

  test("2. o avaliador recusa pela tela: o dono lê 'recusou… escolha outro', e a página dele tem a escolha aberta", async ({ browser }) => {
    const a = await entrar(browser, contas.avalA1.email, senha);
    await largura(a, 390);
    await a.goto(`${ROTA_AVALIADOR}/${pedido.recusa}`, { waitUntil: "domcontentloaded" });
    const tela = a.getByTestId("pedido-avaliador");
    await expect(tela).toHaveAttribute("data-etapa", "novo", { timeout: 30_000 });
    await tela.getByRole("button", { name: "Recusar" }).click();
    await expect.poll(async () => (await linha(pedido.recusa)).status, { timeout: 20_000 }).toBe("pedido");
    await a.context().close();
    expect((await linha(pedido.recusa)).aguardando_avaliador, "na cidade A sobra outro avaliador").toBe(false);

    const [recusou] = await umEmail(ids.dono, "vistoria_recusada_dono", TITULO.recusa);
    expect(recusou.assunto).toMatch(/^(O avaliador recusou a avaliação de |Avaliador recusou: )Casa recusa/);
    expect(recusou.assunto.length, `"${recusou.assunto}" cabe em 70 caracteres`).toBeLessThanOrEqual(70);
    expect(recusou.corpo).toContain(`Olá Dora, o avaliador credenciado que você escolheu recusou o pedido de avaliação de ${TITULO.recusa}. ${ESCOLHA_OUTRO}`);
    expect(recusou.corpo, "na recusa não há proposta para aceitar").not.toMatch(/aceitar|72 horas|respondeu, recusou ou não respondeu/);
    expect(recusou.corpo).toContain("Escolher avaliador");
    expect(recusou.corpo).toContain(`/dashboard/imoveis/${imovel.recusa}/nivel`);
    expect(await avisos(ids.dono, "vistoria_designado_dono", pedido.recusa), "o aviso genérico já não sai na recusa").toHaveLength(0);
    expect(await avisos(ids.dono, "vistoria_recusada_dono", pedido.recusa)).toHaveLength(1);

    // O que o e-mail manda fazer existe na página: a escolha está aberta, com o outro avaliador da cidade.
    const d = await paginaDoDono(browser, "recusa");
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.reload({ waitUntil: "domcontentloaded" });
      const escolha = d.getByTestId("avaliacao-escolha");
      await expect(escolha, `a ${w} px: a escolha está aberta`).toBeVisible({ timeout: 30_000 });
      await expect(escolha.getByRole("button", { name: `Escolher ${contas.avalA2.nome}` })).toBeVisible();
      expect(await semRolagemLateral(d)).toBe(true);
      await escolha.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1765-2-recusa-escolha-aberta-${w}.png` });
    }
    await d.context().close();
  });

  test("3. a proposta chega: o dono lê até quando aceita; a visita marcada e depois trocada diz 'nova data' e a anterior", async ({ browser }) => {
    const a = await entrar(browser, contas.avalA1.email, senha);
    await largura(a, 390);
    await a.goto(`${ROTA_AVALIADOR}/${pedido.proposta}`, { waitUntil: "domcontentloaded" });
    const tela = a.getByTestId("pedido-avaliador");
    await tela.getByRole("button", { name: "Aceitar pedido" }).click({ timeout: 30_000 });
    await tela.getByLabel("Seu valor (R$)").fill("320");
    await tela.getByLabel(/Prazo do laudo \(dias úteis/).fill("3");
    await tela.getByRole("button", { name: "Enviar proposta" }).click();
    await expect.poll(async () => (await linha(pedido.proposta)).proposta_em, { timeout: 20_000 }).not.toBeNull();
    await a.context().close();

    // (1) O aviso da proposta: há proposta, de quem, e até quando o dono aceita — a data é a da proposta mais 72 horas.
    const [chegou] = await umEmail(ids.dono, "vistoria_designado_dono", TITULO.proposta);
    expect(chegou.assunto).toMatch(/^Proposta de avaliação recebida: Casa proposta/);
    const ate = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(Date.parse((await linha(pedido.proposta)).proposta_em as string) + 72 * HORA));
    // E1188 (asserção alterada, ORDEM-DUET-852): o e-mail diz o valor e o prazo do laudo que o avaliador acabou de propor
    // pela tela (R$ 320 e 3 dias úteis) — antes dizia só "enviou a proposta de valor e prazo".
    expect(chegou.corpo).toContain(`Olá Dora, ${contas.avalA1.nome} enviou a proposta para a avaliação de ${TITULO.proposta}: R$ 320,00 · laudo em até 3 dias úteis depois da visita. Aceite em até 72 horas depois da proposta, até ${ate} `);
    expect(chegou.corpo).toMatch(/até \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} \(horário de Brasília\); passado o prazo, você escolhe outro avaliador\./);
    // E1192: o e-mail que cita um prazo em dias úteis explica-o uma vez, com a nota das telas.
    expect(chegou.corpo.split(NOTA_DIAS_UTEIS).length - 1, "a nota dos dias úteis, uma vez").toBe(1);
    expect(chegou.corpo).not.toMatch(/recusou|não respondeu/);
    expect(await emails(ids.dono, "vistoria_recusada_dono", TITULO.proposta)).toHaveLength(0);
    expect(await emails(ids.dono, "vistoria_sem_resposta_dono", TITULO.proposta)).toHaveLength(0);

    // O dono aceita (gravado na massa: o aceite pela tela é da t1754) e marca a visita pela tela.
    const aceite = await adm().from("vistoria_pedidos").update({ proposta_aceita_em: new Date().toISOString() }).eq("id", pedido.proposta);
    if (aceite.error) throw aceite.error;
    const d = await paginaDoDono(browser, "proposta");
    await largura(d, 1280);
    // O campo é o do site (data em texto + hora); colar "AAAA-MM-DDTHH:MM" preenche os dois. Hora de Brasília.
    const primeira = `${diaDeBrasilia(3)}T10:00`;
    const segunda = `${diaDeBrasilia(4)}T14:30`;
    const agendar = d.getByTestId("dono-agendar");
    await expect(agendar.getByRole("button", { name: "Propor data" })).toBeVisible({ timeout: 30_000 });
    await agendar.getByRole("textbox", { name: "Data", exact: true }).fill(primeira);
    await agendar.getByRole("button", { name: "Propor data" }).click();
    await expect.poll(async () => (await linha(pedido.proposta)).agendado_para, { timeout: 20_000 }).toBe(`${primeira}:00+00:00`.replace("T10:00", "T13:00"));
    const antes = quando((await linha(pedido.proposta)).agendado_para as string);

    // A primeira marcação sai como sempre: nada de "nova data".
    for (const conta of [ids.dono, ids.avalA1]) {
      const [marcada] = await umEmail(conta, "vistoria_agendada", TITULO.proposta);
      expect(marcada.assunto).toMatch(/^Visita de avaliação: Casa proposta/);
      // E1188 (asserção alterada, ORDEM-DUET-852): com a visita marcada, o e-mail diz também a data do laudo.
      const laudo = laudoAte((await linha(pedido.proposta)).agendado_para as string, 3);
      expect(marcada.corpo).toContain(`a visita de avaliação de ${TITULO.proposta} está agendada para ${antes} (horário de Brasília). Laudo até ${laudo} (3 dias úteis depois da visita). ${REGRA} ${NOTA_DIAS_UTEIS}`);
      expect(marcada.corpo).not.toContain("nova data");
    }

    // O dono troca a data (uma vez, com mais de 24 horas de aviso).
    await d.reload({ waitUntil: "domcontentloaded" });
    const reagendar = d.getByTestId("dono-agendar");
    await expect(reagendar.getByRole("button", { name: "Reagendar" })).toBeVisible({ timeout: 30_000 });
    await reagendar.getByRole("textbox", { name: "Data", exact: true }).fill(segunda);
    await reagendar.getByRole("button", { name: "Reagendar" }).click();
    await expect.poll(async () => (await linha(pedido.proposta)).agendado_para, { timeout: 20_000 }).toBe(`${segunda}:00+00:00`.replace("T14:30", "T17:30"));
    await d.context().close();
    const nova = quando((await linha(pedido.proposta)).agendado_para as string);

    // (6) O 2º e-mail diz que a data mudou e qual era — ao dono e ao avaliador.
    for (const [quem, conta] of [["o dono", ids.dono], ["o avaliador", ids.avalA1]] as const) {
      const [, trocada] = await umEmail(conta, "vistoria_agendada", TITULO.proposta, 2);
      expect(trocada.assunto, quem).toMatch(/^Nova data da visita: Casa proposta/);
      expect(trocada.assunto.length, `"${trocada.assunto}" cabe em 70 caracteres`).toBeLessThanOrEqual(70);
      // E1188 (asserção alterada, ORDEM-DUET-852): o reagendamento traz a nova data do laudo.
      const novoLaudo = laudoAte((await linha(pedido.proposta)).agendado_para as string, 3);
      expect(trocada.corpo, quem).toContain(`a visita de avaliação de ${TITULO.proposta} tem nova data: ${nova}; antes: ${antes} (horário de Brasília). Laudo até ${novoLaudo} (3 dias úteis depois da visita). ${REGRA} ${NOTA_DIAS_UTEIS}`);
      // (O bloco de dados do e-mail — "Nova data" e "Data anterior" — não fica na caixa de teste, que guarda só o texto;
      // está na trava de unidade.)
      expect(trocada.corpo, quem).not.toContain("está agendada para");
    }
  });

  test("4. a equipe abre uma verificação: o dono lê o passo dele — escolher o avaliador", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const ad = await ctx.newPage();
    await ad.goto("/admin/avaliadores", { waitUntil: "domcontentloaded" });
    await ctx.addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(ad.url()).origin }]);
    const f = ad.getByTestId("verificacao-form");
    await f.getByLabel("Imóvel (id)").fill(imovel.verificacao);
    await f.locator('select[name="motivo"]').selectOption("denuncia_procedente");
    await f.getByLabel("Descrição do motivo").fill("Denúncia procedente: imóvel diferente das fotos (laboratório, t1765).");
    await f.getByRole("button", { name: "Abrir verificação" }).click();
    const aberto = async () => (await adm().from("vistoria_pedidos").select("id, aguardando_avaliador").eq("property_id", imovel.verificacao).eq("tipo", "verificacao").maybeSingle()).data;
    await expect.poll(async () => (await aberto())?.id ?? null, { timeout: 20_000 }).not.toBeNull();
    await ctx.close();
    expect((await aberto())!.aguardando_avaliador, "na cidade A há avaliador para o dono escolher").toBe(false);

    const [verificacao] = await umEmail(ids.dono, "vistoria_verificacao", TITULO.verificacao);
    expect(verificacao.corpo).toContain(`Olá Dora, a Viva abriu uma verificação do estado de ${TITULO.verificacao}, com o motivo descrito na página da avaliação. O próximo passo é seu: escolha o avaliador credenciado na página da avaliação.`);
    expect(verificacao.corpo, "ninguém é designado: o e-mail não promete que um avaliador vai combinar").not.toContain("vai combinar a visita");
    // O passo que o e-mail diz existe na página: a escolha está aberta.
    const d = await paginaDoDono(browser, "verificacao");
    await largura(d, 1280);
    await expect(d.getByTestId("avaliacao-escolha")).toBeVisible({ timeout: 30_000 });
    await d.context().close();
  });

  test("5. na cidade sem avaliador, a página do dono diz o mesmo que o e-mail da expiração", async ({ browser }) => {
    test.skip(!existsSync(".next/BUILD_ID"), "Depende do caso 1 (a rotina).");
    expect((await linha(pedido.expira)).aguardando_avaliador, "o caso 1 deixou o pedido a aguardar avaliador").toBe(true);
    const d = await paginaDoDono(browser, "expira");
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.reload({ waitUntil: "domcontentloaded" });
      const situacao = d.getByTestId("avaliacao-situacao");
      await expect(situacao, `a ${w} px`).toContainText(A_EQUIPE_FOI_AVISADA, { timeout: 30_000 });
      await expect(situacao, `a ${w} px: sem a promessa do aviso`).not.toContainText("avisa quando houver");
      await expect(d.getByRole("button", { name: /^Escolher / }), "não há ninguém para escolher").toHaveCount(0);
      expect(await semRolagemLateral(d)).toBe(true);
      await situacao.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1765-5-sem-avaliador-${w}.png` });
    }
    await d.context().close();
  });
});
