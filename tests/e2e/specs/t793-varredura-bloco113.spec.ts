import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS, escutarErros } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T793 — VARREDURA DA PÁGINA INTEIRA, BLOCO 113 (Pista C, 31/10), 2ª volta do ciclo (última varredura no bloco 98, t764), com o
  console (régua da t249) no relatório. O protocolo do bloco 21 (t385): seis classes (imagem
  pelo carregamento real, elemento fixo sobre conteúdo, cartão sem foto, estouro horizontal, texto cortado, grade),
  página toda rolada, 390 e 1280 px, HTTP abaixo de 400. Rodízio pelo registro de cobertura: as últimas telas fora do
  ciclo (blocos 72–97) que têm conteúdo próprio —
   - morador: a concordância com a visita de avaliação (/dashboard/avaliacao-imovel/<pedido>);
   - avaliadora credenciada: o checklist da avaliação (/dashboard/parceiro/avaliacao/<pedido>);
   - visitante: a página pública da avaliadora (/avaliadores/<número>);
   - conta nova sem intenção: a escolha de intenção (/auth/intencao).
  Semeia como a t606 (dona, morador e avaliadora novos; a avaliadora parceira, publicada e credenciada em Uberlândia;
  um imóvel por pedido; o pedido "designado" com o morador e o "agendado" para a avaliadora) e apaga tudo no fim. A
  chave VISTORIA_ATIVA liga só no navegador do teste, pelo cookie de laboratório (vn_lab_vistoria).
  Ficam de fora, por desenho: /avaliadores, /cidades, /pedidos e /dashboard/assinatura (redirecionam), /qa/entrar (404
  sem a chave da QA; a t596 cobre num 2º servidor), /excluir-conta/confirmar e /conferir/<código> (pedem token ou
  documento emitido). Defeito novo entra como test.fail ligado a um item (L-84 / D-V11 são os próximos livres).
*/
type Conta = "MORADOR" | "AVALIADORA" | "VISITANTE" | "NOVA";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: () => string;
}

const sufixo = novoSufixo();
const senha = novaSenha();
const dona = { email: `dona.t793.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const morador = { email: `mor.t793.${sufixo}@lab.vivanomads.test`, nome: "Mateus Morador", role: "tenant" as const };
const avaliadora = { email: `ava.t793.${sufixo}@lab.vivanomads.test`, nome: "Alice Avaliadora", role: "tenant" as const };
const nova = { email: `nova.t793.${sufixo}@lab.vivanomads.test`, nome: "Nina Nova", role: "tenant" as const };
const CONTAS: Record<Exclude<Conta, "VISITANTE">, { email: string }> = { MORADOR: morador, AVALIADORA: avaliadora, NOVA: nova };
/** Perto do imóvel do laboratório (o checklist pede a localização para começar a visita, como no t344). */
const PERTO = { latitude: -18.9178, longitude: -48.2772 };
const ids: { dona?: string; morador?: string; avaliadora?: string; nova?: string; parceiro?: string; cred?: string; numero?: string; imovelMorador?: string; imovelAvaliadora?: string; pedidoMorador?: string; pedidoAvaliadora?: string } = {};

const TELAS: Tela[] = [
  { conta: "MORADOR", papel: "morador", nome: "Concordância com a visita de avaliação", rota: () => `/dashboard/avaliacao-imovel/${ids.pedidoMorador}` },
  { conta: "AVALIADORA", papel: "avaliadora", nome: "Checklist da avaliação", rota: () => `/dashboard/parceiro/avaliacao/${ids.pedidoAvaliadora}` },
  { conta: "VISITANTE", papel: "visitante", nome: "Página pública da avaliadora", rota: () => `/avaliadores/${ids.numero}` },
  { conta: "NOVA", papel: "conta nova", nome: "Escolha de intenção", rota: () => "/auth/intencao" },
];

/** Achados já registrados como defeito de produto (L-*) ou que são o desenho pedido: ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // Desenho do E248 (#1536): o "›" sólido da fileira que rola senta sobre o item da borda (t662).
  { rota: /^\/dashboard(\/|\?|$)/, classe: "fixo", achado: /coberto por button "Ver mais itens"$/, l: "E248-desenho" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const SAIDA = "tests/laboratorio/saida/varredura-bloco113";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

async function abrir(browser: Browser, t: Tela, largura: number, altura: number): Promise<Page> {
  if (t.conta === "VISITANTE") {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: altura } });
    return ctx.newPage();
  }
  const page = await entrar(browser, CONTAS[t.conta].email, senha);
  await page.setViewportSize({ width: largura, height: altura });
  return page;
}

test.describe("T793 — varredura da página inteira, bloco 113 (2ª volta, avaliação pelos dois lados, avaliadora pública, escolha de intenção) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  // Um worker só: os pedidos semeados valem para as telas do bloco.
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    ids.dona = await criarConta(dona, senha);
    ids.morador = await criarConta(morador, senha);
    ids.avaliadora = await criarConta(avaliadora, senha);
    ids.nova = await criarConta(nova, senha);
    // Com intenção gravada o login cai no painel; a da conta nova é apagada no teste, antes de abrir a tela.
    for (const id of [ids.dona, ids.morador, ids.avaliadora, ids.nova]) await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", id);
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliadora, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: avaliadora.nome, slug: `aval-t793-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"], status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parceiro = parc.id as string;
    const { data: numero } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    const { data: cr, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parceiro, cidade: "Uberlândia", numero_credenciado: numero as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t793", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id, numero_credenciado")
      .single();
    if (eC) throw eC;
    ids.cred = cr.id as string;
    ids.numero = cr.numero_credenciado as string;
    ids.imovelMorador = await criarImovelPronto(ids.dona, `[Varredura] Avaliação com morador t793 ${sufixo}`, { ativo: true });
    ids.imovelAvaliadora = await criarImovelPronto(ids.dona, `[Varredura] Avaliação agendada t793 ${sufixo}`, { ativo: true });
    const agora = Date.now();
    const { data: pm, error: eM } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovelMorador, owner_id: ids.dona, cidade: "Uberlândia", porte: "q1_2", valor_tabela: 350, status: "designado", avaliador_id: ids.cred, designado_em: new Date(agora).toISOString(), agendado_para: new Date(agora + 2 * 86_400_000).toISOString(), morador_id: ids.morador, ocupado: true })
      .select("id")
      .single();
    if (eM) throw eM;
    ids.pedidoMorador = pm.id as string;
    const { data: pa, error: eA } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovelAvaliadora, owner_id: ids.dona, cidade: "Uberlândia", porte: "q1_2", valor_tabela: 350, status: "agendado", avaliador_id: ids.cred, designado_em: new Date(agora - 86_400_000).toISOString(), agendado_para: new Date(agora - 2 * 3_600_000).toISOString() })
      .select("id")
      .single();
    if (eA) throw eA;
    ids.pedidoAvaliadora = pa.id as string;
    await adm().from("vistoria_designacoes").insert({ pedido_id: ids.pedidoAvaliadora, avaliador_id: ids.cred, resposta: "aceita", respondido_em: new Date(agora - 86_400_000).toISOString() });
  });
  test.afterAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    const imoveis = [ids.imovelMorador, ids.imovelAvaliadora].filter((x): x is string => !!x);
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    // Sem sobra para o próximo spec (o rodízio da cidade leria esta avaliadora como a primeira da fila).
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.avaliadora, ids.morador, ids.dona, ids.nova]);
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      const relatorio: Record<string, Record<string, string[]>> = {};
      mkdirSync(SAIDA, { recursive: true });
      for (const tam of TAMANHOS) {
        const rota = t.rota();
        const page = await abrir(browser, t, tam.width, tam.height);
        // A chave da avaliação liga só neste navegador (cookie de laboratório); a avaliadora também dá a localização.
        await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: test.info().project.use.baseURL ?? new URL(page.url()).origin }]);
        if (t.conta === "AVALIADORA") {
          await page.context().grantPermissions(["geolocation"]);
          await page.context().setGeolocation(PERTO);
        }
        if (t.conta === "NOVA") await adm().from("profiles").update({ intencao: null }).eq("id", ids.nova!);
        try {
          const respostas = escutarImagens(page);
          // Console e erro de página (critério d da t249, com as exceções de terceiros de lá) também entram no relatório.
          const erros = escutarErros(page);
          const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
          const achados = await varrerPagina(page, respostas);
          const rotulo = rota.replace(/[0-9a-f-]{36}/g, ":id");
          for (const classe of Object.keys(CLASSES) as Classe[]) {
            await test.step(`${classe} @${tam.nome}`, async () => {
              for (const a of achados[classe]) console.log(`VARREDURA|${classe}|${tam.nome}|${t.papel}|${rotulo}|${a}`);
              for (const a of achados[classe]) {
                const c = conhecido(rotulo, a, classe);
                if (c) test.info().annotations.push({ type: c.l, description: `${rotulo} @${tam.nome} (${classe}): ${a}` });
              }
              const novos = achados[classe].filter((a) => !conhecido(rotulo, a, classe));
              expect.soft(novos, `${t.papel} — ${t.nome} @${tam.nome} — ${classe}: ${CLASSES[classe]}`).toEqual([]);
            });
          }
          const consoleErros = erros.lista();
          await test.step(`console @${tam.nome}`, async () => {
            for (const a of consoleErros) console.log(`VARREDURA|console|${tam.nome}|${t.papel}|${rotulo}|${a}`);
            expect.soft(consoleErros, `${t.papel} — ${t.nome} @${tam.nome} — console: erro de console ou de página`).toEqual([]);
          });
          await page.screenshot({ path: `${SAIDA}/${slug(`${t.papel}-${t.nome}`)}-${tam.width}.png`, fullPage: true }).catch(() => {});
          relatorio[tam.nome] = { ...achados, console: consoleErros };
        } finally {
          await page.context().close();
        }
      }
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
