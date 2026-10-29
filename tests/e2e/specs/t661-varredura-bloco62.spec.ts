import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T661 — VARREDURA DA PÁGINA INTEIRA, BLOCO 62 (Pista C, 29/10). O protocolo do bloco 21 (t385): seis classes, página
  toda rolada, carregamento real de cada imagem, 390 e 1280 px, HTTP abaixo de 400. As telas dos merges depois do bloco 61:
    · E238 (#1530): a Conta no celular ("Conta" uma vez só);
    · E239 (#1530): o Início do dono com os próximos passos (ícones feito / da vez / cadeado), com um rascunho pela metade;
    · #1532: o assistente de cadastro com o estado do rascunho na linha do selo (passo 1 e passo da descrição);
    · E236 (#1524): /precos (com a janela do Plano Gestor fechada), /parceiros, /termos e a página dos sócios
      /modelodenegocio (pela porta /acesso-socios com o código do laboratório; sem ele, pula só essa tela).
  O L-76 (rótulo "31+ · Plano Gestor" na tabela de /precos) é de texto, não de layout: fica na t659.
  Sem clique no primário. Semeado aqui e apagado no fim. Só no laboratório.
*/
type Conta = "DONO" | "PUBLICO" | "SOCIO";
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
const ids: Record<string, string> = {};
const EMAIL_DONO = `dono.t661.${sufixo}@lab.vivanomads.test`;
const CODIGO_SOCIOS = process.env.SOCIOS_ACCESS_CODE;

const TELAS: Tela[] = [
  { conta: "DONO", papel: "proprietário", nome: "Conta, 'Conta' uma vez (E238)", rota: () => "/dashboard/conta", marca: "conta-menu" },
  { conta: "DONO", papel: "proprietário", nome: "Início com os próximos passos do rascunho (E239)", rota: () => "/dashboard", marca: "inicio-dono-passos" },
  { conta: "DONO", papel: "proprietário", nome: "Cadastro, passo 1 com o estado na linha do selo (#1532)", rota: () => `/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=tipo`, marca: "passo-titulo" },
  { conta: "DONO", papel: "proprietário", nome: "Cadastro, passo da descrição (#1532)", rota: () => `/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=descricao`, marca: "cadastro-descricao" },
  { conta: "PUBLICO", papel: "visitante", nome: "Preços com a tabela de faixas (E236)", rota: () => "/precos", marca: "plano-gestor-botao" },
  { conta: "PUBLICO", papel: "visitante", nome: "Parceiros (E236)", rota: () => "/parceiros" },
  { conta: "PUBLICO", papel: "visitante", nome: "Termos (E236)", rota: () => "/termos" },
  { conta: "SOCIO", papel: "sócio", nome: "Modelo de negócio (E236)", rota: () => "/modelodenegocio" },
];

/** Achados já registrados como defeito de produto (L-*): ficam anotados e não derrubam o teste. */
const CONHECIDOS: { rota: RegExp; achado: RegExp; l: string; classe?: Classe }[] = [
  // L-63 (Pista A + Daniel): as 7 fotos dos cartões de tipo do #1312 ainda não estão em public/images/imoveis/.
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "imagem", achado: /\/images\/imoveis\/(tipo-(casa|studio|loft|cobertura|casa-condominio|flat)|placeholder-imovel-chacara)\.webp/, l: "L-63" },
  { rota: /^\/dashboard\/imoveis\/novo(\?|$)/, classe: "foto", achado: /área de foto vazia \(aspect-ratio 4 \/ 3\).*"Imagem ilustrativa"/, l: "L-63" },
];
const conhecido = (rotulo: string, a: string, classe?: Classe) => CONHECIDOS.find((c) => c.classe === classe && c.rota.test(rotulo) && c.achado.test(a));

const SAIDA = "tests/laboratorio/saida/varredura-bloco62";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

async function abrir(browser: Browser, t: Tela): Promise<Page> {
  if (t.conta === "DONO") return entrar(browser, EMAIL_DONO, senha);
  const page = await (await browser.newContext()).newPage();
  if (t.conta === "SOCIO") {
    await page.goto(`/acesso-socios?next=${encodeURIComponent(t.rota())}`, { waitUntil: "domcontentloaded" });
    await page.locator('input[name="codigo"]').fill(CODIGO_SOCIOS!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(new RegExp(`${t.rota()}$`), { timeout: 20_000 });
  }
  return page;
}

test.describe("T661 — varredura da página inteira, bloco 62 (Conta e próximos passos, cadastro sem pulo, Plano Gestor a partir de 20) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default" });
  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    test.setTimeout(120_000);
    ids.dono = await criarConta({ email: EMAIL_DONO, nome: "Dora Passos Varredura Bloco Sessenta e Dois", role: "owner" }, senha);
    await adm().from("profiles").update({ is_teste: true, intencao: ["anunciar"], preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    // Rascunho pela metade (sem internet e sem conforto): o Início mostra passos feitos e pendentes.
    ids.rascunho = await criarImovelPronto(ids.dono, `[Varredura] Studio com nome comprido para os passos t661 ${sufixo}`, { semInternet: true, semConforto: true });
  });
  test.afterAll(async ({}, info) => {
    if (info.project.name !== "chromium") return;
    await apagarContas([ids.dono].filter(Boolean));
  });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.skip(t.conta === "SOCIO" && !CODIGO_SOCIOS, "SOCIOS_ACCESS_CODE não definido neste ambiente");
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
