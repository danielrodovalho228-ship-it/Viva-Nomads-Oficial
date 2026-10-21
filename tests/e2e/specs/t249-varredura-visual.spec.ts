import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import {
  TAMANHOS, abrirComoConta, abrirRota, cliqueResponde, controlesCobertos, escutarErros, imagensAcimaDaDobra, lerMassa, medirTela, temContaVarredura,
  type ChaveConta, type Criterio, type Massa, type Tamanho,
} from "../fixtures/varredura";

/*
  T249 — VARREDURA VISUAL AUTOMÁTICA: portão permanente antes da entrega (ordem do Muse, 21/10; seção 8 do plano).
  Em cada tela e em cada tamanho (1280 e 390 px), cinco critérios (fixtures/varredura.ts):
    (a) imagens acima da dobra carregadas sem rolar · (b) nada fixo/flutuante cobre controle (topo e fim da rolagem)
    (c) sem overflow horizontal · (d) sem erro de console/página (exceto terceiros, com motivo) · (f) clique em botão primário responde em 3 s.
  Massa: scripts/lab/massa-varredura.mjs (contas is_teste @varredura.lab.vivanomads.test). Sem a massa, o spec se pula.
  Defeitos já conhecidos entram como test.fail com o código D-V no comentário: ao corrigir, o test.fail vira falha e quem
  corrige o produto troca por test normal no mesmo PR. O varrer geral NÃO reprova a combinação coberta por um D-V (ela fica anotada).
  Roda no projeto chromium com viewport trocado dentro do spec (1280 e 390), porque o testMatch do projeto app-mobile
  mora em playwright.config.ts, fora do escopo desta ordem.
*/
const MASSA = lerMassa();
const PODE = NO_LABORATORIO && !!MASSA;

interface Tela {
  conta: ChaveConta | null; // null = visitante
  rota: (m: Massa) => string;
  nome: string;
}
const TELAS: Tela[] = [
  { conta: null, rota: () => "/", nome: "Início" },
  { conta: null, rota: () => "/buscar", nome: "Buscar" },
  { conta: null, rota: (m) => `/imoveis/${m.imovel17}`, nome: "Anúncio com 17 fotos" },
  { conta: "DONO17", rota: () => "/dashboard", nome: "Painel do proprietário" },
  { conta: "DONO17", rota: () => "/dashboard/imoveis", nome: "Meus imóveis" },
  { conta: "DONO17", rota: (m) => `/dashboard/imoveis/${m.imovel17}/editar`, nome: "Editar anúncio ativo" },
  { conta: "DONO17", rota: () => "/dashboard/fechamento", nome: "Fechamento" },
  { conta: "DONO17", rota: () => "/dashboard/contratos", nome: "Contratos do dono" },
  { conta: "DONO17", rota: () => "/dashboard/solicitacoes", nome: "Solicitações" },
  { conta: "DONO0", rota: (m) => `/dashboard/imoveis/novo?draft=${m.rascunho0}`, nome: "Cadastro com 0 fotos" },
  { conta: "INQUILINA", rota: () => "/dashboard", nome: "Painel do inquilino" },
  { conta: "INQUILINA", rota: () => "/dashboard/locacoes", nome: "Minhas locações" },
  { conta: "INQUILINA", rota: (m) => `/dashboard/locacoes/${m.contrato}`, nome: "Locação (contrato completo)" },
  { conta: "INQUILINA", rota: () => "/dashboard/conta", nome: "Conta" },
  { conta: "PARCEIRO", rota: () => "/dashboard/parceiro", nome: "Painel do parceiro" },
  { conta: "TRES", rota: () => "/dashboard", nome: "Painel (3 papéis)" },
];

/** Combinações (tela × tamanho × critério) cobertas por um defeito conhecido: o varrer geral só anota. */
const ESPERADAS: Record<string, string> = {
  "Anúncio com 17 fotos|1280|a-imagens": "D-V1",
  "Anúncio com 17 fotos|390|a-imagens": "D-V1",
  "Cadastro com 0 fotos|390|b-cobertura": "D-V2",
  "Meus imóveis|1280|a-imagens": "D-V4",
  "Meus imóveis|390|a-imagens": "D-V4",
  "Minhas locações|1280|a-imagens": "D-V6",
  "Minhas locações|390|a-imagens": "D-V6",
};

type Linha = { tela: string; tamanho: string; criterio: string; resultado: string };
const relatorio: Linha[] = [];
const excecoes = new Set<string>();
const inicio = Date.now();

test.describe("T249 — varredura visual (tela × tamanho × critério)", () => {
  test.skip(!PODE, "precisa do laboratório com a massa: node scripts/lab/massa-varredura.mjs");
  test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do spec)"));

  test.afterAll(() => {
    const seg = Math.round((Date.now() - inicio) / 1000);
    const cab = "| Tela | Tamanho | Critério | Resultado |\n|---|---|---|---|\n";
    const corpo = relatorio.map((l) => `| ${l.tela} | ${l.tamanho} | ${l.criterio} | ${l.resultado} |`).join("\n");
    const ex = [...excecoes].map((e) => `- ${e}`).join("\n") || "- nenhuma";
    mkdirSync("tests/laboratorio/saida", { recursive: true });
    writeFileSync("tests/laboratorio/saida/varredura-relatorio.md", `# Varredura visual (t249)\n\n${cab}${corpo}\n\n## Exceções de console ignoradas (terceiros)\n${ex}\n\nTempo da spec: ${seg} s (alvo < 360 s)\n`);
  });

  for (const tam of TAMANHOS) {
    test(`varre as telas a ${tam.nome} px`, async ({ browser }) => {
      test.setTimeout(TELAS.length * 40_000);
      const massa = MASSA!;
      const sessoes = new Map<string, Awaited<ReturnType<typeof abrirComoConta>>>();
      try {
        for (const tela of TELAS) {
          if (tela.conta && !temContaVarredura(tela.conta)) {
            relatorio.push({ tela: tela.nome, tamanho: tam.nome, criterio: "todos", resultado: "pulada (sem a conta da massa)" });
            continue;
          }
          let page;
          if (tela.conta) {
            if (!sessoes.has(tela.conta)) sessoes.set(tela.conta, await abrirComoConta(browser, tela.conta, tam.nome as Tamanho));
            page = sessoes.get(tela.conta)!.page;
          } else {
            const ctx = await browser.newContext({ viewport: { width: tam.width, height: tam.height } });
            page = await ctx.newPage();
            sessoes.set(`anon-${tela.nome}`, { context: ctx, page });
          }
          const erros = escutarErros(page);
          const rota = tela.rota(massa);
          const abertura = await abrirRota(page, rota);
          const medidas = abertura.some((p) => p.startsWith("não abriu"))
            ? ({ "a-imagens": abertura, "b-cobertura": [], "c-overflow": [], "d-console": [] } as Awaited<ReturnType<typeof medirTela>>)
            : await medirTela(page, erros);
          if (abertura.length && !abertura.some((p) => p.startsWith("não abriu"))) medidas["c-overflow"].push(...abertura);
          erros.ignorados().forEach((m) => excecoes.add(m));
          for (const crit of Object.keys(medidas) as Exclude<Criterio, "f-resposta">[]) {
            const problemas = medidas[crit];
            const dv = ESPERADAS[`${tela.nome}|${tam.nome}|${crit}`];
            if (dv && problemas.length > 0) {
              test.info().annotations.push({ type: dv, description: `${tela.nome} @${tam.nome} ${crit}: ${problemas[0]}` });
              relatorio.push({ tela: tela.nome, tamanho: tam.nome, criterio: crit, resultado: `falha esperada ${dv}` });
              continue;
            }
            relatorio.push({ tela: tela.nome, tamanho: tam.nome, criterio: crit, resultado: problemas.length ? "falhou" : "passou" });
            expect.soft(problemas, `${tela.nome} @${tam.nome} — ${crit} (${rota.replace(/[0-9a-f-]{36}/g, ":id")})`).toEqual([]);
          }
        }
      } finally {
        for (const s of sessoes.values()) await s.context.close().catch(() => {});
      }
    });
  }
});

/*
  REGRESSÕES IMEDIATAS (test.fail). Cada uma afirma o comportamento CERTO; hoje falha (esperado).
  Quem corrigir o produto remove o `test.fail` no mesmo PR (o Playwright avisa quando passa sozinho).
*/
test.describe("T249 — defeitos conhecidos (D-V)", () => {
  test.skip(!PODE, "precisa do laboratório com a massa: node scripts/lab/massa-varredura.mjs");
  test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium", "só chromium"));

  test("D-V1 — imagens acima da dobra do anúncio de 17 fotos carregam sem rolar (lazy-load)", async ({ browser }) => {
    test.fail(true, "D-V1: lazy-load segura imagens da primeira tela");
    for (const tam of TAMANHOS) {
      const ctx = await browser.newContext({ viewport: { width: tam.width, height: tam.height } });
      const page = await ctx.newPage();
      await abrirRota(page, `/imoveis/${MASSA!.imovel17}`);
      expect(await imagensAcimaDaDobra(page), `@${tam.nome}`).toEqual([]);
      await ctx.close();
    }
  });

  test("D-V2 — a barra 'Fotos: 0 de 8' não flutua sobre o conteúdo do cadastro a 390 px", async ({ browser }) => {
    test.skip(!temContaVarredura("DONO0"), "sem a conta DONO0");
    test.fail(true, "D-V2: barra de fotos solta cobre o cartão 'Seu progresso' ao rolar");
    const { context, page } = await abrirComoConta(browser, "DONO0", "390");
    await abrirRota(page, `/dashboard/imoveis/novo?draft=${MASSA!.rascunho0}`);
    const barraSolta = await page.evaluate(() => {
      const achou = Array.from(document.querySelectorAll<HTMLElement>("main *")).filter((e) => e.children.length < 6 && /Fotos:\s*\d+\s*de\s*\d+/i.test(e.innerText || ""));
      return achou.some((e) => {
        for (let n: HTMLElement | null = e; n; n = n.parentElement) {
          const p = getComputedStyle(n).position;
          if (p === "fixed" || p === "sticky") return true;
        }
        return false;
      });
    });
    expect(barraSolta, "a barra de fotos está fixa/sticky sobre o conteúdo").toBe(false);
    expect(await controlesCobertos(page)).toEqual([]);
    await context.close();
  });

  test("D-V3 — 'Enviar documento' do rascunho real responde e aponta o campo que falta", async ({ browser }) => {
    test.skip(!temContaVarredura("DONO17"), "sem a conta DONO17");
    test.fail(true, "D-V3: a trava da matrícula é silenciosa (não diz qual campo falta)");
    const { context, page } = await abrirComoConta(browser, "DONO17", "390");
    await abrirRota(page, `/dashboard/imoveis/${MASSA!.imovel17}/editar`);
    const botao = page.getByRole("button", { name: /enviar documento/i });
    expect(await cliqueResponde(page, botao, "Enviar documento")).toEqual([]);
    await context.close();
  });

  test("D-V4 — cartões de Meus imóveis têm miniatura carregada (ativos e rascunhos)", async ({ browser }) => {
    test.skip(!temContaVarredura("DONO17"), "sem a conta DONO17");
    test.fail(true, "D-V4: ativos sem miniatura e rascunhos com imagem quebrada");
    const { context, page } = await abrirComoConta(browser, "DONO17", "1280");
    await abrirRota(page, "/dashboard/imoveis");
    const semFoto = await page.evaluate(async () => {
      const titulos = Array.from(document.querySelectorAll("main *")).filter((e) => e.children.length === 0 && /\[Varredura\]/.test(e.textContent || ""));
      const ruins: string[] = [];
      for (const t of titulos) {
        let card: Element | null = t;
        while (card && card.tagName !== "MAIN" && !card.querySelector("img")) card = card.parentElement;
        const img = card?.querySelector("img");
        if (!img) ruins.push(`${(t.textContent || "").trim()}: sem miniatura`);
        else if (!(img.complete && img.naturalWidth > 0)) ruins.push(`${(t.textContent || "").trim()}: imagem quebrada`);
      }
      return ruins;
    });
    expect(semFoto).toEqual([]);
    await context.close();
  });

  test("D-V5 — editar anúncio publicado não mostra 'Falta para publicar' ao mesmo tempo", async ({ browser }) => {
    test.skip(!temContaVarredura("DONO17"), "sem a conta DONO17");
    test.fail(true, "D-V5: 'Anúncio publicado' e 'Falta para publicar' juntos");
    const { context, page } = await abrirComoConta(browser, "DONO17", "1280");
    await abrirRota(page, `/dashboard/imoveis/${MASSA!.imovel17}/editar`);
    const main = page.locator("main");
    const publicado = await main.getByText(/anúncio publicado/i).first().isVisible().catch(() => false);
    const falta = await main.getByText(/falta para publicar/i).first().isVisible().catch(() => false);
    expect(publicado && falta, "estado contraditório na mesma tela").toBe(false);
    await context.close();
  });

  test("D-V6 — capa de Minhas locações carrega acima da dobra", async ({ browser }) => {
    test.skip(!temContaVarredura("INQUILINA"), "sem a conta INQUILINA");
    test.fail(true, "D-V6: capa de Minhas locações não aparece/carrega");
    for (const tam of TAMANHOS) {
      const { context, page } = await abrirComoConta(browser, "INQUILINA", tam.nome);
      await abrirRota(page, "/dashboard/locacoes");
      expect(await page.locator("main img:visible").count(), `@${tam.nome}: nenhuma imagem de capa`).toBeGreaterThan(0);
      expect(await imagensAcimaDaDobra(page), `@${tam.nome}`).toEqual([]);
      await context.close();
    }
  });
});
