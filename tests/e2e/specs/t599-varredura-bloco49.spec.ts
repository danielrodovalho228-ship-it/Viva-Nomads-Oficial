import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, cliqueResponde, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T599 — VARREDURA DA PÁGINA INTEIRA, BLOCO 49 (Pista C, 29/10). O protocolo do bloco 21 (t385): seis classes (imagem
  vazia/quebrada, sobreposição de elemento fixo, texto cortado, grade desalinhada…), página toda rolada, carregamento
  real de cada imagem, 390 e 1280 px, HTTP abaixo de 400 e o clique no primário com resposta visível em até 3 s.
  O bloco 49 segue a ordem e varre as páginas de DETALHE que nenhuma varredura visitou ainda (cobertura.json):
  a escolha de intenção (/auth/intencao, conta nova sem intenção), a proposta (/dashboard/propostas/<id>, pelo morador
  e pelo dono), o detalhe da visita do dono (/dashboard/visitas/<id>), o chamado no admin (/admin/atendimento/<id>) e a
  estadia vista pelo convidado (/dashboard/estadia/<contrato>/convidado). Os dados saem da massa da varredura (DONO17,
  INQUILINA e o imovel17); o que falta é semeado aqui e apagado no fim. A estadia do convidado usa um contrato próprio
  para 2 ocupantes (o da massa é para 1, e o gatilho estadia_convidados_teto recusa convidado acima do contrato). As duas telas da avaliação
  (/dashboard/avaliacao-imovel/<id> e /dashboard/parceiro/avaliacao/<pedido>) pedem avaliador credenciado e pedido de
  vistoria: ficam para o bloco 50. Só no laboratório.
*/
type Conta = ChaveConta | "ADMIN" | "VISITANTE" | "NOVA" | "CONVIDADO";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: (m: Massa) => string | Promise<string>;
  /** false: não clica no primário (ação com efeito fora da tela). */
  clicar?: boolean;
  /** Motivo para pular (dado que o laboratório não tem); null = varre. */
  pular?: () => string | null;
}

const sufixo = novoSufixo();
const senha = novaSenha();
/** Conta nova sem intenção (a /auth/intencao só aparece para ela) e o convidado da estadia da INQUILINA. */
const nova = { email: `nova.t599.${sufixo}@lab.vivanomads.test`, nome: "Nina Nova", role: "tenant" as const };
const convidado = { email: `conv.t599.${sufixo}@lab.vivanomads.test`, nome: "Caio Convidado", role: "tenant" as const };
const donaEstadia = { email: `dona.t599.${sufixo}@lab.vivanomads.test`, nome: "Dalva Dona", role: "owner" as const };
const moradorEstadia = { email: `mor.t599.${sufixo}@lab.vivanomads.test`, nome: "Mauro Morador", role: "tenant" as const };
const ids: { nova?: string; convidado?: string; dona?: string; morador?: string; imovelEstadia?: string; leadEstadia?: string; contrato?: string; lead?: string; proposta?: string; visita?: string; visitaCriada?: boolean; chamado?: string; convite?: string } = {};
const emDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const TELAS: Tela[] = [
  { conta: "NOVA", papel: "conta nova", nome: "Escolha de intenção", rota: () => "/auth/intencao", clicar: false },
  { conta: "INQUILINA", papel: "morador", nome: "Proposta recebida", rota: () => `/dashboard/propostas/${ids.proposta}`, pular: () => (ids.proposta ? null : "não deu para semear a proposta") },
  { conta: "DONO17", papel: "proprietário", nome: "Proposta enviada", rota: () => `/dashboard/propostas/${ids.proposta}`, pular: () => (ids.proposta ? null : "não deu para semear a proposta") },
  { conta: "DONO17", papel: "proprietário", nome: "Detalhe da visita", rota: () => `/dashboard/visitas/${ids.visita}`, pular: () => (ids.visita ? null : "não deu para semear a visita") },
  { conta: "ADMIN", papel: "admin", nome: "Chamado no atendimento", rota: () => `/admin/atendimento/${ids.chamado}`, pular: () => (ids.chamado ? null : "não deu para semear o chamado") },
  { conta: "CONVIDADO", papel: "convidado", nome: "Estadia vista pelo convidado", rota: () => `/dashboard/estadia/${ids.contrato}/convidado`, pular: () => (ids.convite ? null : "não deu para semear o convite") },
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
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco49";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const CLIQUE = "clique no botão primário sem resposta visível em 3 s";

test.describe("T599 — varredura da página inteira, bloco 49 (páginas de detalhe ainda sem varredura) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  // Um worker só: os dados semeados (a visita única por imóvel e modalidade) valem para todas as telas do bloco; sem
  // o modo serial, uma falha não pula as telas seguintes.
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (!MASSA || info.project.name !== "chromium") return;
    const dono = MASSA.ids.DONO17;
    const morador = MASSA.ids.INQUILINA;
    // Conta nova: entra com uma intenção gravada (o login cai no painel) e a intenção é apagada antes de abrir a tela.
    ids.nova = await criarConta(nova, senha);
    await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", ids.nova);
    // Estadia própria para 2 ocupantes (assinada pelas duas partes, entrada em 5 dias) e o convidado ativo nela.
    ids.convidado = await criarConta(convidado, senha);
    ids.dona = await criarConta(donaEstadia, senha);
    ids.morador = await criarConta(moradorEstadia, senha);
    for (const id of [ids.convidado, ids.dona, ids.morador]) await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", id);
    ids.imovelEstadia = await criarImovelPronto(ids.dona, `[Varredura] Estadia do convidado t599 ${sufixo}`, { ativo: true, preco: 3000 });
    ids.leadEstadia = await criarLead(ids.dona, ids.morador, ids.imovelEstadia, true);
    const assinado = new Date().toISOString();
    const { data: ct, error: eCt } = await adm()
      .from("contratos")
      .insert({
        lead_id: ids.leadEstadia, property_id: ids.imovelEstadia, tenant_id: ids.morador, owner_plan: "essential", faixa: "media_estadia",
        prazo_total_dias: 60, aluguel_mensal: 3000, tamanho_bloco_meses: 2, comissao_percent: 0.1, comissao_valor: 600,
        qtd_ocupantes: 2, capacidade_snapshot: 3, assinado_proprietario_em: assinado, assinado_inquilino_em: assinado,
      })
      .select("id")
      .single();
    if (eCt) console.log(`T599|semear contrato: ${eCt.message}`);
    ids.contrato = (ct as { id?: string } | null)?.id;
    if (ids.contrato) {
      await adm().from("contrato_blocos").insert({ contrato_id: ids.contrato, numero_bloco: 1, inicio: emDias(5), fim: emDias(64), meses: 2, valor: 6000, caucao: 3000, status: "ativo" });
      const { data: cv, error: eCv } = await adm()
        .from("estadia_convidados")
        .insert({ contrato_id: ids.contrato, email: convidado.email, convidado_user_id: ids.convidado, convidado_por: ids.morador })
        .select("id")
        .single();
      if (eCv) console.log(`T599|semear convite: ${eCv.message}`);
      ids.convite = (cv as { id?: string } | null)?.id;
    }
    // Proposta do DONO17 para a INQUILINA no imovel17, com uma versão.
    ids.lead = await criarLead(dono, morador, MASSA.imovel17, true).catch(() => undefined);
    const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
    const { data: pr } = await adm()
      .from("propostas")
      .insert({ numero, lead_id: ids.lead ?? null, property_id: MASSA.imovel17, owner_id: dono, tenant_id: morador, status: "enviada", versao_atual: 1, validade_dias: 7, valida_ate: `${emDias(7)}T23:00:00Z` })
      .select("id")
      .single();
    if (pr) {
      ids.proposta = (pr as { id: string }).id;
      await adm().from("proposta_versoes").insert({
        proposta_id: ids.proposta, versao: 1, autor: "owner", valor_base: 3200, valor_mensal: 3200, meses: 4, data_entrada: emDias(10),
        total_mensal: 3200, total_contrato: 12_800, mensagem: "Proposta da varredura do bloco 49.",
      });
    }
    // Visita por vídeo confirmada (DONO17 → INQUILINA no imovel17); se já houver uma aberta, a varredura usa ela.
    const horario = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const { data: vi } = await adm()
      .from("visitas_video")
      .insert({ property_id: MASSA.imovel17, owner_id: dono, tenant_id: morador, horarios: [horario], modalidade: "video", status: "confirmado", horario_confirmado: horario, link_chamada: "https://meet.google.com/abc-defg-hij" })
      .select("id")
      .maybeSingle();
    if (vi) {
      ids.visita = (vi as { id: string }).id;
      ids.visitaCriada = true;
    } else {
      const { data: aberta } = await adm().from("visitas_video").select("id").eq("property_id", MASSA.imovel17).eq("tenant_id", morador).eq("modalidade", "video").in("status", ["pedido", "confirmado"]).limit(1).maybeSingle();
      ids.visita = (aberta as { id?: string } | null)?.id;
    }
    // Chamado de teste (simulacao: não entra na contagem do aviso do /admin, t254).
    const agora = Date.now();
    const { data: ch } = await adm()
      .from("chamados")
      .insert({
        visitante_email: `lab-t599.${sufixo}@lab.vivanomads.test`, visitante_nome: "Lab T599", tipo: "suporte", categoria: "outro", prioridade: "p3", status: "aberto", canal: "site",
        assunto: `Lab T599 ${sufixo} — dúvida sobre a caução`, responsavel_tipo: "humano",
        prazo_primeira_resposta: new Date(agora + 3_600_000).toISOString(), prazo_resolucao: new Date(agora + 86_400_000).toISOString(), simulacao: true,
      })
      .select("id")
      .single();
    ids.chamado = (ch as { id?: string } | null)?.id;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    if (ids.chamado) await adm().from("chamados").delete().eq("id", ids.chamado);
    if (ids.visita && ids.visitaCriada) await adm().from("visitas_video").delete().eq("id", ids.visita);
    if (ids.proposta) {
      await adm().from("proposta_versoes").delete().eq("proposta_id", ids.proposta);
      await adm().from("propostas").delete().eq("id", ids.proposta);
    }
    if (ids.lead) await adm().from("leads").delete().eq("id", ids.lead);
    if (ids.convite) await adm().from("estadia_convidados").delete().eq("id", ids.convite);
    if (ids.contrato) await adm().from("contratos").delete().eq("id", ids.contrato);
    if (ids.leadEstadia) await adm().from("leads").delete().eq("id", ids.leadEstadia);
    await apagarContas([ids.nova, ids.convidado, ids.dona, ids.morador]);
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes e o clique no primário, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      const daMassa = t.conta !== "ADMIN" && t.conta !== "VISITANTE" && t.conta !== "NOVA" && t.conta !== "CONVIDADO";
      test.skip(daMassa && !temContaVarredura(t.conta as ChaveConta), `sem a conta ${t.conta} na massa`);
      const motivo = t.pular?.() ?? null;
      test.skip(!!motivo, motivo ?? "");
      const limpar: (() => Promise<unknown>)[] = [];
      const relatorio: Record<string, Record<string, string[]>> = {};
      try {
        for (const tam of TAMANHOS) {
          const rota = await t.rota(MASSA!);
          let page: Page;
          if (t.conta === "VISITANTE") {
            const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: tam.width, height: tam.height } });
            page = await ctx.newPage();
          } else if (t.conta === "ADMIN") {
            const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: tam.width, height: tam.height } });
            page = await ctx.newPage();
          } else if (t.conta === "NOVA" || t.conta === "CONVIDADO") {
            // Sem intenção o login cai na própria /auth/intencao: grava uma para entrar e apaga logo depois.
            if (t.conta === "NOVA") await adm().from("profiles").update({ intencao: ["morar"] }).eq("id", ids.nova!);
            page = await entrar(browser, t.conta === "NOVA" ? nova.email : convidado.email, senha);
            await page.setViewportSize({ width: tam.width, height: tam.height });
            if (t.conta === "NOVA") await adm().from("profiles").update({ intencao: null }).eq("id", ids.nova!);
          } else {
            page = (await abrirComoConta(browser, t.conta as ChaveConta, tam.nome)).page;
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
