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
    (a) imagens acima da dobra carregadas sem rolar · (b) nada fixo/flutuante cobre controle que a rolagem não revela (topo e fim; régua do Muse, 21/10)
    (c) sem overflow horizontal · (d) sem erro de console/página (exceto terceiros, com motivo; prefetch, ação do servidor, arquivo e leitura (GET /api) do próprio site cancelados não contam; requisição falhada sai com tipo, método e erro do navegador) · (f) clique em botão primário responde em 3 s.
  Massa: scripts/lab/massa-varredura.mjs (contas is_teste @varredura.lab.vivanomads.test). Sem a massa, no laboratório o spec reprova (fora dele, pula).
  Defeitos já conhecidos entram como test.fail com o código D-V no comentário: ao corrigir, o test.fail vira falha e quem
  corrige o produto troca por test normal no mesmo PR. O varrer geral NÃO reprova a combinação coberta por um D-V (ela fica anotada).
  Roda no projeto chromium com viewport trocado dentro do spec (1280 e 390), porque o testMatch do projeto app-mobile
  mora em playwright.config.ts, fora do escopo desta ordem.
*/
const MASSA = lerMassa();
/**
  No laboratório, faltar a massa é FALHA, não pulo: até 21/10 nenhum workflow rodava massa-varredura.mjs e a t249 saiu
  "pulada" nas 19 execuções registradas em lab_execucoes — verde sem varrer tela nenhuma. Fora do laboratório, pula.
*/
function exigirMassa(): void {
  expect(MASSA, "laboratório sem a massa da varredura: o passo `node scripts/lab/massa-varredura.mjs` não rodou ou falhou (ver o log do workflow)").not.toBeNull();
}

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
  // Telas tocadas pelos PRs de 21–22/10 (#997, #998, #1006, #1010–#1014): entram na varredura permanente.
  { conta: null, rota: () => "/cidades/uberlandia", nome: "Cidade" },
  { conta: null, rota: () => "/como-funciona", nome: "Como funciona" },
  { conta: null, rota: () => "/parceiros", nome: "Parceiros" },
  { conta: null, rota: () => "/auth", nome: "Entrar" },
  { conta: null, rota: () => "/pedidos/novo", nome: "Pedido de moradia" },
  { conta: "DONO17", rota: () => "/dashboard/ferramentas", nome: "Ferramentas do dono" },
  { conta: "DONO17", rota: () => "/dashboard/carteira", nome: "Carteira do dono" },
  { conta: "INQUILINA", rota: () => "/dashboard/favoritos", nome: "Favoritos" },
  { conta: "INQUILINA", rota: () => "/dashboard/buscas", nome: "Buscas salvas" },
  { conta: "INQUILINA", rota: (m) => `/dashboard/estadia/${m.contrato}`, nome: "Estadia (contrato completo)" },
  // Telas tocadas pelo #1038 (Prompt 43, conta única e fluxos de perfil), 22/10: entram na varredura permanente.
  { conta: "INQUILINA", rota: () => "/dashboard/conta/perfil", nome: "Conta · perfil" },
  { conta: "INQUILINA", rota: () => "/dashboard/pedidos", nome: "Meus pedidos" },
  { conta: "INQUILINA", rota: () => "/dashboard/mensagens", nome: "Mensagens" },
];

/** Combinações (tela × tamanho × critério) cobertas por um defeito conhecido: o varrer geral só anota. */
const ESPERADAS: Record<string, string> = {
  // Rodada 1 (lab-crítico do #984, 21/10): D-V1, D-V2, D-V4 e D-V6 passaram nas duas tentativas e viraram teste normal.
  // D-V3 e D-V5 não têm combinação no varrer geral (são verificados só no bloco "defeitos conhecidos").
  // D-V7 corrigido no #1028 (título em texto quando o anúncio não está no ar): a combinação voltou a reprovar.
  // D-V8 (lab-crítico do #1023, 22/10): /auth não tem <main>; a abertura acusa "sem <main> em 20 s" no critério c.
  "Entrar|390|c-overflow": "D-V8",
  "Entrar|1280|c-overflow": "D-V8",
};

type Linha = { tela: string; tamanho: string; criterio: string; resultado: string };
const relatorio: Linha[] = [];
const excecoes = new Set<string>();
const inicio = Date.now();

test.describe("T249 — varredura visual (tela × tamanho × critério)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (Supabase local + integrações simuladas)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do spec)");
    exigirMassa();
  });

  test.afterAll(() => {
    const seg = Math.round((Date.now() - inicio) / 1000);
    const cab = "| Tela | Tamanho | Critério | Resultado |\n|---|---|---|---|\n";
    const corpo = relatorio.map((l) => `| ${l.tela} | ${l.tamanho} | ${l.criterio} | ${l.resultado} |`).join("\n");
    const ex = [...excecoes].map((e) => `- ${e}`).join("\n") || "- nenhuma";
    mkdirSync("tests/laboratorio/saida", { recursive: true });
    writeFileSync("tests/laboratorio/saida/varredura-relatorio.md", `# Varredura visual (t249)\n\n${cab}${corpo}\n\n## Exceções ignoradas no critério d (terceiros e cancelamentos do navegador)\n${ex}\n\nTempo da spec: ${seg} s (alvo < 360 s)\n`);
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
  REGRESSÕES IMEDIATAS. Cada uma afirma o comportamento CERTO; as que ainda têm test.fail falham hoje (esperado).
  Quem corrigir o produto remove o `test.fail` no mesmo PR (o Playwright avisa quando passa sozinho).
*/
test.describe("T249 — defeitos conhecidos (D-V)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (Supabase local + integrações simuladas)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "só chromium");
    exigirMassa();
  });

  test("D-V1 — imagens acima da dobra do anúncio de 17 fotos carregam sem rolar (lazy-load)", async ({ browser }) => {
    for (const tam of TAMANHOS) {
      const ctx = await browser.newContext({ viewport: { width: tam.width, height: tam.height } });
      const page = await ctx.newPage();
      await abrirRota(page, `/imoveis/${MASSA!.imovel17}`);
      expect(await imagensAcimaDaDobra(page), `@${tam.nome}`).toEqual([]);
      await ctx.close();
    }
  });

  test("D-V2 — a barra 'Fotos: 0 de 8' não cobre controle que a rolagem não revela (cadastro, 390 px)", async ({ browser }) => {
    test.skip(!temContaVarredura("DONO0"), "sem a conta DONO0");
    const { context, page } = await abrirComoConta(browser, "DONO0", "390");
    // A barra é fixa de propósito na etapa de Fotos (290742ca: encosta no fim da tela). Vale a régua do Muse (21/10):
    // só é defeito o controle que ela cobre e a rolagem não revela. A etapa vai pelo nome: sem ela, o rascunho abria
    // onde outra spec o deixou e o teste passava ou não conforme a ordem da suíte (lab de b1385f6, 22/10).
    await abrirRota(page, `/dashboard/imoveis/novo?draft=${MASSA!.rascunho0}&etapa=fotos`);
    await expect(page.getByTestId("barra-fotos")).toBeVisible();
    expect(await controlesCobertos(page)).toEqual([]);
    await context.close();
  });

  test("D-V3 — 'Enviar documento' do rascunho real responde e aponta o campo que falta", async ({ browser }) => {
    test.skip(!temContaVarredura("DONO17"), "sem a conta DONO17");
    // L1-1: corrigido. O botão fica no passo Onde fica do assistente (o editor por seções não tem documento); o
    // rascunho da massa só tem o bairro, então o toque diz o que falta e leva ao 1º campo.
    const { context, page } = await abrirComoConta(browser, "DONO17", "390");
    await abrirRota(page, `/dashboard/imoveis/novo?draft=${MASSA!.rascunho1}&etapa=onde`);
    const botao = page.getByRole("button", { name: /enviar documento/i });
    await expect(botao).toBeVisible({ timeout: 20_000 });
    expect(await cliqueResponde(page, botao, "Enviar documento")).toEqual([]);
    await expect(page.getByTestId("documento-falta")).toHaveText("Falta: CEP, rua e número");
    await expect(page.getByTestId("cadastro-cep")).toBeFocused();
    await expect(page.getByTestId("cadastro-cep")).toHaveAttribute("aria-invalid", "true");
    await context.close();
  });

  test("D-V4 — cartões de Meus imóveis têm miniatura carregada (ativos e rascunhos)", async ({ browser }) => {
    test.skip(!temContaVarredura("DONO17"), "sem a conta DONO17");
    const { context, page } = await abrirComoConta(browser, "DONO17", "1280");
    await abrirRota(page, "/dashboard/imoveis");
    // As miniaturas carregam depois da tela: espera até 5 s, como imagensAcimaDaDobra (lab de 22/10: "imagem quebrada"
    // na 1ª leitura às 02h42, 05h07 e no lab-crítico do #1040, sempre resolvida no retry).
    const medir = () => page.evaluate(async () => {
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
    await expect.poll(medir, { timeout: 5_000, intervals: [250] }).toEqual([]);
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

  // Prompt 42 (#1014, 22/10): as telas logadas perderam a capa de foto de propósito. D-V6 segue valendo para o que
  // sobrou: toda imagem acima da dobra de Minhas locações carrega sem rolar.
  test("D-V6 — imagens de Minhas locações carregam acima da dobra", async ({ browser }) => {
    test.skip(!temContaVarredura("INQUILINA"), "sem a conta INQUILINA");
    for (const tam of TAMANHOS) {
      const { context, page } = await abrirComoConta(browser, "INQUILINA", tam.nome);
      await abrirRota(page, "/dashboard/locacoes");
      expect(await imagensAcimaDaDobra(page), `@${tam.nome}`).toEqual([]);
      await context.close();
    }
  });

  test("D-V7 — Meus imóveis não aponta rascunho para a página pública (404)", async ({ browser }) => {
    test.skip(!temContaVarredura("DONO17"), "sem a conta DONO17");
    const { context, page } = await abrirComoConta(browser, "DONO17", "1280");
    const naoAchados: string[] = [];
    page.on("response", (r) => {
      if (r.status() === 404 && /\/imoveis\/[0-9a-f-]{36}/.test(new URL(r.url()).pathname)) naoAchados.push(new URL(r.url()).pathname);
    });
    await abrirRota(page, "/dashboard/imoveis");
    await page.waitForTimeout(1_500); // o pré-carregamento dos links acontece logo depois da tela assentar
    const rascunho = page.locator("main a", { hasText: "[Varredura] Rascunho com 1 foto" });
    const destino = (await rascunho.count()) > 0 ? await rascunho.first().getAttribute("href") : null;
    expect({ linkDoRascunho: destino, paginas404: [...new Set(naoAchados)] }).toEqual({ linkDoRascunho: null, paginas404: [] });
    await context.close();
  });

  test("D-V8 — a tela de entrar tem um <main> (marco principal para leitor de tela)", async ({ browser }) => {
    test.fail(true, "D-V8: /auth monta só uma <div> em grade, sem <main>");
    for (const tam of TAMANHOS) {
      const ctx = await browser.newContext({ viewport: { width: tam.width, height: tam.height } });
      const page = await ctx.newPage();
      await page.goto("/auth", { waitUntil: "domcontentloaded" });
      await page.locator("form").first().waitFor({ timeout: 20_000 });
      expect(await page.locator("main").count(), `@${tam.nome}`).toBe(1);
      await ctx.close();
    }
  });
});
