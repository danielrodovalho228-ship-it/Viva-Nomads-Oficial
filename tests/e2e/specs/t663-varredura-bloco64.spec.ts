import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T663 — VARREDURA DA PÁGINA INTEIRA, BLOCO 64 (Pista C, 29/10). O protocolo do bloco 21 (t385): seis classes (imagem
  vazia/quebrada, elemento fixo sobre o conteúdo, estouro horizontal, texto cortado, grade desalinhada…), página toda
  rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400. As telas do E233 (#1538, o fim do limite
  de anúncios), com um dono SEM assinatura (Gratuito) que tem 22 anúncios no ar e um rascunho — a grade cheia que o
  limite antigo nunca deixava existir:
    · Meus imóveis (sem faixa de limite), o Início do dono, o editor de um anúncio no ar e o "Novo anúncio" com anúncios
      no ar (sem "Vaga no seu plano");
    · o perfil público do dono com os 22 anúncios, visto por um visitante.
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
}

const sufixo = novoSufixo();
const senha = novaSenha();
const ids: { dono?: string; ativos: string[]; rascunho?: string } = { ativos: [] };
const EMAIL_DONO = `dono.t663.${sufixo}@lab.vivanomads.test`;
const N_ATIVOS = 22;

const TELAS: Tela[] = [
  { conta: "DONO", papel: "proprietário", nome: "Meus imóveis com 22 no ar e um rascunho, sem faixa de limite (E233)", rota: () => "/dashboard/imoveis", marca: "cartao-anuncio-link" },
  { conta: "DONO", papel: "proprietário", nome: "Início com 22 no ar (E233)", rota: () => "/dashboard", marca: "inicio-dono-principal" },
  { conta: "DONO", papel: "proprietário", nome: "Editor de um anúncio no ar (E233)", rota: () => `/dashboard/imoveis/${ids.ativos[0]}/editar`, marca: "prontidao" },
  { conta: "DONO", papel: "proprietário", nome: "Novo anúncio com 22 no ar, sem 'Vaga no seu plano' (E233)", rota: () => "/dashboard/imoveis/novo", marca: "rascunho-aviso" },
  { conta: "VISITANTE", papel: "visitante", nome: "Perfil público do dono com 22 anúncios (E233)", rota: () => `/proprietario/${ids.dono}` },
];

/** Achados já registrados como defeito de produto (L-*) ou que são o desenho pedido: ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // L-63 (Pista A + Daniel): as 7 fotos dos cartões de tipo do #1312 ainda não estão em public/images/imoveis/.
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "imagem", achado: /\/images\/imoveis\/(tipo-(casa|studio|loft|cobertura|casa-condominio|flat)|placeholder-imovel-chacara)\.webp/, l: "L-63" },
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "foto", achado: /área de foto vazia \(aspect-ratio 4 \/ 3\).*"Imagem ilustrativa"/, l: "L-63" },
  // Desenho do E248 (#1536): o "›" sólido da fileira que rola senta sobre o item da borda (t662).
  { rota: /^\/dashboard(\/|\?|$)/, classe: "fixo", achado: /coberto por button "Ver mais itens"$/, l: "E248-desenho" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const SAIDA = "tests/laboratorio/saida/varredura-bloco64";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

async function abrir(browser: Browser, t: Tela): Promise<Page> {
  if (t.conta === "DONO") return entrar(browser, EMAIL_DONO, senha);
  return (await browser.newContext()).newPage();
}

test.describe("T663 — varredura da página inteira, bloco 64 (sem limite de anúncios: dono Gratuito com 22 no ar) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    test.setTimeout(240_000);
    ids.dono = await criarConta({ email: EMAIL_DONO, nome: "Valentina Bartolomeu de Albuquerque Muitos Imóveis", role: "owner" }, senha);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"], preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    // Em lotes de 5 (como a t38), com nomes de comprimentos diferentes para a grade.
    for (let n = 1; n <= N_ATIVOS; n += 5) {
      const lote = await Promise.all(
        Array.from({ length: Math.min(5, N_ATIVOS - n + 1) }, (_, i) =>
          criarImovelPronto(ids.dono!, `[Varredura] ${(n + i) % 2 ? "Studio" :"Apartamento mobiliado com varanda gourmet e home office"} ${n + i} t663 ${sufixo}`, { ativo: true, preco: 2800 + (n + i) * 50 }),
        ),
      );
      ids.ativos.push(...lote);
    }
    for (const id of ids.ativos) await fotosReais(id, ids.dono);
    ids.rascunho = await criarImovelPronto(ids.dono, `[Varredura] Rascunho do 23º t663 ${sufixo}`, { semInternet: true });
  });
  test.afterAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    await apagarContas([ids.dono].filter((x): x is string => !!x));
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
          if (t.marca) {
            await expect.soft(page.getByTestId(t.marca).filter({ visible: true }).first(), `${t.nome} @${tam.nome}: a tela do merge aparece (${t.marca})`).toBeVisible({ timeout: 20_000 });
          }
          // E233: nenhum resto do limite de anúncios dos planos antigos.
          await expect.soft(page.locator("main").first(), `${t.nome} @${tam.nome}: sem texto do limite antigo`).not.toContainText(/Vaga no seu plano|seu plano permite|mude de plano|mudar de plano/i);
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
