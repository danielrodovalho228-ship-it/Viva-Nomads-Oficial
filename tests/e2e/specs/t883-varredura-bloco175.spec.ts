import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { TAMANHOS, abrirComoConta, escutarErros, lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T883 — VARREDURA DA PÁGINA INTEIRA, BLOCO 175 (Pista C, 01/11), 7ª volta do ciclo. O protocolo do bloco 21 (t385):
  seis classes (imagem pelo carregamento real, elemento fixo sobre conteúdo, cartão sem foto, estouro horizontal, texto
  cortado, grade), página toda rolada, 390 e 1280 px, HTTP abaixo de 400; e o console (erro de console ou de página,
  régua da t249) no relatório. As telas varridas há mais tempo depois dos blocos 173/174 (registro de cobertura: última
  varredura no bloco 160, t858):
   - painel com id na URL, pela massa da varredura: contrato, imóvel (cartão, conforto, desempenho, nível, parceiros) e
     estadia do DONO17; locação e as telas da estadia da INQUILINA;
   - sócios: /acesso-socios (a porta) e as páginas internas (sem /tributario, que redireciona desde o #1793), pela porta
     com o código do laboratório (sem ele, pula);
   - autenticação, como visitante: /auth, /auth/reset, /auth/verificar-codigo e /auth/pronto.
  Defeito novo entra como test.fail ligado a um item (L-84 / D-V11 são os próximos livres).
*/
type Conta = ChaveConta | "VISITANTE" | "SOCIO";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: (m: Massa) => string;
}

const TELAS: Tela[] = [
  // Painel com id — proprietário.
  { conta: "DONO17", papel: "proprietário", nome: "Contrato", rota: (m) => `/dashboard/contratos/${m.contrato}` },
  { conta: "DONO17", papel: "proprietário", nome: "Cartão do imóvel", rota: (m) => `/dashboard/imoveis/${m.imovel17}/cartao` },
  { conta: "DONO17", papel: "proprietário", nome: "Conforto do imóvel", rota: (m) => `/dashboard/imoveis/${m.imovel17}/conforto` },
  { conta: "DONO17", papel: "proprietário", nome: "Desempenho do imóvel", rota: (m) => `/dashboard/imoveis/${m.imovel17}/desempenho` },
  { conta: "DONO17", papel: "proprietário", nome: "Nível do imóvel", rota: (m) => `/dashboard/imoveis/${m.imovel17}/nivel` },
  { conta: "DONO17", papel: "proprietário", nome: "Parceiros do imóvel", rota: (m) => `/dashboard/imoveis/${m.imovel17}/parceiros` },
  { conta: "DONO17", papel: "proprietário", nome: "Estadia", rota: (m) => `/dashboard/estadia/${m.contrato}` },
  { conta: "DONO17", papel: "proprietário", nome: "Mensagens da estadia", rota: (m) => `/dashboard/estadia/${m.contrato}/mensagens` },
  // Painel com id — morador.
  { conta: "INQUILINA", papel: "morador", nome: "Locação", rota: (m) => `/dashboard/locacoes/${m.contrato}` },
  { conta: "INQUILINA", papel: "morador", nome: "Pedir alteração da estadia", rota: (m) => `/dashboard/estadia/${m.contrato}/alteracao` },
  { conta: "INQUILINA", papel: "morador", nome: "Estadia confirmada", rota: (m) => `/dashboard/estadia/${m.contrato}/confirmada` },
  { conta: "INQUILINA", papel: "morador", nome: "Encerrar estadia", rota: (m) => `/dashboard/estadia/${m.contrato}/encerrar` },
  { conta: "INQUILINA", papel: "morador", nome: "Ocupantes da estadia", rota: (m) => `/dashboard/estadia/${m.contrato}/ocupantes` },
  // Sócios.
  { conta: "VISITANTE", papel: "visitante", nome: "Porta dos sócios", rota: () => "/acesso-socios" },
  ...[
    ["Início dos sócios", "/socios"],
    ["Decisão", "/decisao"],
    ["Modelo de negócio", "/modelodenegocio"],
    ["Retorno", "/roi"],
    ["Simulação", "/simulacao"],
    // E292-bis (#1793): /tributario saiu (redireciona para /dashboard/ferramentas), como na t307.
  ].map(([nome, rota]) => ({ conta: "SOCIO" as const, papel: "sócio", nome, rota: () => rota })),
  // Autenticação.
  ...[
    ["Entrar", "/auth"],
    ["Redefinir senha", "/auth/reset"],
    ["Verificar código", "/auth/verificar-codigo"],
    ["Conta pronta", "/auth/pronto"],
  ].map(([nome, rota]) => ({ conta: "VISITANTE" as const, papel: "visitante", nome, rota: () => rota })),
];

/** Achados já registrados como defeito de produto (L-*) ou que são o desenho pedido: ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // Desenho do E248 (#1536): o "›" sólido da fileira que rola senta sobre o item da borda (t662).
  { rota: /^\/dashboard(\/|\?|$)/, classe: "fixo", achado: /coberto por button "Ver mais itens"$/, l: "E248-desenho" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const CODIGO_SOCIOS = process.env.SOCIOS_ACCESS_CODE;
const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/varredura-bloco175";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

test.describe("T883 — varredura da página inteira, bloco 175 (7ª volta: painel com id, sócios e autenticação) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      test.skip(t.conta !== "VISITANTE" && t.conta !== "SOCIO" && !temContaVarredura(t.conta), `sem a conta ${t.conta} na massa`);
      test.skip(t.conta === "SOCIO" && !CODIGO_SOCIOS, "SOCIOS_ACCESS_CODE não definido neste ambiente");
      const rota = t.rota(MASSA!);
      const rotulo = rota.replace(/[0-9a-f-]{36}/g, ":id");
      const relatorio: Record<string, Record<string, string[]>> = {};
      mkdirSync(SAIDA, { recursive: true });
      for (const tam of TAMANHOS) {
        let page: Page;
        if (t.conta === "VISITANTE" || t.conta === "SOCIO") {
          const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: tam.width, height: tam.height } });
          page = await ctx.newPage();
          if (t.conta === "SOCIO") {
            // A porta única dos sócios: o código grava o cookie vn_socios e devolve para a página pedida (como na t307).
            await page.goto(`/acesso-socios?next=${encodeURIComponent(rota)}`, { waitUntil: "domcontentloaded", timeout: 40_000 });
            await page.locator('input[name="codigo"]').fill(CODIGO_SOCIOS!);
            await page.getByRole("button", { name: "Entrar" }).click();
            await page.waitForURL((u) => u.pathname === rota, { timeout: 30_000 });
          }
        } else {
          page = (await abrirComoConta(browser, t.conta, tam.nome)).page;
        }
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
          await page.screenshot({ path: `${SAIDA}/${slug(`${t.papel}-${t.nome}`)}-${tam.width}.png`, fullPage: true }).catch(() => {});
          const consoleErros = erros.lista();
          await test.step(`console @${tam.nome}`, async () => {
            for (const a of consoleErros) console.log(`VARREDURA|console|${tam.nome}|${t.papel}|${rotulo}|${a}`);
            expect.soft(consoleErros, `${t.papel} — ${t.nome} @${tam.nome} — console: erro de console ou de página`).toEqual([]);
          });
          relatorio[tam.nome] = { ...achados, console: consoleErros };
        } finally {
          await page.context().close();
        }
      }
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
