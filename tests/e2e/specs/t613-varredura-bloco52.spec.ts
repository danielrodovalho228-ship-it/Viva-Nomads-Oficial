import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS, cliqueResponde } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T613 — VARREDURA DA PÁGINA INTEIRA, BLOCO 52 (Pista C, 29/10). O protocolo do bloco 21 (t385): seis classes (imagem
  vazia/quebrada, sobreposição de elemento fixo, texto cortado, grade desalinhada…), página toda rolada, carregamento
  real de cada imagem, 390 e 1280 px, HTTP abaixo de 400 e o clique no primário com resposta visível em até 3 s.
  Com os blocos 48–51 toda página do produto tem varredura; o bloco 52 varre os ESTADOS novos que os merges trouxeram:
  o Início do dono com a seção "Hoje" cheia (E190 parte 2, #1484: quem entra e quem sai hoje, em cartões com foto ou
  iniciais), a Agenda do mesmo dono (agenda-servidor, mesma fonte) e o Início do dono sem nada hoje (a seção some).
  O L-72 (cartões "Hoje" vazando a 390) foi corrigido pelo E219 (#1489): a varredura volta a exigir zero estouro.
  Semeado como no t610-e190p2 e apagado no fim: dono com dois imóveis (um morador entra hoje, outro sai hoje, leads aceitos) e
  um dono com contrato só no futuro. Só no laboratório.
*/
type Conta = "DONO" | "VAZIO";
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
const dono = { email: `dono.t613.${sufixo}@lab.vivanomads.test`, nome: "Olga Hoje", role: "owner" as const };
const vazio = { email: `vazio.t613.${sufixo}@lab.vivanomads.test`, nome: "Valter Semnada", role: "owner" as const };
const entra = { email: `entra.t613.${sufixo}@lab.vivanomads.test`, nome: "Ivo Chegada", role: "tenant" as const };
const sai = { email: `sai.t613.${sufixo}@lab.vivanomads.test`, nome: "Bia Partida", role: "tenant" as const };
const CONTAS: Record<Conta, { email: string }> = { DONO: dono, VAZIO: vazio };
const ids: Record<string, string> = {};
/** Dia em Brasília (UTC−3), deslocado em `d` dias — o mesmo "hoje" da tela (como no t609). */
const dia = (d: number) => new Date(Date.now() - 3 * 3_600_000 + d * 86_400_000).toISOString().slice(0, 10);

async function contrato(imovel: string, tenant: string, inicio: string, fim: string): Promise<string> {
  const t = new Date().toISOString();
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: tenant, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.12, comissao_valor: 768, qtd_ocupantes: 1, garantia: "caucao", status: "ativo", assinado_proprietario_em: t, assinado_inquilino_em: t })
    .select("id")
    .single();
  if (error) throw error;
  const { error: eB } = await adm().from("contrato_blocos").insert({ contrato_id: c!.id, numero_bloco: 1, inicio, fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
  if (eB) throw eB;
  return c!.id as string;
}

const TELAS: Tela[] = [
  { conta: "DONO", papel: "proprietário", nome: "Início com a seção Hoje (entra e sai hoje)", rota: () => "/dashboard", pular: () => (ids.cEntra && ids.cSai ? null : "não deu para semear os contratos de hoje") },
  { conta: "DONO", papel: "proprietário", nome: "Agenda com quem entra e sai hoje", rota: () => "/dashboard/agenda", pular: () => (ids.cEntra && ids.cSai ? null : "não deu para semear os contratos de hoje") },
  { conta: "VAZIO", papel: "proprietário", nome: "Início sem nada hoje", rota: () => "/dashboard", pular: () => (ids.cFuturo ? null : "não deu para semear o contrato futuro") },
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

const SAIDA = "tests/laboratorio/saida/varredura-bloco52";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const CLIQUE = "clique no botão primário sem resposta visível em 3 s";

test.describe("T613 — varredura da página inteira, bloco 52 (Início do dono com Hoje, Agenda e Início vazio) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  // Um worker só: os contratos semeados valem para as três telas; sem o modo serial, uma falha não pula as outras.
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (!NO_LABORATORIO || info.project.name !== "chromium") return;
    ids.dono = await criarConta(dono, senha);
    ids.vazio = await criarConta(vazio, senha);
    ids.entra = await criarConta(entra, senha);
    ids.sai = await criarConta(sai, senha);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"] }).in("id", [ids.dono, ids.vazio]);
    await adm().from("profiles").update({ is_teste: true, intencao: ["morar"] }).in("id", [ids.entra, ids.sai]);
    ids.imA = await criarImovelPronto(ids.dono, `[Varredura] Studio Aurora t613 ${sufixo}`, { ativo: true });
    ids.imB = await criarImovelPronto(ids.dono, `[Varredura] Loft Bela t613 ${sufixo}`, { ativo: true });
    ids.imVazio = await criarImovelPronto(ids.vazio, `[Varredura] Studio Calmo t613 ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ checkin_after: "14:00", checkout_before: "11:00" }).in("id", [ids.imA, ids.imB]);
    // O nome do morador aparece depois do aceite (a mesma regra da Agenda).
    await criarLead(ids.dono, ids.entra, ids.imA, true);
    await criarLead(ids.dono, ids.sai, ids.imB, true);
    try {
      ids.cEntra = await contrato(ids.imA, ids.entra, dia(0), dia(59));
      ids.cSai = await contrato(ids.imB, ids.sai, dia(-59), dia(0));
      ids.cFuturo = await contrato(ids.imVazio, ids.entra, dia(70), dia(129));
    } catch (e) {
      console.log(`T613|semear contratos: ${String(e).slice(0, 200)}`);
    }
  });
  test.afterAll(async ({}, info) => {
    if (!NO_LABORATORIO || info.project.name !== "chromium") return;
    const cids = [ids.cEntra, ids.cSai, ids.cFuturo].filter(Boolean);
    if (cids.length) {
      await adm().from("contrato_blocos").delete().in("contrato_id", cids);
      await adm().from("contratos").delete().in("id", cids);
    }
    await adm().from("leads").delete().in("owner_id", [ids.dono, ids.vazio].filter(Boolean));
    await apagarContas([ids.dono, ids.vazio, ids.entra, ids.sai]);
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
