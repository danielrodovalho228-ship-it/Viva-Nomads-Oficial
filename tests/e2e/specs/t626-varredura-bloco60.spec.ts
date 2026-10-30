import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS, cliqueResponde } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T626 — VARREDURA DA PÁGINA INTEIRA, BLOCO 60 (Pista C, 29/10). O protocolo do bloco 21 (t385): seis classes (imagem
  vazia/quebrada, sobreposição de elemento fixo, texto cortado, grade desalinhada…), página toda rolada, carregamento
  real de cada imagem, 390 e 1280 px, HTTP abaixo de 400 e o clique no primário com resposta visível em até 3 s.
  O Início do dono com a seção "Hoje" (E190 parte 2, #1484; cartões que cabem na tela, E219, #1489) e o checklist de
  ativação de volta (E218, #1492) nos dois papéis:
    · dono com quem entra e quem sai hoje, nomes longos (o caso que estourava a 390 no L-72): a seção "Hoje" com os dois
      cartões e nenhum checklist (o dono já ativou: tem anúncio publicado); e a Agenda do mesmo dono;
    · dono novo, sem anúncio: só o checklist do dono, dentro do bloco "Anuncie seu primeiro imóvel";
    · morador novo: só o checklist do morador ("Para encontrar seu imóvel").
  Adendo do coordenador (29/10), também no bloco 60:
    · os cartões do "Hoje" também a 360 px (não só 390): cabem na largura e a página não rola de lado;
    · a barra de baixo do MENUS-5 (as 5 abas do celular, uma coluna por destino) a 360 e 390 px, no dono e no morador
      com contrato (aba Estadia): nenhum rótulo cortado, nenhum rótulo saindo da própria coluna e as colunas com a mesma
      largura (nenhuma aperta a vizinha). As medidas vão para o log (VARREDURA|menus5).
  Semeado como no t613 e apagado no fim. Só no laboratório.
  Reconferência a 390/360 px pedida pelo coordenador (30/10, E195/E238/E219/E229): rodada no lab-crítico sobre a main atual.
*/
type Conta = "DONO" | "NOVO" | "MORADOR";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: () => string;
  /** false: não clica no primário (ação com efeito fora da tela). */
  clicar?: boolean;
  /** Motivo para pular (dado que o laboratório não tem); null = varre. */
  pular?: () => string | null;
  /** Checklists de ativação que o Início tem de mostrar (E218), na ordem da tela. */
  checklists?: string[];
  /** O Início tem de mostrar a seção "Hoje" com este número de cartões (E190 parte 2 + E219). */
  hoje?: number;
}

const sufixo = novoSufixo();
const senha = novaSenha();
const dono = { email: `dono.t626.${sufixo}@lab.vivanomads.test`, nome: "Olga Hoje", role: "owner" as const };
const novo = { email: `novo.t626.${sufixo}@lab.vivanomads.test`, nome: "Nilo Começo", role: "owner" as const };
const morador = { email: `morador.t626.${sufixo}@lab.vivanomads.test`, nome: "Mel Procura", role: "tenant" as const };
// Nomes longos de propósito: o caso que vazava a 390 antes do E219 (L-72).
const entra = { email: `entra.t626.${sufixo}@lab.vivanomads.test`, nome: "Maria Aparecida dos Santos Nogueira Chegada", role: "tenant" as const };
const sai = { email: `sai.t626.${sufixo}@lab.vivanomads.test`, nome: "Bartolomeu Henrique de Albuquerque Partida", role: "tenant" as const };
const CONTAS: Record<Conta, { email: string }> = { DONO: dono, NOVO: novo, MORADOR: morador };
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

const semear = () => (ids.cEntra && ids.cSai ? null : "não deu para semear os contratos de hoje");
const TELAS: Tela[] = [
  { conta: "DONO", papel: "proprietário", nome: "Início com a seção Hoje, nomes longos (E190 p2 + E219), sem checklist", rota: () => "/dashboard", pular: semear, hoje: 2, checklists: [] },
  { conta: "DONO", papel: "proprietário", nome: "Agenda com quem entra e sai hoje", rota: () => "/dashboard/agenda", pular: semear },
  { conta: "NOVO", papel: "proprietário", nome: "Início do dono novo, só o checklist do dono (E218)", rota: () => "/dashboard", checklists: ["proprietario"] },
  { conta: "MORADOR", papel: "morador", nome: "Início do morador novo, só o checklist do morador (E218)", rota: () => "/dashboard", checklists: ["morador"] },
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

const SAIDA = "tests/laboratorio/saida/varredura-bloco60";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const CLIQUE = "clique no botão primário sem resposta visível em 3 s";

test.describe("T626 — varredura da página inteira, bloco 60 (Hoje do dono e checklist de ativação nos dois papéis) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  // Um worker só: os contratos e as contas semeadas valem para as quatro telas; sem o modo serial, uma falha não pula as outras.
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (!NO_LABORATORIO || info.project.name !== "chromium") return;
    ids.dono = await criarConta(dono, senha);
    ids.novo = await criarConta(novo, senha);
    ids.morador = await criarConta(morador, senha);
    ids.entra = await criarConta(entra, senha);
    ids.sai = await criarConta(sai, senha);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"] }).in("id", [ids.dono, ids.novo]);
    await adm().from("profiles").update({ is_teste: true, intencao: ["morar"] }).in("id", [ids.entra, ids.sai, ids.morador]);
    ids.imA = await criarImovelPronto(ids.dono, `[Varredura] Studio Aurora t626 ${sufixo}`, { ativo: true });
    ids.imB = await criarImovelPronto(ids.dono, `[Varredura] Loft Bela t626 ${sufixo}`, { ativo: true });
    await adm().from("properties").update({ checkin_after: "14:00", checkout_before: "11:00" }).in("id", [ids.imA, ids.imB]);
    // O nome do morador aparece depois do aceite (a mesma regra da Agenda).
    await criarLead(ids.dono, ids.entra, ids.imA, true);
    await criarLead(ids.dono, ids.sai, ids.imB, true);
    try {
      ids.cEntra = await contrato(ids.imA, ids.entra, dia(0), dia(59));
      ids.cSai = await contrato(ids.imB, ids.sai, dia(-59), dia(0));
    } catch (e) {
      console.log(`T626|semear contratos: ${String(e).slice(0, 200)}`);
    }
  });
  test.afterAll(async ({}, info) => {
    if (!NO_LABORATORIO || info.project.name !== "chromium") return;
    const cids = [ids.cEntra, ids.cSai].filter(Boolean);
    if (cids.length) {
      await adm().from("contrato_blocos").delete().in("contrato_id", cids);
      await adm().from("contratos").delete().in("id", cids);
    }
    await adm().from("leads").delete().in("owner_id", [ids.dono].filter(Boolean));
    await apagarContas([ids.dono, ids.novo, ids.morador, ids.entra, ids.sai].filter(Boolean));
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
            if (t.hoje !== undefined) {
              await test.step(`seção Hoje com ${t.hoje} cartões @${tam.nome}`, async () => {
                const cartoes = page.getByTestId("inicio-dono-hoje-cartao");
                await expect.soft(page.getByTestId("inicio-dono-hoje"), `${t.nome} @${tam.nome}: a seção Hoje aparece`).toBeVisible({ timeout: 15_000 });
                await expect.soft(cartoes, `${t.nome} @${tam.nome}: cartões da seção Hoje`).toHaveCount(t.hoje!);
                const fora = await cartoes.evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 || e.scrollWidth > e.clientWidth + 1).length);
                console.log(`VARREDURA|hoje|${tam.nome}|${t.conta}|${rota}|${await cartoes.count()} cartões, ${fora} além da largura`);
                expect.soft(fora, `${t.nome} @${tam.nome}: cartões da seção Hoje cabem na tela (E219)`).toBe(0);
              });
            }
            if (t.checklists) {
              await page.locator('[data-testid="checklist-ativacao"], [data-testid="inicio-dono"]').first().waitFor({ timeout: 15_000 }).catch(() => {});
              await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
              const papeis = await page
                .locator('[data-testid="checklist-ativacao"]')
                .evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getAttribute("data-papel") ?? "?"));
              const dentro = await page.getByTestId("inicio-dono-principal").locator('[data-testid="checklist-ativacao"]').count();
              console.log(`VARREDURA|checklist|${tam.nome}|${t.conta}|${rota}|visíveis: ${papeis.join(", ") || "nenhum"} · dentro do bloco do dono: ${dentro}`);
              await test.step(`checklists de ativação (${t.checklists.join(", ") || "nenhum"}) @${tam.nome}`, async () => {
                expect.soft(papeis, `${t.nome} @${tam.nome}: checklists de ativação visíveis`).toEqual(t.checklists);
                if (t.checklists!.includes("proprietario")) expect.soft(dentro, `${t.nome} @${tam.nome}: checklist do dono dentro do bloco principal`).toBe(1);
              });
            }
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
  test("adendo — cartões do Hoje a 360 px: cabem na largura e a página não rola de lado", async ({ browser }) => {
    test.setTimeout(120_000);
    test.skip(!(ids.cEntra && ids.cSai), "não deu para semear os contratos de hoje");
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 360, height: 780 });
    try {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 40_000 });
      const cartoes = page.getByTestId("inicio-dono-hoje-cartao");
      await expect(cartoes).toHaveCount(2, { timeout: 20_000 });
      const medidas = await cartoes.evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          const nome = e.querySelector("[data-testid=inicio-dono-hoje-nome]") as HTMLElement | null;
          return { esquerda: Math.round(r.left), direita: Math.round(r.right), corta: e.scrollWidth > e.clientWidth + 1, nomeTruncado: !!nome && nome.scrollWidth > nome.clientWidth };
        })
      );
      const rolagem = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      console.log(`VARREDURA|hoje|360|DONO|/dashboard|${JSON.stringify({ medidas, rolagem })}`);
      mkdirSync(SAIDA, { recursive: true });
      await page.screenshot({ path: `${SAIDA}/hoje-360.png`, fullPage: true });
      expect.soft(medidas.filter((m) => m.direita > 361 || m.esquerda < -1 || m.corta), "cartões do Hoje além da largura a 360 px (E219)").toEqual([]);
      expect.soft(rolagem, "rolagem lateral da página a 360 px").toBeLessThanOrEqual(1);
    } finally {
      await page.context().close();
    }
  });

  for (const quem of [
    { nome: "dono", email: () => dono.email, papel: "proprietario" },
    { nome: "morador com contrato (aba Estadia)", email: () => entra.email, papel: "inquilino" },
  ] as const) {
    for (const largura of [360, 390] as const) {
      test(`adendo — barra de baixo do MENUS-5 do ${quem.nome} a ${largura} px: rótulos inteiros e colunas iguais`, async ({ browser }) => {
        test.setTimeout(120_000);
        test.skip(!(ids.cEntra && ids.cSai), "não deu para semear os contratos de hoje");
        // L-74 (bloco 60, 29/10) corrigido pelo E229 (#1515): abaixo de 375 px o rótulo da barra desce para 10 px e
        // "Interessados" cabe inteiro na coluna de 72 px. Os quatro casos (dono e morador, 360 e 390) são teste normal.
        const page = await entrar(browser, quem.email(), senha);
        await page.setViewportSize({ width: largura, height: 780 });
        try {
          await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 40_000 });
          const barra = page.locator("nav[data-papel]:visible").filter({ has: page.locator("ul.grid") }).last();
          await expect(barra).toBeVisible({ timeout: 20_000 });
          const m = await barra.evaluate((nav) =>
            Array.from(nav.querySelectorAll(":scope > ul > li")).map((li) => {
              const r = li.getBoundingClientRect();
              const span = li.querySelector("a > span:last-child") as HTMLElement | null;
              const s = span?.getBoundingClientRect();
              return {
                rotulo: (span?.textContent ?? "").trim(),
                largura: Math.round(r.width * 10) / 10,
                texto: span ? span.scrollWidth : 0,
                cabe: span ? span.clientWidth : 0,
                cortado: !!span && span.scrollWidth > span.clientWidth,
                foraDaColuna: !!s && (s.left < r.left - 0.5 || s.right > r.right + 0.5),
              };
            })
          );
          console.log(`VARREDURA|menus5|${largura}|${quem.papel}|/dashboard|${JSON.stringify(m)}`);
          mkdirSync(SAIDA, { recursive: true });
          await barra.screenshot({ path: `${SAIDA}/menus5-${quem.papel}-${largura}.png` });
          expect.soft(m.length, `${quem.nome} @${largura}: abas na barra`).toBeGreaterThanOrEqual(4);
          expect.soft(m.length, `${quem.nome} @${largura}: no máximo 5 abas (MENUS-5)`).toBeLessThanOrEqual(5);
          expect.soft(m.filter((i) => i.foraDaColuna).map((i) => i.rotulo), `${quem.nome} @${largura}: rótulos fora da própria coluna`).toEqual([]);
          const larguras = m.map((i) => i.largura);
          expect.soft(Math.max(...larguras) - Math.min(...larguras), `${quem.nome} @${largura}: colunas de larguras diferentes (uma aperta a vizinha)`).toBeLessThanOrEqual(1);
          expect(m.filter((i) => i.cortado).map((i) => `${i.rotulo} (${i.texto}px de texto em ${i.cabe}px)`), `${quem.nome} @${largura}: rótulos cortados (reticências)`).toEqual([]);
        } finally {
          await page.context().close();
        }
      });
    }
  }
});
