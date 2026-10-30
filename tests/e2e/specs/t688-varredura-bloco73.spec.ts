import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { prepararRascunho } from "../fixtures/rascunho-cadastro";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T688 — VARREDURA DA PÁGINA INTEIRA, BLOCO 73 (Pista C, 30/10). O protocolo do bloco 21 (t385): seis classes, página
  toda rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400. As telas dos merges de hoje:
    · #1573 (E84): as páginas de tema da Ajuda (FAQ com o nome em português);
    · #1574 (E258): o Passo 5 do cadastro (cada bloco diz como grava, aviso do "por perto" sem CEP) e o Passo 10 (a
      conferência explica o opcional vazio: sem CEP, sem data de início);
    · #1575 (lint): Minha conta, com os links da Ajuda trocados por Link, nos dois papéis.
  O #1578 (0259) só traz massa de produção, sem tela. Os do E259 entram aqui quando mergearem.
  Rascunho sem CEP nem data semeado aqui e apagado no fim. Sem clique no primário. Só no laboratório.
*/
type Conta = "DONO" | "MORADOR" | "VISITANTE";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: () => string;
  /** testid que a tela tem de mostrar (a prova de que é a tela do merge, não um estado vazio); por largura quando muda. */
  marca?: string | ((largura: number) => string);
}

const sufixo = novoSufixo();
const senha = novaSenha();
const ids: Record<string, string> = {};
const EMAIL_DONO = `dono.t688.${sufixo}@lab.vivanomads.test`;
const EMAIL_MOR = `mor.t688.${sufixo}@lab.vivanomads.test`;
const BASE = { street: "Rua Santos Dumont", numero: "100", neighborhood: "Centro", city: "Uberlândia", uf: "MG", cep: "", minPeriod: "30", maxPeriod: "180", monthlyPrice: "3200", bathrooms: "1", areaM2: "40", bedrooms: "1", etapaMax: 9 };

const TELAS: Tela[] = [
  ...["morador", "proprietarios", "contratos", "seguranca"].map((tema) => ({ conta: "VISITANTE" as const, papel: "visitante", nome: `Ajuda, o tema ${tema} (#1573)`, rota: () => `/ajuda/${tema}` })),
  { conta: "DONO", papel: "proprietário", nome: "Passo 5, como cada bloco grava (#1574)", rota: () => `/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=comodidades`, marca: "passo-titulo" },
  { conta: "DONO", papel: "proprietário", nome: "Passo 10, a conferência do opcional vazio (#1574)", rota: () => `/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=revisao`, marca: "lista-conferencia" },
  { conta: "DONO", papel: "proprietário", nome: "Minha conta (#1575)", rota: () => "/dashboard/conta", marca: (l) => (l < 1024 ? "conta-menu" : "conta-menu-lateral") },
  { conta: "MORADOR", papel: "morador", nome: "Minha conta (#1575)", rota: () => "/dashboard/conta", marca: (l) => (l < 1024 ? "conta-menu" : "conta-menu-lateral") },
];

/** Achados já registrados como defeito de produto (L-*) ou que são o desenho pedido: ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // L-63 (Pista A + Daniel): as fotos dos cartões de tipo do #1312 ainda não estão em public/images/imoveis/.
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "imagem", achado: /\/images\/imoveis\/(tipo-(casa|studio|loft|cobertura|casa-condominio|flat)|placeholder-imovel-chacara)\.webp/, l: "L-63" },
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "foto", achado: /área de foto vazia \(aspect-ratio 4 \/ 3\).*"Imagem ilustrativa"/, l: "L-63" },
  // Desenho do E248 (#1536): o "›" sólido da fileira que rola senta sobre o item da borda (t662).
  { rota: /^\/dashboard(\/|\?|$)/, classe: "fixo", achado: /coberto por button "Ver mais itens"$/, l: "E248-desenho" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const SAIDA = "tests/laboratorio/saida/varredura-bloco73";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

async function abrir(browser: Browser, t: Tela): Promise<Page> {
  if (t.conta === "DONO") return entrar(browser, EMAIL_DONO, senha);
  if (t.conta === "MORADOR") return entrar(browser, EMAIL_MOR, senha);
  return (await browser.newContext()).newPage();
}

test.describe("T688 — varredura da página inteira, bloco 73 (temas da Ajuda, Passos 5 e 10 do cadastro, Minha conta) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    test.setTimeout(120_000);
    ids.dono = await criarConta({ email: EMAIL_DONO, nome: "Bia Conferencia Varredura Setenta e Tres", role: "owner" }, senha);
    ids.mor = await criarConta({ email: EMAIL_MOR, nome: "Davi Conta Varredura Setenta e Tres", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"], preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "tenant", papel_ativo: "morador" }).eq("id", ids.mor);
    // Sem CEP e sem data de início: o Passo 10 mostra as duas notas do E258 e o Passo 5, o aviso do "por perto".
    ids.rascunho = await prepararRascunho(ids.dono, `Studio sem CEP t688 ${sufixo}`, BASE);
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
          const marca = typeof t.marca === "function" ? t.marca(tam.width) : t.marca;
          if (marca) {
            await expect.soft(page.getByTestId(marca).filter({ visible: true }).first(), `${t.nome} @${tam.nome}: a tela do merge aparece (${marca})`).toBeVisible({ timeout: 20_000 });
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
