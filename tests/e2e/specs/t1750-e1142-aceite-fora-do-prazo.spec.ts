import { test, expect, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { devolverAVezDaRotinaDaVistoria, pegarAVezDaRotinaDaVistoria } from "../fixtures/vez-da-rotina-da-vistoria";

/*
  T1750 — E1142 @E1142 (ORDEM-DUET-619, linha Parceiros, classe B): o dono conseguia aceitar a proposta do avaliador
  depois de o prazo de 72 horas vencer. `aceitarProposta` não conferia o prazo, e a expiração só corre na rotina (de hora
  em hora): até ela correr, o botão "Aceitar valor e prazo" gravava o aceite de uma proposta vencida.
  Só contas de teste; cidade própria do spec.
   1. Proposta enviada há 73 horas, antes de a rotina correr.
      (E1147, ORDENS-DUET 629 e 678) Quem abre a página nessa janela lê que o prazo terminou (a frase aprovada), sem o
      botão "Aceitar valor e prazo"; "Escolher outro avaliador" continua lá e abre a confirmação.
      (E1142) Quem tinha a página aberta desde antes do fim do prazo ainda vê o botão: o clique é recusado, com o aviso
      junto do botão; nada é gravado (o pedido continua "designado", sem aceite) e o avaliador não recebe o aviso de
      proposta aceita. Print a 390 e a 1280 px.
   2. (ORDEM-DUET-620) O avaliador dessa proposta vencida lê, na tela do pedido e na lista, que o prazo do proprietário
      terminou — não mais "O proprietário tem até…" com uma data que já passou, nem "Falta o proprietário aceitar". A
      proposta dentro do prazo continua com o texto de sempre. Print a 390 e a 1280 px.
   3. Proposta enviada há 71 horas (dentro do prazo): o aceite continua a valer, como antes.
   4. Na proposta vencida, "Escolher outro avaliador" continua a funcionar: é por onde o pedido volta já para o dono
      escolher de novo, sem esperar a rotina. (E1147) A tela abre a escolha, com o outro avaliador da cidade.
   5. (ORDENS-DUET 621 e 622) A rotina, num 2º servidor do mesmo build (porta 3150, com um CRON_SECRET só dele,
      padrão do t2131): a proposta vencida volta ao dono; a designação fica "expirada" (antes ficava "aceita"), com o
      instante em que o prazo acabou; o avaliador recebe o aviso e o e-mail da expiração; e a lista dele chama-lhe
      "Proposta expirada sem o aceite do proprietário", não "Sem resposta em 24 horas". Fica por último: a rotina corre
      sobre o banco inteiro.
  Laboratório; não é prova ao vivo no site.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Sacramento";
const PORTA = 3150;
const SEGREDO = `lab-t1750-${Math.random().toString(36).slice(2)}`;
const ROTULO_EXPIRADA = "Proposta expirada sem o aceite do proprietário";
let servidor: ChildProcess | null = null;
const AVISO = "O prazo de 72 horas para aceitar esta proposta terminou. O pedido volta para você escolher de novo."; // texto aprovado na ORDEM-DUET-623
const HORA = 3_600_000;
/** "25/11/2026 11:00 (horário de Brasília)", como a tela escreve. */
function dataHoraDeBrasilia(iso: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute} (horário de Brasília)`;
}
const fimDoPrazo = (propostaEm: string) => dataHoraDeBrasilia(new Date(Date.parse(propostaEm) + 72 * HORA).toISOString());
const textoVencido = (propostaEm: string) => `O prazo do proprietário para aceitar a sua proposta terminou em ${fimDoPrazo(propostaEm)}. Ela não pode mais ser aceita, e o pedido volta para ele escolher de novo.`;
const textoNoPrazo = (propostaEm: string) => `O proprietário tem até ${fimDoPrazo(propostaEm)} para aceitar: 72 horas depois da proposta. Sem o aceite, o pedido volta para ele escolher de novo.`;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1750.${sufixo}@lab.vivanomads.test`, nome: "Dalva Prazo", role: "owner" as const };
const avaliador = { email: `aval.t1750.${sufixo}@lab.vivanomads.test`, nome: "Abel Avaliador", role: "tenant" as const };
// E1147: o segundo avaliador da cidade — é ele que a escolha mostra quando o dono descarta a proposta vencida (caso 4).
const reserva = { email: `reserva.t1750.${sufixo}@lab.vivanomads.test`, nome: "Rita Reserva", role: "tenant" as const };
const ids: Record<string, string> = {};

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}

/** O pedido com o avaliador escolhido pelo dono e a proposta dele (R$ 380,00 · laudo em 5 dias) enviada há `horas` horas. */
async function pedidoComProposta(imovel: string, horas: number): Promise<string> {
  const proposta = new Date(Date.now() - horas * HORA).toISOString();
  const escolha = new Date(Date.now() - (horas + 2) * HORA).toISOString();
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "designado", teste: true, avaliador_id: ids.cred, designado_em: escolha, escolhido_em: escolha, valor_proposto: 380, prazo_proposto_dias: 5, proposta_em: proposta })
    .select("id")
    .single();
  if (error) throw error;
  const d = await adm().from("vistoria_designacoes").insert({ pedido_id: data.id, avaliador_id: ids.cred, designado_em: escolha, resposta: "aceita", respondido_em: proposta });
  if (d.error) throw d.error;
  return data.id as string;
}

const linha = async (pedido: string) => (await adm().from("vistoria_pedidos").select("status, avaliador_id, valor_proposto, proposta_em, proposta_aceita_em").eq("id", pedido).single()).data!;
// E1153: o aviso do aceite ao avaliador passou a ser o evento próprio (antes saía como "visita agendada").
const avisosDeAceite = async (pedido: string) => {
  const { data, error } = await adm().from("avisos").select("id").eq("usuario_id", ids.avaliador).in("evento", ["vistoria_proposta_aceita", "vistoria_agendada"]).eq("ref_id", pedido);
  if (error) throw error;
  return (data ?? []).length;
};

test.describe("T1750 — E1142: o dono não aceita a proposta do avaliador fora do prazo de 72 horas @E1142", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    // A rotina corre sobre o banco inteiro: esta spec só monta a massa quando nenhuma outra spec de rotina está a meio.
    await pegarAVezDaRotinaDaVistoria("t1750");
    for (const [k, c] of [["dono", dono], ["avaliador", avaliador], ["reserva", reserva]] as const) {
      ids[k] = await criarConta(c, senha);
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids[k]);
      if (t.error) throw t.error;
    }
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: avaliador.nome, slug: `aval-t1750-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: n as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1750", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;
    const { data: parcR, error: ePR } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.reserva, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: reserva.nome, slug: `reserva-t1750-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (ePR) throw ePR;
    ids.parcReserva = parcR.id as string;
    const { data: nR } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: credR, error: eCR } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parcReserva, cidade: CIDADE, numero_credenciado: nR as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1750-reserva", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eCR) throw eCR;
    ids.credReserva = credR.id as string;
    for (const u of [ids.dono, ids.avaliador, ids.reserva]) {
      const p = await adm().from("vistoria_piloto").insert({ user_id: u, nota: "T1750 (laboratório)" });
      if (p.error) throw p.error;
    }
    ids.imovelVencida = await criarImovelPronto(ids.dono, `Casa vencida t1750 ${sufixo}`, { ativo: true });
    ids.imovelNoPrazo = await criarImovelPronto(ids.dono, `Casa no prazo t1750 ${sufixo}`, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).in("id", [ids.imovelVencida, ids.imovelNoPrazo]);
    if (cid.error) throw cid.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: porte === "q1_2" ? 350 : 300 })));
    if (eT) throw eT;
    ids.pedidoVencida = await pedidoComProposta(ids.imovelVencida, 73);
    ids.pedidoNoPrazo = await pedidoComProposta(ids.imovelNoPrazo, 71);
    ids.imovelRotina = await criarImovelPronto(ids.dono, `Casa rotina t1750 ${sufixo}`, { ativo: true });
    const cidR = await adm().from("properties").update({ city: CIDADE }).eq("id", ids.imovelRotina);
    if (cidR.error) throw cidR.error;
    ids.pedidoRotina = await pedidoComProposta(ids.imovelRotina, 75);
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const imoveis = [ids.imovelVencida, ids.imovelNoPrazo, ids.imovelRotina].filter(Boolean);
    const pedidos = [ids.pedidoVencida, ids.pedidoNoPrazo, ids.pedidoRotina].filter(Boolean);
    const contas = [ids.dono, ids.avaliador, ids.reserva].filter(Boolean);
    if (contas.length) await adm().from("emails_teste").delete().in("usuario_id", contas);
    if (pedidos.length) {
      await adm().from("avisos").delete().in("ref_id", pedidos);
      await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
      await adm().from("vistoria_designacoes").delete().in("pedido_id", pedidos);
    }
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    if (contas.length) await adm().from("vistoria_piloto").delete().in("user_id", contas);
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.credReserva) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.credReserva);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.credReserva);
    }
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (ids.parcReserva) await adm().from("parceiros").delete().eq("id", ids.parcReserva);
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    await apagarContas(contas);
    devolverAVezDaRotinaDaVistoria();
  });

  test("1. proposta de 73 horas: o bloco diz que o prazo terminou, sem o botão de aceitar (E1147); o aceite de quem tinha a página aberta é recusado junto do botão; nada é gravado nem avisado", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    const vencidaEm = (await linha(ids.pedidoVencida)).proposta_em as string;
    const mudarProposta = async (iso: string) => {
      const r = await adm().from("vistoria_pedidos").update({ proposta_em: iso }).eq("id", ids.pedidoVencida);
      if (r.error) throw r.error;
    };

    // E1147 — quem abre a página na janela (72 h passadas, a rotina ainda não correu).
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto(`/dashboard/imoveis/${ids.imovelVencida}/nivel`, { waitUntil: "domcontentloaded" });
      const proposta = d.getByTestId("avaliacao-proposta");
      await expect(proposta).toBeVisible({ timeout: 30_000 });
      await expect(proposta).toContainText("Proposta do avaliador: R$ 380,00 · laudo em 5 dias");
      // O prazo: a frase aprovada (a mesma da recusa do aceite), e não mais o convite a aceitar.
      const prazo = proposta.getByTestId("avaliacao-proposta-prazo");
      await expect(prazo, `a ${w} px`).toHaveText(AVISO);
      await expect(prazo).toHaveAttribute("data-terminado", "1");
      await expect(proposta).not.toContainText("Aceite em até");
      // O botão de aceitar saiu.
      await expect(proposta.getByTestId("aceitar-proposta"), `a ${w} px: sem o formulário do aceite`).toHaveCount(0);
      await expect(d.getByRole("button", { name: "Aceitar valor e prazo" })).toHaveCount(0);
      // "Escolher outro avaliador" fica e FUNCIONA: o clique abre a confirmação (o que se perde, e quem sobra).
      const trocar = proposta.getByTestId("trocar-avaliador");
      await expect(trocar).toBeVisible();
      await expect(trocar).toBeEnabled();
      expect(await d.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await proposta.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1750-1-prazo-terminado-${w}.png` });
      // O clique só conta depois de a página ganhar vida: tenta até a confirmação abrir.
      const conf = proposta.getByTestId("troca-confirmacao");
      await expect(async () => {
        if (!(await conf.isVisible())) await trocar.click();
        await expect(conf).toBeVisible({ timeout: 2_000 });
      }).toPass({ timeout: 30_000 });
      await expect(conf.getByTestId("troca-titulo")).toHaveText("Escolher outro avaliador?");
      await expect(conf.getByTestId("troca-depois")).toHaveAttribute("data-sem-outro", "0"); // há outro avaliador na cidade
      await expect(conf.getByRole("button", { name: "Descartar e escolher outro" })).toBeEnabled();
      await conf.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1750-1-prazo-terminado-troca-${w}.png` });
      // "Manter esta proposta" fecha; nada mudou (o descarte de verdade é o caso 4).
      await conf.getByRole("button", { name: "Manter esta proposta" }).click();
      await expect(conf).toHaveCount(0);
      await expect(proposta.getByTestId("aceitar-proposta")).toHaveCount(0);
      const l = await linha(ids.pedidoVencida);
      expect(l.status).toBe("designado");
      expect(l.avaliador_id).toBe(ids.cred);
      expect(l.proposta_aceita_em).toBeNull();
    }

    // E1142 — quem tinha a página aberta desde antes do fim do prazo ainda vê o botão; o prazo acaba com a página
    // aberta e o clique é recusado no servidor.
    for (const w of LARGURAS) {
      await largura(d, w);
      await mudarProposta(new Date(Date.now() - 71 * HORA).toISOString());
      await d.goto(`/dashboard/imoveis/${ids.imovelVencida}/nivel`, { waitUntil: "domcontentloaded" });
      const proposta = d.getByTestId("avaliacao-proposta");
      await expect(proposta).toBeVisible({ timeout: 30_000 });
      await expect(proposta).toContainText("Proposta do avaliador: R$ 380,00 · laudo em 5 dias");
      await expect(proposta.getByTestId("avaliacao-proposta-prazo")).toHaveAttribute("data-terminado", "0");
      const form = proposta.getByTestId("aceitar-proposta");
      const botao = form.getByRole("button", { name: "Aceitar valor e prazo" });
      await expect(botao).toBeVisible();
      await mudarProposta(vencidaEm); // o prazo acabou com a página aberta
      await botao.click();

      // O aviso sai no próprio formulário do botão (junto dele), como alerta.
      const aviso = form.getByTestId("acao-erro");
      await expect(aviso).toHaveText(AVISO, { timeout: 20_000 });
      await expect(aviso).toHaveAttribute("role", "alert");
      await expect(form.getByTestId("acao-ok")).toHaveCount(0);
      // O botão e o aviso são medidos NUMA só leitura. Em dois pedidos separados a página ainda podia mexer-se entre
      // um e outro (a rolagem depois do clique), e a diferença saía errada sem a tela estar errada: sobre o merge
      // bb9abda8 o caso falhou 4 vezes em 12 por isso, com o aviso no lugar certo na captura.
      const medida = await form.evaluate((f) => {
        const b = f.querySelector('button[type="submit"]')!.getBoundingClientRect();
        const a = f.querySelector('[data-testid="acao-erro"]')!.getBoundingClientRect();
        return { fimDoBotao: b.bottom, topoDoAviso: a.top };
      });
      expect(medida.topoDoAviso, "o aviso fica logo abaixo do botão").toBeGreaterThanOrEqual(medida.fimDoBotao - 1);
      expect(medida.topoDoAviso - medida.fimDoBotao, "e encostado a ele").toBeLessThan(40);

      // Nada foi gravado: o pedido continua com o avaliador e a proposta, sem aceite; o avaliador não foi avisado.
      const l = await linha(ids.pedidoVencida);
      expect(l.status).toBe("designado");
      expect(l.proposta_aceita_em, "o aceite fora do prazo não é gravado").toBeNull();
      expect(l.avaliador_id).toBe(ids.cred);
      expect(Number(l.valor_proposto)).toBe(380);
      expect(await avisosDeAceite(ids.pedidoVencida), "o avaliador não recebe 'proposta aceita'").toBe(0);
      await expect(d.getByTestId("avaliacao-proposta-aceita")).toHaveCount(0);
      await expect(botao).toBeEnabled();
      await expect(proposta.getByTestId("trocar-avaliador")).toBeVisible();
      expect(await d.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await d.screenshot({ path: `${SAIDA}/t1750-1-aceite-recusado-${w}.png`, fullPage: true });
    }

    // Recarregada, a tela continua sem aceite (a recusa não era só da tela) — e, pelo E1147, já sem o botão.
    await d.reload({ waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("avaliacao-proposta")).toBeVisible({ timeout: 30_000 });
    await expect(d.getByTestId("avaliacao-proposta-aceita")).toHaveCount(0);
    await expect(d.getByTestId("avaliacao-proposta-prazo")).toHaveText(AVISO);
    await expect(d.getByTestId("aceitar-proposta")).toHaveCount(0);
    expect((await linha(ids.pedidoVencida)).proposta_em, "a hora da proposta ficou como estava").toBe(vencidaEm);

    await d.context().close();
  });

  test("2. o avaliador da proposta vencida lê que o prazo do proprietário terminou, no pedido e na lista", async ({ browser }) => {
    const a = await entrar(browser, avaliador.email, senha);
    const vencida = (await linha(ids.pedidoVencida)).proposta_em as string;
    const noPrazo = (await linha(ids.pedidoNoPrazo)).proposta_em as string;
    for (const w of LARGURAS) {
      await largura(a, w);
      // A tela do pedido.
      await a.goto(`/dashboard/parceiro/avaliacao/${ids.pedidoVencida}`, { waitUntil: "domcontentloaded" });
      const tela = a.getByTestId("pedido-avaliador");
      await expect(tela).toHaveAttribute("data-etapa", "proposta_enviada", { timeout: 30_000 });
      const prazo = tela.getByTestId("pedido-prazo-aceite");
      await expect(prazo).toHaveText(textoVencido(vencida));
      await expect(prazo).toHaveAttribute("data-vencido", "1");
      await expect(tela.getByTestId("pedido-aguarda-dono")).toHaveText(textoVencido(vencida)); // só o aviso: nada de "Falta o proprietário aceitar"
      await expect(tela).not.toContainText("O proprietário tem até");
      await expect(tela).not.toContainText("Falta o proprietário aceitar");
      await expect(tela.getByTestId("pedido-agendar")).toHaveCount(0);
      expect(await a.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await a.screenshot({ path: `${SAIDA}/t1750-2-avaliador-pedido-${w}.png`, fullPage: true });

      // A lista diz o mesmo da vencida, e a que está no prazo fica como era.
      await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const item = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedidoVencida}"]`);
      await expect(item.getByTestId("prazo-aceite")).toHaveText(textoVencido(vencida), { timeout: 30_000 });
      await expect(item.getByTestId("prazo-aceite")).toHaveAttribute("data-vencido", "1");
      await expect(item.getByTestId("aguarda-aceite-proprietario")).toContainText("Proposta enviada: R$ 380,00 em 5 dias."); // E1158 (5): o plural vem do ajudante dias()
      await expect(item.getByTestId("aguarda-aceite-proprietario")).not.toContainText("Falta o proprietário aceitar");
      await expect(item.getByTestId("agendar-visita")).toHaveCount(0);
      const outro = a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedidoNoPrazo}"]`);
      await expect(outro.getByTestId("prazo-aceite")).toHaveText(textoNoPrazo(noPrazo));
      await expect(outro.getByTestId("prazo-aceite")).not.toHaveAttribute("data-vencido", "1");
      await expect(outro.getByTestId("aguarda-aceite-proprietario")).toContainText("Falta o proprietário aceitar para agendar a visita.");
      expect(await a.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await a.screenshot({ path: `${SAIDA}/t1750-2-avaliador-lista-${w}.png`, fullPage: true });
    }
    // A tela do pedido que está no prazo fica como era.
    await a.goto(`/dashboard/parceiro/avaliacao/${ids.pedidoNoPrazo}`, { waitUntil: "domcontentloaded" });
    const tela = a.getByTestId("pedido-avaliador");
    await expect(tela.getByTestId("pedido-prazo-aceite")).toHaveText(textoNoPrazo(noPrazo), { timeout: 30_000 });
    await expect(tela.getByTestId("pedido-aguarda-dono")).toContainText("Falta o proprietário aceitar a sua proposta");
    await a.context().close();
  });

  test("3. proposta de 71 horas (dentro do prazo): o aceite continua a valer", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovelNoPrazo}/nivel`, { waitUntil: "domcontentloaded" });
    const proposta = d.getByTestId("avaliacao-proposta");
    await expect(proposta).toBeVisible({ timeout: 30_000 });
    await proposta.getByTestId("aceitar-proposta").getByRole("button", { name: "Aceitar valor e prazo" }).click();
    await expect.poll(async () => (await linha(ids.pedidoNoPrazo)).proposta_aceita_em, { timeout: 20_000 }).not.toBeNull();
    await expect(d.getByTestId("avaliacao-proposta-aceita")).toHaveText("Combinado com o avaliador: R$ 380,00 · laudo em 5 dias.", { timeout: 20_000 });
    await expect(d.getByTestId("acao-erro")).toHaveCount(0);
    const l = await linha(ids.pedidoNoPrazo);
    expect(l.status).toBe("designado");
    expect(l.avaliador_id).toBe(ids.cred);
    await d.context().close();
  });

  test("4. na proposta vencida, 'Escolher outro avaliador' segue valendo: o pedido volta ao dono", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await largura(d, 390);
    await d.goto(`/dashboard/imoveis/${ids.imovelVencida}/nivel`, { waitUntil: "domcontentloaded" });
    const proposta = d.getByTestId("avaliacao-proposta");
    await expect(proposta).toBeVisible({ timeout: 30_000 });
    await proposta.getByTestId("trocar-avaliador").click();
    await proposta.getByTestId("troca-confirmacao").getByRole("button", { name: "Descartar e escolher outro" }).click();
    await expect.poll(async () => (await linha(ids.pedidoVencida)).status, { timeout: 20_000 }).toBe("pedido");
    const depois = await linha(ids.pedidoVencida);
    expect(depois.avaliador_id).toBeNull();
    expect(depois.proposta_aceita_em).toBeNull();
    // E1147 (a condição da ORDEM-DUET-678): o botão funciona na janela — a tela abre a escolha, com o outro avaliador.
    await expect(d.getByTestId("troca-feita")).toHaveText("Avaliador e proposta descartados. Escolha o novo avaliador na lista abaixo.", { timeout: 20_000 });
    await expect(d.getByTestId("avaliacao-proposta")).toHaveCount(0);
    const escolha = d.getByTestId("avaliacao-escolha");
    await expect(escolha).toBeVisible();
    const cartoes = escolha.getByTestId("avaliacao-sugerido");
    await expect(cartoes).toHaveCount(1);
    await expect(cartoes.first()).toContainText(reserva.nome);
    await expect(escolha).not.toContainText(avaliador.nome);
    for (const w of LARGURAS) {
      await largura(d, w);
      await expect(escolha).toBeVisible();
      await escolha.scrollIntoViewIfNeeded();
      await d.screenshot({ path: `${SAIDA}/t1750-4-escolha-aberta-${w}.png` });
    }
    await d.context().close();
  });

  test("5. a rotina: a designação fica 'expirada' com a hora do fim do prazo, o avaliador é avisado por e-mail e a lista dele diz o que aconteceu", async ({ browser }) => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const designacao = async () =>
      (await adm().from("vistoria_designacoes").select("resposta, respondido_em, proposta_expirada_em").eq("pedido_id", ids.pedidoRotina).eq("avaliador_id", ids.cred).single()).data!;
    const antes = await designacao();
    const propostaEm = (await linha(ids.pedidoRotina)).proposta_em as string;
    expect(antes.resposta).toBe("aceita");
    expect(antes.proposta_expirada_em).toBeNull();

    const log = createWriteStream(`${SAIDA}/t1750-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/vistoria`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
    const rodar = async () => {
      const r = await fetch(`http://localhost:${PORTA}/api/cron/vistoria`, { headers: { authorization: `Bearer ${SEGREDO}` } });
      const corpo = (await r.json().catch(() => ({}))) as { ok?: boolean; expiradas?: number };
      expect(r.status, JSON.stringify(corpo)).toBe(200);
      return corpo;
    };
    const primeira = await rodar();
    expect(primeira.ok).toBe(true);
    expect(primeira.expiradas ?? 0, "a rotina expirou pelo menos esta proposta").toBeGreaterThanOrEqual(1);

    // O pedido voltou ao dono, sem avaliador e sem proposta.
    const p = await linha(ids.pedidoRotina);
    expect(p.status).toBe("pedido");
    expect(p.avaliador_id).toBeNull();
    expect(p.proposta_em).toBeNull();

    // O registo: a designação deixa de dizer "aceita"; guarda o fim do prazo do dono; a hora da proposta dele fica.
    const depois = await designacao();
    expect(depois.resposta, "a designação fica registada como expirada").toBe("expirada");
    expect(Date.parse(depois.proposta_expirada_em as string), "o instante em que as 72 h acabaram").toBe(Date.parse(propostaEm) + 72 * HORA);
    expect(Date.parse(depois.respondido_em as string), "a hora em que o avaliador respondeu não muda").toBe(Date.parse(antes.respondido_em as string));

    // O avaliador é avisado (sino e e-mail); o dono continua a ser avisado. A 2ª rodada não repete nada.
    await rodar();
    const avisos = async (usuario: string, evento: string) => ((await adm().from("avisos").select("url").eq("usuario_id", usuario).eq("evento", evento).eq("ref_id", ids.pedidoRotina)).data ?? []) as { url: string }[];
    await expect.poll(async () => (await avisos(ids.avaliador, "vistoria_proposta_expirada")).length, { timeout: 30_000, message: "um aviso ao avaliador, mesmo com 2 rodadas" }).toBe(1);
    expect((await avisos(ids.avaliador, "vistoria_proposta_expirada"))[0].url).toBe("/dashboard/parceiro/avaliacao");
    // E1144 (asserção alterada, ORDEM-DUET-643): o dono continua avisado, agora pelo aviso próprio da expiração e não
    // pelo genérico "novidade na escolha do avaliador".
    expect((await avisos(ids.dono, "vistoria_proposta_expirada_dono")).length, "o dono continua avisado").toBe(1);
    expect((await avisos(ids.dono, "vistoria_designado_dono")).length, "o genérico já não sai na expiração").toBe(0);
    const emails = async () => ((await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", ids.avaliador).eq("evento", "vistoria_proposta_expirada")).data ?? []) as { assunto: string; corpo: string }[];
    await expect.poll(async () => (await emails()).length, { timeout: 30_000, message: "um e-mail ao avaliador" }).toBe(1);
    const email = (await emails())[0];
    // O assunto leva o imóvel; a régua dos assuntos encurta o título comprido e o envio junta "· Viva Nomads".
    expect(email.assunto).toMatch(/^A sua proposta de avaliação expirou: Casa rotina t/);
    expect(email.assunto).not.toMatch(/vistoria_|VIS-\d/);
    expect(email.corpo).toContain(`o proprietário não aceitou a sua proposta de avaliação de Casa rotina t1750 ${sufixo} no prazo de 72 horas, e ela expirou. O pedido voltou para ele escolher de novo. Você não precisa fazer nada.`);
    expect(`${email.assunto} ${email.corpo}`).not.toMatch(/VIS-\d|\b[0-9a-f]{8}-[0-9a-f]{4}-/);

    // A lista do avaliador: a linha do histórico diz o que aconteceu — e não "Sem resposta em 24 horas".
    const a = await entrar(browser, avaliador.email, senha);
    for (const w of LARGURAS) {
      await largura(a, w);
      await a.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
      const historico = a.getByTestId("avaliacoes-historico");
      const fora = historico.locator('[data-testid="avaliacao-fora"][data-resposta="expirada"]');
      await expect(fora).toHaveCount(1, { timeout: 30_000 });
      // E1148 (asserção alterada, ORDEM-DUET-679): o item passou a dizer de que imóvel é, e o bairro entra junto da
      // cidade ("Centro" é o bairro que a massa do laboratório dá ao imóvel). Antes: "…proprietário · Sacramento".
      await expect(fora.getByTestId("pedido-imovel")).toContainText(`Casa rotina t1750 ${sufixo} · VN-`);
      await expect(fora).toContainText(`${ROTULO_EXPIRADA} · Centro · ${CIDADE}`);
      await expect(historico).not.toContainText("Sem resposta em 24 horas");
      await expect(a.locator(`[data-testid="avaliacao-designada"][data-pedido="${ids.pedidoRotina}"]`)).toHaveCount(0);
      expect(await a.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await a.screenshot({ path: `${SAIDA}/t1750-5-historico-${w}.png`, fullPage: true });
    }
    await a.context().close();
  });
});
