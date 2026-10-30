import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T674 — VARREDURA DA PÁGINA INTEIRA, BLOCO 68 (Pista C, 30/10). O protocolo do bloco 21 (t385): seis classes, página
  toda rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400. As telas do painel varridas há mais
  tempo (blocos 4, 6, 12 e 16), revistas sobre o topo, as barras e o rodapé de hoje:
    · proprietário: Tributação, Retorno do imóvel, Indicações, Serviços, Simulador e o Desempenho do anúncio;
    · morador: Serviços, Reembolsos e Carteira.
  /dashboard/viabilidade fica de fora: hoje redireciona para /dashboard/roi-imovel (coberta aqui).
  Sem clique no primário. Semeado aqui e apagado no fim. Só no laboratório.
*/
type Conta = "DONO" | "MORADOR";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: () => string;
}

const sufixo = novoSufixo();
const senha = novaSenha();
const ids: Record<string, string> = {};
const EMAIL_DONO = `dono.t674.${sufixo}@lab.vivanomads.test`;
const EMAIL_MOR = `mor.t674.${sufixo}@lab.vivanomads.test`;

const TELAS: Tela[] = [
  { conta: "DONO", papel: "proprietário", nome: "Tributação", rota: () => "/dashboard/tributacao" },
  { conta: "DONO", papel: "proprietário", nome: "Retorno do imóvel", rota: () => "/dashboard/roi-imovel" },
  { conta: "DONO", papel: "proprietário", nome: "Indicações", rota: () => "/dashboard/indicacoes" },
  { conta: "DONO", papel: "proprietário", nome: "Serviços", rota: () => "/dashboard/servicos" },
  { conta: "DONO", papel: "proprietário", nome: "Simulador", rota: () => "/dashboard/simulador" },
  { conta: "DONO", papel: "proprietário", nome: "Desempenho do anúncio", rota: () => `/dashboard/imoveis/${ids.imovel}/desempenho` },
  { conta: "MORADOR", papel: "morador", nome: "Serviços", rota: () => "/dashboard/servicos" },
  { conta: "MORADOR", papel: "morador", nome: "Reembolsos", rota: () => "/dashboard/reembolsos" },
  { conta: "MORADOR", papel: "morador", nome: "Carteira", rota: () => "/dashboard/carteira" },
];

/** Achados já registrados como defeito de produto (L-*) ou que são o desenho pedido: ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // Desenho do E248 (#1536): o "›" sólido da fileira que rola senta sobre o item da borda (t662).
  { rota: /^\/dashboard(\/|\?|$)/, classe: "fixo", achado: /coberto por button "Ver mais itens"$/, l: "E248-desenho" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const SAIDA = "tests/laboratorio/saida/varredura-bloco68";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

async function abrir(browser: Browser, t: Tela): Promise<Page> {
  return entrar(browser, t.conta === "DONO" ? EMAIL_DONO : EMAIL_MOR, senha);
}

test.describe("T674 — varredura da página inteira, bloco 68 (ferramentas do proprietário, desempenho, serviços, reembolsos e carteira do morador) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    test.setTimeout(120_000);
    ids.dono = await criarConta({ email: EMAIL_DONO, nome: "Otávio Ferramentas Varredura Sessenta e Oito", role: "owner" }, senha);
    ids.mor = await criarConta({ email: EMAIL_MOR, nome: "Rosa Carteira Varredura Sessenta e Oito", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "tenant", papel_ativo: "morador" }).eq("id", ids.mor);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"], preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, `[Varredura] Apartamento com nome comprido para o desempenho t674 ${sufixo}`, { ativo: true });
    await fotosReais(ids.imovel, ids.dono);
  });
  test.afterAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    await apagarContas([ids.dono, ids.mor].filter(Boolean));
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      const relatorio: Record<string, Record<string, string[]>> = {};
      mkdirSync(SAIDA, { recursive: true });
      for (const tam of TAMANHOS) {
        const rota = t.rota();
        const page = await abrir(browser, t);
        await page.setViewportSize({ width: tam.width, height: tam.height });
        try {
          const respostas = escutarImagens(page);
          const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
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
          await page.screenshot({ path: `${SAIDA}/${slug(`${t.papel}-${t.nome}`)}-${tam.width}.png`, fullPage: true }).catch(() => {});
          relatorio[tam.nome] = achados;
        } finally {
          await page.context().close();
        }
      }
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
