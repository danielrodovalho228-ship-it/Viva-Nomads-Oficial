import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T625 — VARREDURA DA PÁGINA INTEIRA, BLOCO 59 (Pista C, 29/10). As etapas 5 (Comodidades) e 6 (Regras) do assistente de
  cadastro depois do E193 (#1496, um só estilo de controle) e do E195 (#1488, fundo clean da Qualificação), a 390 e 1280
  px. Em cada etapa:
    · a varredura da casa (bloco 21, t385): seis classes, página toda rolada, carregamento real de cada imagem;
    · o inventário dos controles de escolha à vista (o mesmo da t620): nenhuma caixa quadrada (checkbox/radio nativo à
      vista) e nenhuma lista suspensa (<select>) — várias escolhas em pílula, uma escolha em cartão — e pelo menos um
      controle do estilo novo na tela;
    · o fundo da página igual ao da Qualificação (o mesmo cálculo da t611: o primeiro fundo pintado de <main> para cima).
  Rascunho de um dono criado aqui (como na t620/t611) e apagado no fim. Sem clique no primário (ele avança e grava).
*/
const ETAPAS = [
  { etapa: "comodidades", nome: "Etapa 5 — Comodidades" },
  { etapa: "regras", nome: "Etapa 6 — Regras" },
] as const;

/** Achados já registrados como defeito de produto (L-*): ficam anotados e não derrubam o teste. */
const CONHECIDOS: { achado: RegExp; l: string; classe: Classe }[] = [
  // L-63 (Pista A + Daniel): as fotos dos cartões de tipo do #1312 ainda não estão em public/images/imoveis/.
  { classe: "imagem", achado: /\/images\/imoveis\/(tipo-(casa|studio|loft|cobertura|casa-condominio|flat)|placeholder-imovel-chacara)\.webp/, l: "L-63" },
  { classe: "foto", achado: /área de foto vazia \(aspect-ratio 4 \/ 3\).*"Imagem ilustrativa"/, l: "L-63" },
];
const conhecido = (a: string, classe: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.achado.test(a));

const SAIDA = "tests/laboratorio/saida/varredura-bloco59";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t625.${sufixo}@lab.vivanomads.test`, nome: "Lia Etapas", role: "owner" as const };
const ids: Record<string, string> = {};

/** Cor de fundo da página: o primeiro fundo pintado de <main> para cima (o mesmo da t611). */
const fundoNaLateral = (p: Page) =>
  p.evaluate(() => {
    let el = document.querySelector("main") as HTMLElement | null;
    while (el && getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)") el = el.parentElement;
    return el ? getComputedStyle(el).backgroundColor : "";
  });

/** Inventário dos controles de escolha à vista no conteúdo do assistente, fora do rodapé (o mesmo da t620). */
const inventario = (p: Page) =>
  p.evaluate(() => {
    const visivel = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && cs.opacity !== "0";
    };
    const raiz = document.querySelector("main") ?? document.body;
    const fora = (el: Element) => !!el.closest("[data-testid=assistente-rodape], header, nav, [role=dialog]");
    const achados: Record<string, string[]> = { caixa: [], lista: [], chave: [], pilula: [], cartao: [] };
    const rot = (el: Element) => (el.getAttribute("data-testid") || (el.textContent ?? "").trim().slice(0, 40) || el.getAttribute("aria-label") || "").replace(/\s+/g, " ");
    for (const el of Array.from(raiz.querySelectorAll("input[type=checkbox], input[type=radio]"))) {
      if (fora(el) || !visivel(el)) continue;
      achados.caixa.push(`${(el as HTMLInputElement).type}:${rot(el.closest("label") ?? el)}`);
    }
    for (const el of Array.from(raiz.querySelectorAll("select"))) if (!fora(el) && visivel(el)) achados.lista.push(rot(el.closest("label") ?? el));
    for (const el of Array.from(raiz.querySelectorAll("[role=switch]"))) if (!fora(el) && visivel(el)) achados.chave.push(rot(el.closest("label") ?? el));
    for (const el of Array.from(raiz.querySelectorAll("button[aria-pressed], button[role=radio], button[role=checkbox], [role=radio], [role=checkbox], label:has(> input.sr-only)"))) {
      if (fora(el) || !visivel(el)) continue;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const pilula = parseFloat(cs.borderTopLeftRadius) >= r.height / 2 - 1;
      achados[pilula ? "pilula" : "cartao"].push(rot(el));
    }
    return Object.fromEntries(Object.entries(achados).map(([k, v]) => [k, [...new Set(v)]]));
  });

test.describe("T625 — varredura da página inteira, bloco 59 (etapas 5 e 6 do cadastro depois do E193/E195) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  // Um worker só: o rascunho vale para as duas etapas; sem o modo serial, uma falha não pula a outra.
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"] }).eq("id", ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `[Varredura] Rascunho t625 ${sufixo}`);
  });
  test.afterAll(async ({}, info) => {
    if (info.project.name !== "chromium" || !ids.dono) return;
    await apagarContas([ids.dono]);
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const e of ETAPAS) {
    test(`proprietário — ${e.nome}: um controle só, fundo da Qualificação e as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      const relatorio: Record<string, unknown> = {};
      for (const tam of TAMANHOS) {
        const page = await entrar(browser, dono.email, senha);
        await page.setViewportSize({ width: tam.width, height: tam.height });
        try {
          // Referência: o fundo da Qualificação no mesmo tamanho.
          await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded", timeout: 40_000 });
          await expect(page.getByTestId("qualificacao")).toBeVisible({ timeout: 30_000 });
          const fundoQualificacao = await fundoNaLateral(page);

          const rota = `/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=${e.etapa}`;
          const respostas = escutarImagens(page);
          const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${e.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          await expect(page.getByTestId("assistente-rodape")).toBeVisible({ timeout: 30_000 });
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

          const inv = await inventario(page);
          const fundo = await fundoNaLateral(page);
          console.log(`VARREDURA|controles|${tam.nome}|${e.etapa}|${JSON.stringify(inv)}`);
          console.log(`VARREDURA|fundo|${tam.nome}|${e.etapa}|etapa ${fundo} · Qualificação ${fundoQualificacao}`);
          await test.step(`um controle só (E193) @${tam.nome}`, async () => {
            expect.soft(inv.caixa, `${e.nome} @${tam.nome}: caixas quadradas à vista`).toEqual([]);
            expect.soft(inv.lista, `${e.nome} @${tam.nome}: listas suspensas à vista`).toEqual([]);
            expect.soft(inv.pilula.length + inv.cartao.length, `${e.nome} @${tam.nome}: pílulas ou cartões na etapa`).toBeGreaterThan(0);
          });
          await test.step(`fundo igual ao da Qualificação (E195) @${tam.nome}`, async () => {
            expect.soft(fundo, `${e.nome} @${tam.nome}: fundo da etapa = fundo da Qualificação`).toBe(fundoQualificacao);
          });

          const achados = await varrerPagina(page, respostas);
          for (const classe of Object.keys(CLASSES) as Classe[]) {
            await test.step(`${classe} @${tam.nome}`, async () => {
              for (const a of achados[classe]) console.log(`VARREDURA|${classe}|${tam.nome}|proprietário|/dashboard/imoveis/novo?etapa=${e.etapa}|${a}`);
              for (const a of achados[classe]) {
                const c = conhecido(a, classe);
                if (c) test.info().annotations.push({ type: c.l, description: `${e.etapa} @${tam.nome} (${classe}): ${a}` });
              }
              const novos = achados[classe].filter((a) => !conhecido(a, classe));
              expect.soft(novos, `${e.nome} @${tam.nome} — ${classe}: ${CLASSES[classe]}`).toEqual([]);
            });
          }
          relatorio[tam.nome] = { controles: inv, fundo, fundoQualificacao, ...achados };
          mkdirSync(SAIDA, { recursive: true });
          await page.screenshot({ path: `${SAIDA}/${e.etapa}-${tam.nome}.png`, fullPage: true });
        } finally {
          await page.context().close();
        }
      }
      mkdirSync(SAIDA, { recursive: true });
      writeFileSync(`${SAIDA}/${e.etapa}.json`, JSON.stringify({ etapa: e.nome, achados: relatorio }, null, 2));
    });
  }
});
