import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T673 — VARREDURA DA PÁGINA INTEIRA, BLOCO 67 (Pista C, 30/10). O protocolo do bloco 21 (t385): seis classes, página
  toda rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400. As telas dos merges depois do bloco 66:
    · E84 (#1555): o hub da Central de Ajuda e a página própria de cada tema (/ajuda/morador, /proprietarios,
      /contratos, /seguranca);
    · E255 (#1556): Ganhos com o "Você entra na regra nova?" (chave ENQUADRAMENTO_REFORMA; no laboratório o cookie
      vn_lab_reforma liga só neste navegador, como na t674-e255);
    · E235 (#1553): a página "Nível, ruído e extras" do imóvel, com o bloco de avaliação do dono (conta de teste).
  Sem clique no primário. Semeado aqui e apagado no fim. Só no laboratório.
*/
type Conta = "DONO" | "VISITANTE";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: () => string;
  /** testid que a tela tem de mostrar (a prova de que é a tela do merge, não um estado vazio). */
  marca?: string;
  /** Liga a chave do laboratório (cookie) antes de abrir. */
  cookieReforma?: boolean;
}

const sufixo = novoSufixo();
const senha = novaSenha();
const ids: Record<string, string> = {};
const EMAIL_DONO = `dono.t673.${sufixo}@lab.vivanomads.test`;

const TELAS: Tela[] = [
  { conta: "VISITANTE", papel: "visitante", nome: "Central de Ajuda, o hub (E84)", rota: () => "/ajuda" },
  ...["morador", "proprietarios", "contratos", "seguranca"].map((tema) => ({ conta: "VISITANTE" as const, papel: "visitante", nome: `Ajuda, o tema ${tema} (E84)`, rota: () => `/ajuda/${tema}` })),
  { conta: "DONO", papel: "proprietário", nome: "Ganhos com o enquadramento da reforma (E255)", rota: () => "/dashboard/ganhos", marca: "enquadramento-reforma", cookieReforma: true },
  { conta: "DONO", papel: "proprietário", nome: "Nível, ruído e extras do imóvel (E235)", rota: () => `/dashboard/imoveis/${ids.imovel}/nivel` },
];

/** Achados já registrados como defeito de produto (L-*) ou que são o desenho pedido: ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // Desenho do E248 (#1536): o "›" sólido da fileira que rola senta sobre o item da borda (t662).
  { rota: /^\/dashboard(\/|\?|$)/, classe: "fixo", achado: /coberto por button "Ver mais itens"$/, l: "E248-desenho" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const SAIDA = "tests/laboratorio/saida/varredura-bloco67";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

async function abrir(browser: Browser, t: Tela): Promise<Page> {
  if (t.conta === "DONO") return entrar(browser, EMAIL_DONO, senha);
  return (await browser.newContext()).newPage();
}

test.describe("T673 — varredura da página inteira, bloco 67 (temas da Ajuda, enquadramento da reforma, nível do imóvel) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    test.setTimeout(120_000);
    ids.dono = await criarConta({ email: EMAIL_DONO, nome: "Iara Carteira Varredura Sessenta e Sete", role: "owner" }, senha);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"], preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, `[Varredura] Apartamento com nome comprido para o nível t673 ${sufixo}`, { ativo: true });
    await fotosReais(ids.imovel, ids.dono);
  });
  test.afterAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    await apagarContas([ids.dono].filter(Boolean));
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser, baseURL }) => {
      test.setTimeout(180_000);
      const relatorio: Record<string, Record<string, string[]>> = {};
      mkdirSync(SAIDA, { recursive: true });
      for (const tam of TAMANHOS) {
        const rota = t.rota();
        const page = await abrir(browser, t);
        if (t.cookieReforma) await page.context().addCookies([{ name: "vn_lab_reforma", value: "1", url: new URL(baseURL ?? page.url()).origin }]);
        await page.setViewportSize({ width: tam.width, height: tam.height });
        try {
          const respostas = escutarImagens(page);
          const resposta = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela (login ou redirecionamento)`).toBe(rota.split(/[?#]/)[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          if (t.marca) {
            await expect.soft(page.getByTestId(t.marca).filter({ visible: true }).first(), `${t.nome} @${tam.nome}: a tela do merge aparece (${t.marca})`).toBeVisible({ timeout: 20_000 });
          }
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
