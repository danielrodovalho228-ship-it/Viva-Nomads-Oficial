import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type BrowserContext } from "@playwright/test";
import { NO_LABORATORIO, entrar } from "../fixtures/laboratorio";
import { lerMassa, temContaVarredura, type ChaveConta, type Massa } from "../fixtures/varredura";
import { VAO_MAXIMO, medirVao, type MedidaVao } from "../fixtures/vao-rodape";

/*
  T310 — VÃO DE FIM DE PÁGINA (Pista C, 23/10; relay do Muse: o Daniel fotografou no celular um vão branco gigante no
  fim da página do imóvel). Em celular (390×844) e tablet (820×1180), os dois com toque, mede em cada página a distância
  entre o fim do último conteúdo visível do <main> e o topo do <footer> (sem rodapé, o fim do documento, descontado o
  que fica atrás dos fixos do pé da tela). Reprova acima de 64 px. Elemento fixo (barra do imóvel, botões flutuantes,
  abas) não conta como conteúdo, mas também não pode cobrir o último clicável quando a página está rolada até o fim.
  Medida em fixtures/vao-rodape.ts. Relatório por página e tamanho em tests/laboratorio/saida/vao-rodape/ e nas linhas
  "VAO|…" do log. Catraca: o que já passa de 64 px está em CONHECIDOS (L-23, L-24, L-25, Pista A), por página e
  tamanho, e só é medido; quem corrigir tira a entrada de CONHECIDOS no mesmo PR e ela vira portão. Só no laboratório (imóvel e contas da massa).
*/
const TAMANHOS = [
  { nome: "celular", width: 390, height: 844 },
  { nome: "tablet", width: 820, height: 1180 },
] as const;
type Conta = ChaveConta | "VISITANTE";
interface Pagina {
  conta: Conta;
  nome: string;
  rota: (m: Massa) => string;
}
const ABAS_IMOVEL = [
  ["visao-geral", "Visão geral"],
  ["comodidades", "Comodidades"],
  ["localizacao", "Localização"],
  ["avaliacoes", "Avaliações"],
  ["proprietario", "Proprietário"],
] as const;
const PAGINAS: Pagina[] = [
  { conta: "VISITANTE", nome: "Início", rota: () => "/" },
  { conta: "VISITANTE", nome: "Buscar", rota: () => "/buscar" },
  ...ABAS_IMOVEL.map(([ancora, nome]) => ({ conta: "VISITANTE" as const, nome: `Imóvel · ${nome}`, rota: (m: Massa) => `/imoveis/${m.imovel17}#${ancora}` })),
  { conta: "VISITANTE", nome: "Perfil do proprietário", rota: (m) => `/proprietario/${m.ids.DONO17}` },
  { conta: "VISITANTE", nome: "Novo pedido de moradia", rota: () => "/pedidos/novo" },
  { conta: "VISITANTE", nome: "Ajuda", rota: () => "/ajuda" },
  { conta: "DONO17", nome: "Painel do dono", rota: () => "/dashboard" },
  { conta: "DONO17", nome: "Pedidos (dono)", rota: () => "/pedidos" },
  { conta: "DONO17", nome: "Recibos", rota: () => "/dashboard/recibos" },
  { conta: "DONO17", nome: "Nível, ruído e extras", rota: (m) => `/dashboard/imoveis/${m.imovel17}/nivel` },
  { conta: "INQUILINA", nome: "Painel do morador", rota: () => "/dashboard" },
];
// Catraca: página → código e tamanhos já acima de 64 px (lab-crítico do #1124, 23/10). Nesses tamanhos a spec mede e
// anota sem reprovar; nos outros, e em qualquer página fora daqui, é portão. Quem corrigir tira a entrada no mesmo PR.
// L-23, L-24 e L-25 corrigidos pela Pista A (claude-a/vao-fim-pagina): sem entradas, todas as páginas são portão.
const CONHECIDOS: Record<string, { codigo: string; tamanhos: string[] }> = {};

const MASSA = lerMassa();
const SAIDA = "tests/laboratorio/saida/vao-rodape";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

// Uma sessão por conta e por worker: entra pela tela uma vez e reaproveita o estado nos contextos com toque.
const sessoes = new Map<string, Awaited<ReturnType<BrowserContext["storageState"]>>>();
async function contexto(browser: Browser, conta: Conta, tam: (typeof TAMANHOS)[number]) {
  const base = { viewport: { width: tam.width, height: tam.height }, isMobile: true, hasTouch: true };
  if (conta === "VISITANTE") return browser.newContext({ ...base, storageState: { cookies: [], origins: [] } });
  if (!sessoes.has(conta)) {
    const p = await entrar(browser, process.env[`TESTES_VARREDURA_${conta}_EMAIL`]!, process.env[`TESTES_VARREDURA_${conta}_SENHA`]!);
    sessoes.set(conta, await p.context().storageState());
    await p.context().close();
  }
  return browser.newContext({ ...base, storageState: sessoes.get(conta) });
}

test.describe("T310 — vão de fim de página (celular 390 e tablet 820, com toque)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (imóvel e contas da massa da varredura)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });

  for (const p of PAGINAS) {
    test(`${p.nome}: vão até o rodapé ≤ ${VAO_MAXIMO} px e nada fixo sobre o último clicável`, async ({ browser }) => {
      test.setTimeout(150_000);
      test.skip(p.conta !== "VISITANTE" && !temContaVarredura(p.conta), `sem a conta ${p.conta} na massa`);
      const rota = p.rota(MASSA!);
      const catraca = CONHECIDOS[p.nome];
      const relatorio: Record<string, MedidaVao> = {};
      for (const tam of TAMANHOS) {
        const ctx = await contexto(browser, p.conta, tam);
        try {
          const page = await ctx.newPage();
          await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(new URL(page.url()).pathname, `${p.nome} @${tam.nome}: caiu no login`).not.toMatch(/^\/auth/);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
          const m = await medirVao(page);
          relatorio[tam.nome] = m;
          const conhecido = catraca?.tamanhos.includes(tam.nome) ? catraca.codigo : undefined;
          const rotulo = rota.replace(/[0-9a-f-]{36}/g, ":id");
          console.log(`VAO|${tam.nome}|${rotulo}|${m.vao} px|${m.ultimo} → ${m.fim}${m.coberto ? `|COBERTO: ${m.coberto}` : ""}${conhecido ? `|conhecido ${conhecido}` : ""}`);
          if (m.vao > VAO_MAXIMO || m.coberto) {
            mkdirSync(SAIDA, { recursive: true });
            await page.screenshot({ path: `${SAIDA}/${slug(p.nome)}-${tam.nome}.png` });
          }
          if (conhecido) {
            test.info().annotations.push({ type: conhecido, description: `${tam.nome}: vão de ${m.vao} px (${m.ultimo})` });
            continue;
          }
          await test.step(`vão @${tam.nome}`, async () => {
            expect.soft(m.vao, `${p.nome} @${tam.nome}: vão de ${m.vao} px entre ${m.ultimo} e o ${m.fim}`).toBeLessThanOrEqual(VAO_MAXIMO);
          });
          await test.step(`fixos @${tam.nome}`, async () => {
            expect.soft(m.coberto, `${p.nome} @${tam.nome}: fixo sobre o último clicável (${m.fixos.join(", ")})`).toBeNull();
          });
        } finally {
          await ctx.close();
        }
      }
      mkdirSync(SAIDA, { recursive: true });
      writeFileSync(`${SAIDA}/${slug(p.nome)}.json`, JSON.stringify({ pagina: p.nome, rota, conhecido: catraca ?? null, medidas: relatorio }, null, 2));
    });
  }
});
