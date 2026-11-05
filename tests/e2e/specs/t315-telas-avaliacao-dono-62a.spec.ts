import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { conversationId } from "../../../src/lib/messages/conversation-id";

/*
  T315 — Prompt 62-A, Parte 1 (dono e morador; o credenciamento, a página do avaliador, a agenda e o admin voltam depois
  do 62-B3). Laboratório; a chave VISTORIA_ATIVA liga só no navegador do teste, pelo cookie de laboratório. 390 e 1280 px,
  sem rolagem lateral, com print.
   1. Dono: as duas rotas lado a lado, frase fixa, um primário só (QA #1111 item 7); pedir → linha do tempo com o nº,
      "Avaliador designado pela Viva" uma vez só (item 5); nenhum botão de escolher avaliador.
   2. Morador: o cartão na conversa da estadia — "Prefiro outro horário" escreve na caixa; "Concordo" confirma.
      Dono: visita com "horário de Brasília", sem segundos (item 6). Chave desligada: nada para dono nem morador.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = (p: string, nome: string, role: "owner" | "tenant" = "tenant") => ({ email: `${p}.t315.${sufixo}@lab.vivanomads.test`, nome, role });
const dono = conta("dono", "Dina Dona", "owner");
const morador = conta("morador", "Mário Morador");
const avA = conta("ava", "Ana Avaliadora");
const ids: Record<string, string> = {};
let numeroA = "";
let pedidoId = "";

async function semRolagemLateral(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, "sem rolagem lateral").toBeLessThanOrEqual(1);
}
async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
async function comChave(page: Page) {
  await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url() === "about:blank" ? "http://localhost:3123" : page.url()).origin }]);
}
/** Botões e links com o fundo do primário dentro do conteúdo (o "Fale com a Viva" flutuante fica fora do main). */
async function primariosNoMain(page: Page): Promise<number> {
  return page.locator("main").locator("button.bg-forest:visible, a.bg-forest:visible").count();
}

test.describe("T315 — Prompt 62-A, Parte 1: dono e morador", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.morador = await criarConta(morador, senha);
    ids.A = await criarConta(avA, senha);
    for (const [l, uid, nome] of [["A", ids.A, avA.nome]] as const) {
      const { data, error } = await adm()
        .from("parceiros")
        .insert({ user_id: uid, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: nome, slug: `aval-${l.toLowerCase()}-t315-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"] })
        .select("id")
        .single();
      if (error) throw error;
      ids[`parc${l}`] = data.id as string;
    }
    // A já credenciado e ativo, o primeiro do rodízio (nunca designado, ativado há muito tempo).
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    numeroA = n as string;
    const { error: eC } = await adm().from("avaliadores_credenciamento").insert({ parceiro_id: ids.parcA, cidade: "Uberlândia", numero_credenciado: numeroA, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/a", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" });
    if (eC) throw eC;
    // Imóvel publicado, ocupado pelo morador (contrato vigente) e a conversa entre os dois.
    ids.imovel = await criarImovelPronto(ids.dono, `Avaliação t315 ${sufixo}`, { ativo: true });
    const hoje = new Date();
    const dia = (d: number) => new Date(hoje.getTime() + d * 86_400_000).toISOString().slice(0, 10);
    const { data: c, error: eK } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.morador, owner_plan: "free", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 600, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", assinado_proprietario_em: hoje.toISOString(), assinado_inquilino_em: hoje.toISOString() })
      .select("id")
      .single();
    if (eK) throw eK;
    ids.contrato = c.id as string;
    await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio: dia(-10), fim: dia(50), meses: 2, valor: 6000, caucao: 3000, status: "ativo" });
    ids.conversa = conversationId(ids.dono, ids.morador, ids.imovel);
    await gravarMensagem(ids.dono, ids.morador, ids.imovel, "Combinado, qualquer coisa escreva por aqui.", ids.conversa);
    // Tabela da cidade com os 3 portes (o laboratório pode ter linhas de outros specs: esta é a mais recente).
    const { data: precos } = await adm()
      .from("vistoria_precos")
      .insert([
        { cidade: "Uberlândia", porte: "estudio", valor: 280 },
        { cidade: "Uberlândia", porte: "q1_2", valor: 350 },
        { cidade: "Uberlândia", porte: "q3_mais", valor: 420 },
      ])
      .select("id");
    ids.precos = ((precos ?? []) as { id: string }[]).map((x) => x.id).join(",");
  });

  test.afterAll(async () => {
    if (ids.imovel) await adm().from("vistoria_pedidos").delete().eq("property_id", ids.imovel);
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    if (ids.precos) await adm().from("vistoria_precos").delete().in("id", ids.precos.split(","));
    // Sem sobra para o próximo spec (o rodízio da cidade leria um avaliador antigo como o primeiro da fila).
    await adm().from("vistoria_designacoes").delete().in("avaliador_id", ((await adm().from("avaliadores_credenciamento").select("id").in("parceiro_id", [ids.parcA].filter(Boolean))).data ?? []).map((x) => x.id as string));
    await adm().from("avaliadores_credenciamento").delete().in("parceiro_id", [ids.parcA].filter(Boolean));
    await apagarContas([ids.A, ids.morador, ids.dono]);
  });

  test("1. dono: duas rotas lado a lado, frase fixa, um primário; pedir → linha do tempo com o nº, sem repetir a frase", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await comChave(d);
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel#avaliacao`, { waitUntil: "domcontentloaded" });
      const bloco = d.getByTestId("avaliacao-dono");
      await expect(bloco.getByTestId("rota-foto")).toContainText("Foto: grátis, nível na hora", { timeout: 30_000 });
      await expect(bloco.getByTestId("rota-avaliacao")).toContainText("Avaliação: “· vistoriado” por 12 meses");
      await expect(bloco.getByTestId("frase-paga")).toHaveText("Você paga a avaliação, não o resultado.");
      await expect(bloco.getByTestId("avaliacao-valor")).toContainText("350");
      // As duas caixas medidas no mesmo quadro (a página ainda pode estar rolando até #avaliacao).
      const [f, a] = await bloco.evaluate((el) => ["rota-foto", "rota-avaliacao"].map((t) => {
        const r = el.querySelector(`[data-testid="${t}"]`)!.getBoundingClientRect();
        return { y: r.top, height: r.height };
      }));
      if (w === 1280) expect(Math.abs(f!.y - a!.y), "lado a lado a 1280").toBeLessThan(2);
      else expect(a!.y, "uma embaixo da outra a 390").toBeGreaterThan(f!.y + f!.height - 1);
      expect(await primariosNoMain(d), "um primário só na tela (QA #1111 item 7)").toBe(1);
      await expect(d.getByText(/escolh(er|a) o avaliador/i)).toHaveCount(0);
      await bloco.scrollIntoViewIfNeeded();
      await semRolagemLateral(d);
      await d.screenshot({ path: `${SAIDA}/t315-2-dono-pedir-${w}.png` });
    }
    await d.getByTestId("pedir-avaliacao").getByRole("button", { name: "Pedir avaliação do imóvel" }).click();
    await expect.poll(async () => ((await adm().from("vistoria_pedidos").select("id, status").eq("property_id", ids.imovel).maybeSingle()).data?.status as string | undefined) ?? "", { timeout: 20_000 }).toBe("designado");
    pedidoId = ((await adm().from("vistoria_pedidos").select("id").eq("property_id", ids.imovel).single()).data!.id as string);
    for (const w of LARGURAS) {
      await largura(d, w);
      // Sem a âncora: a página já está em …/nivel#avaliacao e o mesmo endereço seria só um salto de âncora, sem recarregar.
      await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
      const bloco = d.getByTestId("avaliacao-dono");
      await expect(bloco.getByTestId("avaliador-designado")).toHaveText(`Avaliador designado pela Viva: nº ${numeroA}`, { timeout: 30_000 });
      await expect(bloco.getByText("Avaliador designado pela Viva")).toHaveCount(1);
      await expect(bloco.getByTestId("etapa-designado")).toHaveAttribute("data-estado", "atual");
      await expect(bloco.getByTestId("etapa-designado")).toHaveText(`Designado nº ${numeroA}`);
      await expect(bloco.getByTestId("etapa-pedido")).toHaveAttribute("data-estado", "feito");
      await expect(bloco.getByTestId("avaliacao-mensagens")).toHaveAttribute("href", "/dashboard/mensagens");
      await bloco.scrollIntoViewIfNeeded();
      await semRolagemLateral(d);
      await d.screenshot({ path: `${SAIDA}/t315-2-dono-designado-${w}.png` });
    }
    await d.context().close();
  });

  test("avaliador (tela do 62-B1): aceita e agenda para daqui a 2 dias às 10:00", async ({ browser }) => {
    const p = await entrar(browser, avA.email, senha);
    await p.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
    // Espera a hidratação: o clique antes dela não chega à ação (o pedido sai de "Para responder" para "Visitas").
    await p.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    const item = p.locator(`[data-testid="avaliacao-designada"][data-pedido="${pedidoId}"]`);
    await item.getByTestId("designacao-aceitar").click();
    await expect(item.getByTestId("agendar-visita")).toBeVisible({ timeout: 20_000 });
    const quando = new Date(Date.now() + 2 * 86_400_000);
    const dia = new Date(quando.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
    await item.getByTestId("agendar-visita").getByLabel("Data e hora da visita").fill(`${dia}T10:00`);
    await item.getByTestId("agendar-visita").getByRole("button", { name: "Agendar" }).click();
    await expect.poll(async () => ((await adm().from("vistoria_pedidos").select("agendado_para").eq("id", pedidoId).single()).data?.agendado_para as string | null) ?? null, { timeout: 20_000 }).not.toBeNull();
    await p.context().close();
  });

  test("2. morador: cartão na conversa (outro horário / concordo); dono vê a hora com o fuso; chave desligada esconde", async ({ browser }) => {
    const { data: ped } = await adm().from("vistoria_pedidos").select("agendado_para").eq("id", pedidoId).single();
    const iso = ped!.agendado_para as string;
    const f = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso));
    const v = (t: string) => f.find((x) => x.type === t)?.value;
    const quando = `${v("day")}/${v("month")}/${v("year")} às ${v("hour")}:${v("minute")}`;

    // Chave desligada (sem o cookie): nada para o morador nem para o dono.
    const semChave = await entrar(browser, morador.email, senha);
    await semChave.goto(`/dashboard/mensagens?conversa=${ids.conversa}`, { waitUntil: "domcontentloaded" });
    await expect(semChave.getByTestId("conversa-nome")).toBeVisible({ timeout: 30_000 });
    await expect(semChave.getByTestId("conversa-avaliacao")).toHaveCount(0);
    // A página não existe sem a chave (notFound; o status vem 200 porque a página é transmitida em partes).
    await semChave.goto(`/dashboard/avaliacao-imovel/${pedidoId}`, { waitUntil: "domcontentloaded" });
    await expect(semChave.getByTestId("concordancia")).toHaveCount(0);
    await expect(semChave.getByText(/não encontrad/i).first()).toBeVisible({ timeout: 20_000 });
    await semChave.context().close();

    const m = await entrar(browser, morador.email, senha);
    await comChave(m);
    for (const w of LARGURAS) {
      await largura(m, w);
      await m.goto(`/dashboard/mensagens?conversa=${ids.conversa}`, { waitUntil: "domcontentloaded" });
      const cartao = m.getByTestId("conversa-avaliacao");
      await expect(cartao.getByTestId("conversa-concordar")).toHaveText(`Concordo com a visita em ${quando}`, { timeout: 30_000 });
      await expect(cartao).toContainText("Horário de Brasília.");
      await semRolagemLateral(m);
      await m.screenshot({ path: `${SAIDA}/t315-4-morador-conversa-${w}.png` });
    }
    await m.getByTestId("conversa-outro-horario").click();
    await expect(m.getByPlaceholder("Escreva uma mensagem...")).toHaveValue(/^Prefiro outro horário para a visita de avaliação do imóvel\./);
    await m.getByTestId("conversa-concordar").click();
    await expect(m.getByTestId("conversa-avaliacao-confirmada")).toHaveText(`Você concordou com a visita em ${quando} (horário de Brasília).`, { timeout: 20_000 });
    await expect.poll(async () => ((await adm().from("vistoria_pedidos").select("status").eq("id", pedidoId).single()).data?.status as string) ?? "").toBe("agendado");
    await m.screenshot({ path: `${SAIDA}/t315-4-morador-concordou-1280.png` });
    await m.context().close();

    const d = await entrar(browser, dono.email, senha);
    await comChave(d);
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel#avaliacao`, { waitUntil: "domcontentloaded" });
      const bloco = d.getByTestId("avaliacao-dono");
      await expect(bloco.getByTestId("avaliacao-visita")).toHaveText(`Visita: ${quando}, horário de Brasília`, { timeout: 30_000 });
      await expect(bloco.getByTestId("etapa-agendado")).toHaveAttribute("data-estado", "atual");
      await expect(bloco.getByTestId("avaliacao-situacao")).toHaveText("Visita confirmada.");
      await expect(bloco.getByTestId("avaliacao-pagamento")).toContainText("Você paga direto ao avaliador, depois da visita. A Viva só registra.");
      await bloco.scrollIntoViewIfNeeded();
      await semRolagemLateral(d);
      await d.screenshot({ path: `${SAIDA}/t315-4-dono-agendado-${w}.png` });
    }
    await d.context().close();
    // Dono sem a chave: o bloco não aparece.
    const d2 = await entrar(browser, dono.email, senha);
    await d2.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await expect(d2.getByTestId("nivel-resumo")).toBeVisible({ timeout: 30_000 });
    await expect(d2.getByTestId("avaliacao-dono")).toHaveCount(0);
    await d2.context().close();
  });

});
