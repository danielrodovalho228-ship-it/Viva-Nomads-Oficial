import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS, cliqueResponde } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T606 — VARREDURA DA PÁGINA INTEIRA, BLOCO 50 (Pista C, 29/10). O protocolo do bloco 21 (t385): seis classes (imagem
  vazia/quebrada, sobreposição de elemento fixo, texto cortado, grade desalinhada…), página toda rolada, carregamento
  real de cada imagem, 390 e 1280 px, HTTP abaixo de 400 e o clique no primário com resposta visível em até 3 s.
  O bloco 50 fecha as duas telas da avaliação que o bloco 49 deixou (cobertura.json): a concordância do morador com a
  visita (/dashboard/avaliacao-imovel/<pedido>) e o checklist do avaliador credenciado (/dashboard/parceiro/avaliacao/
  <pedido>). Tudo semeado aqui e apagado no fim, como no t315 e no t344: dono, morador e avaliadora novos, a avaliadora
  parceira e credenciada em Uberlândia (número do rodízio pelo proximo_numero_avaliador), um imóvel por pedido e os dois
  pedidos de vistoria direto no banco — um "designado" com o morador e a data proposta (imóvel ocupado), outro
  "agendado" para a avaliadora, com a visita de 2 horas atrás. A chave VISTORIA_ATIVA liga só no navegador do teste,
  pelo cookie de laboratório (vn_lab_vistoria). Só no laboratório.
*/
type Conta = "MORADOR" | "AVALIADORA";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: () => string;
  /** false: não clica no primário (ação com efeito fora da tela). */
  clicar?: boolean;
  /** Motivo para pular (dado que o laboratório não tem); null = varre. */
  pular?: () => string | null;
}

const sufixo = novoSufixo();
const senha = novaSenha();
const dona = { email: `dona.t606.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const morador = { email: `mor.t606.${sufixo}@lab.vivanomads.test`, nome: "Mateus Morador", role: "tenant" as const };
const avaliadora = { email: `ava.t606.${sufixo}@lab.vivanomads.test`, nome: "Alice Avaliadora", role: "tenant" as const };
const CONTAS: Record<Conta, { email: string }> = { MORADOR: morador, AVALIADORA: avaliadora };
/** Perto do imóvel do laboratório (o checklist pede a localização para começar a visita, como no t344). */
const PERTO = { latitude: -18.9178, longitude: -48.2772 };
const ids: { dona?: string; morador?: string; avaliadora?: string; parceiro?: string; cred?: string; imovelMorador?: string; imovelAvaliadora?: string; pedidoMorador?: string; pedidoAvaliadora?: string } = {};

const TELAS: Tela[] = [
  { conta: "MORADOR", papel: "morador", nome: "Concordância com a visita de avaliação", rota: () => `/dashboard/avaliacao-imovel/${ids.pedidoMorador}`, pular: () => (ids.pedidoMorador ? null : "não deu para semear o pedido do morador") },
  { conta: "AVALIADORA", papel: "avaliadora", nome: "Checklist da avaliação", rota: () => `/dashboard/parceiro/avaliacao/${ids.pedidoAvaliadora}`, pular: () => (ids.pedidoAvaliadora ? null : "não deu para semear o pedido da avaliadora") },
];

/**
 * Achados do clique já registrados como defeito de produto (L-*): ficam anotados no relatório e não derrubam o teste;
 * qualquer outro achado derruba. Quando a pista dona corrigir, o achado some e a linha sai daqui.
 */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  { rota: /^\/buscar(\?|$)/, achado: /"Aplicar nos filtros" desabilitado sem explicar o motivo/, l: "L-51" },
  { rota: /^\/admin$/, achado: /"Testar" desabilitado sem explicar o motivo/, l: "L-61" },
  // L-63 (Pista A + Daniel): as 7 fotos dos cartões de tipo do #1312 ainda não estão em public/images/imoveis/.
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "imagem", achado: /\/images\/imoveis\/(tipo-(casa|studio|loft|cobertura|casa-condominio|flat)|placeholder-imovel-chacara)\.webp/, l: "L-63" },
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "foto", achado: /área de foto vazia \(aspect-ratio 4 \/ 3\).*"Imagem ilustrativa"/, l: "L-63" },
  { rota: /^\/admin\/documentos\?aba=emitidos$/, classe: "estouro", achado: /além da direita: <label[^>]*> "Tipo/, l: "L-62" },
  // L-70 (bloco 49): o "Enviar resposta" do chamado fica desabilitado até escrever, sem texto que diga isso.
  { rota: /^\/admin\/atendimento\/:id$/, achado: /"Enviar resposta \(e-mail à pessoa\)" desabilitado sem explicar o motivo/, l: "L-70" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const SAIDA = "tests/laboratorio/saida/varredura-bloco50";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const CLIQUE = "clique no botão primário sem resposta visível em 3 s";

test.describe("T606 — varredura da página inteira, bloco 50 (as duas telas da avaliação) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  // Um worker só: os pedidos semeados valem para as duas telas; sem o modo serial, uma falha não pula a outra.
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (!NO_LABORATORIO || info.project.name !== "chromium") return;
    ids.dona = await criarConta(dona, senha);
    ids.morador = await criarConta(morador, senha);
    ids.avaliadora = await criarConta(avaliadora, senha);
    for (const id of [ids.dona, ids.morador, ids.avaliadora]) await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", id);
    // A avaliadora: parceira com cadastro e credenciada em Uberlândia (ativada há muito tempo, como no t315).
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.avaliadora, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: avaliadora.nome, slug: `aval-t606-${sufixo}`, categorias: ["fotografia"], cidades: ["Uberlândia"] })
      .select("id")
      .single();
    if (eP) console.log(`T606|semear parceira: ${eP.message}`);
    ids.parceiro = (parc as { id?: string } | null)?.id;
    if (ids.parceiro) {
      const { data: numero } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
      const { data: cr, error: eC } = await adm()
        .from("avaliadores_credenciamento")
        .insert({ parceiro_id: ids.parceiro, cidade: "Uberlândia", numero_credenciado: numero as string, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t606", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
        .select("id")
        .single();
      if (eC) console.log(`T606|semear credenciamento: ${eC.message}`);
      ids.cred = (cr as { id?: string } | null)?.id;
    }
    // Um imóvel por pedido (um pedido aberto por imóvel).
    ids.imovelMorador = await criarImovelPronto(ids.dona, `[Varredura] Avaliação com morador t606 ${sufixo}`, { ativo: true });
    ids.imovelAvaliadora = await criarImovelPronto(ids.dona, `[Varredura] Avaliação agendada t606 ${sufixo}`, { ativo: true });
    const agora = Date.now();
    if (ids.cred) {
      // Morador: o imóvel ocupado, avaliadora designada e a data proposta para daqui a 2 dias (o "Concordo" aparece).
      const { data: pm, error: eM } = await adm()
        .from("vistoria_pedidos")
        .insert({ property_id: ids.imovelMorador, owner_id: ids.dona, cidade: "Uberlândia", porte: "q1_2", valor_tabela: 350, status: "designado", avaliador_id: ids.cred, designado_em: new Date(agora).toISOString(), agendado_para: new Date(agora + 2 * 86_400_000).toISOString(), morador_id: ids.morador, ocupado: true })
        .select("id")
        .single();
      if (eM) console.log(`T606|semear pedido do morador: ${eM.message}`);
      ids.pedidoMorador = (pm as { id?: string } | null)?.id;
      // Avaliadora: visita agendada para 2 horas atrás e aceita (o checklist abre para preencher).
      const { data: pa, error: eA } = await adm()
        .from("vistoria_pedidos")
        .insert({ property_id: ids.imovelAvaliadora, owner_id: ids.dona, cidade: "Uberlândia", porte: "q1_2", valor_tabela: 350, status: "agendado", avaliador_id: ids.cred, designado_em: new Date(agora - 86_400_000).toISOString(), agendado_para: new Date(agora - 2 * 3_600_000).toISOString() })
        .select("id")
        .single();
      if (eA) console.log(`T606|semear pedido da avaliadora: ${eA.message}`);
      ids.pedidoAvaliadora = (pa as { id?: string } | null)?.id;
      if (ids.pedidoAvaliadora) await adm().from("vistoria_designacoes").insert({ pedido_id: ids.pedidoAvaliadora, avaliador_id: ids.cred, resposta: "aceita", respondido_em: new Date(agora - 86_400_000).toISOString() });
    }
  });
  test.afterAll(async ({}, info) => {
    if (!NO_LABORATORIO || info.project.name !== "chromium") return;
    const imoveis = [ids.imovelMorador, ids.imovelAvaliadora].filter((x): x is string => !!x);
    if (imoveis.length) await adm().from("vistoria_pedidos").delete().in("property_id", imoveis);
    // Sem sobra para o próximo spec (o rodízio da cidade leria esta avaliadora como a primeira da fila).
    if (ids.cred) {
      await adm().from("vistoria_designacoes").delete().eq("avaliador_id", ids.cred);
      await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    }
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.avaliadora, ids.morador, ids.dona]);
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes e o clique no primário, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      const motivo = t.pular?.() ?? null;
      test.skip(!!motivo, motivo ?? "");
      const limpar: (() => Promise<unknown>)[] = [];
      const relatorio: Record<string, Record<string, string[]>> = {};
      try {
        for (const tam of TAMANHOS) {
          const rota = t.rota();
          const page: Page = await entrar(browser, CONTAS[t.conta].email, senha);
          await page.setViewportSize({ width: tam.width, height: tam.height });
          // A chave da avaliação liga só neste navegador (cookie de laboratório); a avaliadora também dá a localização.
          await page.context().addCookies([{ name: "vn_lab_vistoria", value: "1", url: new URL(page.url()).origin }]);
          if (t.conta === "AVALIADORA") {
            await page.context().grantPermissions(["geolocation"]);
            await page.context().setGeolocation(PERTO);
          }
          try {
            const respostas = escutarImagens(page);
            const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
            expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
            expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
            await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
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
            let clique: string[] = [];
            if (t.clicar !== false) {
              await test.step(`clique @${tam.nome}`, async () => {
                const primario = page.locator('main [data-cta="primary"]:visible').first();
                if ((await primario.count()) === 0) {
                  console.log(`VARREDURA|clique|${tam.nome}|${t.papel}|${rotulo}|sem primário visível no main (nada a clicar)`);
                  return;
                }
                await primario.scrollIntoViewIfNeeded().catch(() => {});
                const nome = ((await primario.innerText().catch(() => "")) || (await primario.getAttribute("aria-label")) || "primário").trim().slice(0, 60);
                const href = await primario.evaluate((el) => (el instanceof HTMLAnchorElement ? el.href : null)).catch(() => null);
                if (href) {
                  // Primário que é link: a resposta é a navegação. O cliqueResponde lia a página no meio do
                  // redirecionamento (/para-proprietarios → /dashboard/imoveis/novo → /auth) e travava até o teto de 180 s.
                  const antes = page.url();
                  const textoAntes = await page.locator("main").first().innerText().catch(() => "");
                  await primario.click({ timeout: 5_000, noWaitAfter: true }).catch(() => {});
                  const navegou = await page
                    .waitForURL((u) => u.href !== antes, { timeout: 3_000, waitUntil: "commit" })
                    .then(() => true)
                    .catch(() => false);
                  // Link que troca a tela sem navegar (preventDefault, ex.: "Abrir chamado" da /ajuda abre a aba do
                  // formulário): também é resposta visível.
                  const mudou = navegou || (await page.locator("main").first().innerText().catch(() => textoAntes)) !== textoAntes;
                  clique = mudou ? [] : [`clique em "${nome}" (link) sem navegação nem mudança na tela em 3 s`];
                } else {
                  clique = await cliqueResponde(page, primario, nome);
                }
                for (const a of clique) console.log(`VARREDURA|clique|${tam.nome}|${t.papel}|${rotulo}|${a}`);
                for (const a of clique) {
                  const c = conhecido(rotulo, a);
                  if (c) test.info().annotations.push({ type: c.l, description: `${rotulo} @${tam.nome}: ${a}` });
                }
                const novos = clique.filter((a) => !conhecido(rotulo, a));
                expect.soft(novos, `${t.papel} — ${t.nome} @${tam.nome} — clique: ${CLIQUE}`).toEqual([]);
              });
            }
            relatorio[tam.nome] = { ...achados, clique };
          } finally {
            await page.context().close();
          }
        }
      } finally {
        for (const f of limpar) await f().catch(() => {});
      }
      mkdirSync(SAIDA, { recursive: true });
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
