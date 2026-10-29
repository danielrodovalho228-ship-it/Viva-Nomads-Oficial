import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, cliqueResponde, lerMassa, temContaVarredura, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T622 — VARREDURA DA PÁGINA INTEIRA, BLOCO 56 (Pista C, 29/10). O protocolo do bloco 21 (t385): seis classes (imagem
  vazia/quebrada, sobreposição de elemento fixo, texto cortado, grade desalinhada…), página toda rolada, carregamento
  real de cada imagem, 390 e 1280 px, HTTP abaixo de 400 e o clique no primário com resposta visível em até 3 s.
  O bloco 56 completa os ESTADOS dos dois últimos merges que o bloco 55 não varreu:
    · E218 (#1492): o morador novo tem o checklist DELE no Início ("Para encontrar seu imóvel"; o do dono não aparece
      no modo morador, de propósito, pelo E167), e o dono já ativado (DONO17, com anúncios publicados) não vê mais
      checklist nenhum. A presença de cada checklist vai para o log (VARREDURA|checklist) e é conferida;
    · E193 (#1496): a Qualificação (a entrada do cadastro para quem nunca anunciou), com os cartões de escolha única,
      no dono novo, sem clicar (o primário inicia o rascunho); e Meus imóveis do dono com só um rascunho (DONO0).
  O dono novo e o morador novo são criados e apagados aqui. Só no laboratório.
*/
type Conta = "NOVO" | "MORADOR" | "DONO0" | "DONO17";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: (m: Massa) => string;
  /** false: não clica no primário (ação com efeito fora da tela). */
  clicar?: boolean;
  /** Qual checklist de ativação o Início tem de mostrar (E218); "nenhum" = o papel já ativou. */
  checklist?: "morador" | "nenhum";
}

const TELAS: Tela[] = [
  { conta: "MORADOR", papel: "morador", nome: "Início do morador novo, com o checklist \"Para encontrar seu imóvel\" (E218)", rota: () => "/dashboard", checklist: "morador" },
  { conta: "DONO17", papel: "proprietário", nome: "Início do dono já ativado, sem checklist (E218)", rota: () => "/dashboard", checklist: "nenhum" },
  { conta: "NOVO", papel: "proprietário", nome: "Qualificação do dono novo, com os cartões de escolha única (E193)", rota: () => "/dashboard/imoveis/novo", clicar: false },
  { conta: "DONO0", papel: "proprietário", nome: "Meus imóveis com só um rascunho", rota: () => "/dashboard/imoveis" },
];

/**
 * Achados já registrados como defeito de produto (L-*): ficam anotados no relatório e não derrubam o teste;
 * qualquer outro achado derruba. Quando a pista dona corrigir, o achado some e a linha sai daqui.
 */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // L-63 (Pista A + Daniel): as 7 fotos dos cartões de tipo do #1312 ainda não estão em public/images/imoveis/.
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "imagem", achado: /\/images\/imoveis\/(tipo-(casa|studio|loft|cobertura|casa-condominio|flat)|placeholder-imovel-chacara)\.webp/, l: "L-63" },
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "foto", achado: /área de foto vazia \(aspect-ratio 4 \/ 3\).*"Imagem ilustrativa"/, l: "L-63" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco56";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const CLIQUE = "clique no botão primário sem resposta visível em 3 s";
const sufixo = novoSufixo();
const senha = novaSenha();
const novo = { email: `novo.t622.${sufixo}@lab.vivanomads.test`, nome: "Otto Primeiro", role: "owner" as const };
const morador = { email: `morador.t622.${sufixo}@lab.vivanomads.test`, nome: "Mara Chegando", role: "tenant" as const };
const ids: Record<string, string> = {};

async function abrir(browser: Parameters<typeof abrirComoConta>[0], conta: Conta, tam: (typeof TAMANHOS)[number]): Promise<Page> {
  if (conta === "NOVO" || conta === "MORADOR") {
    const page = await entrar(browser, (conta === "NOVO" ? novo : morador).email, senha);
    await page.setViewportSize({ width: tam.width, height: tam.height });
    return page;
  }
  return (await abrirComoConta(browser, conta, tam.nome)).page;
}

test.describe("T622 — varredura da página inteira, bloco 56 (checklists do morador novo e do dono ativado, Qualificação e Meus imóveis) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  // Um worker só: as contas novas valem para as telas delas; sem o modo serial, uma falha não pula as outras.
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (!NO_LABORATORIO || info.project.name !== "chromium") return;
    ids.novo = await criarConta(novo, senha);
    ids.morador = await criarConta(morador, senha);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"] }).eq("id", ids.novo);
    await adm().from("profiles").update({ is_teste: true, intencao: ["morar"] }).eq("id", ids.morador);
  });
  test.afterAll(async ({}, info) => {
    if (!NO_LABORATORIO || info.project.name !== "chromium") return;
    await apagarContas([ids.novo, ids.morador].filter(Boolean));
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes e o clique no primário, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "NOVO" && t.conta !== "MORADOR" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      const relatorio: Record<string, Record<string, string[]>> = {};
      for (const tam of TAMANHOS) {
        const rota = t.rota(MASSA!);
        const page = await abrir(browser, t.conta, tam);
        try {
          const respostas = escutarImagens(page);
          const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          if (t.checklist) {
            const listas = page.locator('[data-testid="checklist-ativacao"]');
            await page.locator('[data-testid="checklist-ativacao"], [data-testid="inicio-dono"]').first().waitFor({ timeout: 15_000 }).catch(() => {});
            const papeis = await listas.evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getAttribute("data-papel") ?? "?"));
            console.log(`VARREDURA|checklist|${tam.nome}|${t.conta}|/dashboard|checklists visíveis: ${papeis.join(", ") || "nenhum"}`);
            await test.step(`checklist de ativação (${t.checklist}) @${tam.nome}`, async () => {
              expect.soft(papeis, `${t.nome} @${tam.nome}: checklists de ativação visíveis`).toEqual(t.checklist === "nenhum" ? [] : [t.checklist]);
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
                // Primário que é link: a resposta é a navegação (ou a troca da tela sem navegar).
                const antes = page.url();
                const textoAntes = await page.locator("main").first().innerText().catch(() => "");
                await primario.click({ timeout: 5_000, noWaitAfter: true }).catch(() => {});
                const navegou = await page
                  .waitForURL((u) => u.href !== antes, { timeout: 3_000, waitUntil: "commit" })
                  .then(() => true)
                  .catch(() => false);
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
      mkdirSync(SAIDA, { recursive: true });
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
