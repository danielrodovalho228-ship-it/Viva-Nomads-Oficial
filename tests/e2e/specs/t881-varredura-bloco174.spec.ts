import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS, escutarErros } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T881 — VARREDURA DA PÁGINA INTEIRA, BLOCO 174 (Pista C, 01/11): AS TELAS QUE NUNCA FORAM VARRIDAS. O registro de
  cobertura (cobertura.json, 158 rotas, somando as varreduras abertas dos blocos 156–173) tinha 4 rotas sem nenhuma
  varredura; este bloco cobre três, no protocolo do bloco 21 (t385): seis classes (imagem pelo carregamento real,
  elemento fixo sobre conteúdo, cartão sem foto, estouro horizontal, texto cortado, grade), página toda rolada, 390 e
  1280 px, HTTP abaixo de 400, e o console (régua da t249):
   - visitante: /avisos/desligar sem link válido (o aviso de link inválido) e /avisos/desligar?ok=1 (a confirmação);
   - visitante: /dev/emails (fora da Vercel abre a prévia; com NODE_ENV=production e sem TEST_ROUTES_KEY, a página
     "Protegido" — a varredura confere a que abrir);
   - leitor de QA (conta nova do laboratório com qa_leitor e is_teste): /dashboard/qa/emails.
  Fica de fora, por desenho: /qa/entrar, que responde 404 sem os parâmetros da entrada de QA. Defeito novo entra como
  test.fail ligado a um item (L-84 / D-V11 são os próximos livres).
*/
type Conta = "VISITANTE" | "LEITOR_QA";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: string;
}
const TELAS: Tela[] = [
  { conta: "VISITANTE", papel: "visitante", nome: "Desligar sugestões (link inválido)", rota: "/avisos/desligar" },
  { conta: "VISITANTE", papel: "visitante", nome: "Desligar sugestões (confirmado)", rota: "/avisos/desligar?ok=1" },
  { conta: "VISITANTE", papel: "visitante", nome: "Prévia de e-mails", rota: "/dev/emails" },
  { conta: "LEITOR_QA", papel: "leitor de QA", nome: "Caixa de e-mails de teste", rota: "/dashboard/qa/emails" },
];

const SAIDA = "tests/laboratorio/saida/varredura-bloco174";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
const senha = novaSenha();
const sufixo = novoSufixo();
const leitor = { email: `qa.t881.${sufixo}@lab.vivanomads.test`, nome: "Quiteria Leitora", role: "owner" as const };
const ids: { leitor?: string } = {};

async function abrir(browser: Browser, conta: Conta, tam: (typeof TAMANHOS)[number]): Promise<Page> {
  if (conta === "LEITOR_QA") {
    const page = await entrar(browser, leitor.email, senha);
    await page.setViewportSize({ width: tam.width, height: tam.height });
    return page;
  }
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: tam.width, height: tam.height } });
  return ctx.newPage();
}

test.describe("T881 — varredura da página inteira, bloco 174 (as telas nunca varridas) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "precisa do laboratório (conta de leitor de QA)");
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });
  test.beforeAll(async () => {
    ids.leitor = await criarConta(leitor, senha);
    const { error } = await adm().from("profiles").update({ qa_leitor: true, is_teste: true }).eq("id", ids.leitor);
    expect(error).toBeNull();
  });
  test.afterAll(async () => {
    await apagarContas([ids.leitor]);
  });

  for (const t of TELAS) {
    test(`${t.papel} — ${t.nome}: as seis classes, rolando a página inteira`, async ({ browser }) => {
      test.setTimeout(180_000);
      const relatorio: Record<string, Record<string, string[]>> = {};
      mkdirSync(SAIDA, { recursive: true });
      for (const tam of TAMANHOS) {
        const page = await abrir(browser, t.conta, tam);
        try {
          const respostas = escutarImagens(page);
          const erros = escutarErros(page);
          const resposta = await page.goto(t.rota, { waitUntil: "domcontentloaded", timeout: 40_000 });
          expect(resposta?.status() ?? 0, `${t.papel} — ${t.nome} @${tam.nome}: HTTP`).toBeLessThan(400);
          expect(new URL(page.url()).pathname, `${t.papel} — ${t.nome} @${tam.nome}: caiu fora da tela`).toBe(t.rota.split(/[?#]/)[0]);
          await page.locator("main").first().waitFor({ timeout: 20_000 }).catch(() => {});
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
          const achados = await varrerPagina(page, respostas);
          for (const classe of Object.keys(CLASSES) as Classe[]) {
            await test.step(`${classe} @${tam.nome}`, async () => {
              for (const a of achados[classe]) console.log(`VARREDURA|${classe}|${tam.nome}|${t.papel}|${t.rota}|${a}`);
              expect.soft(achados[classe], `${t.papel} — ${t.nome} @${tam.nome} — ${classe}: ${CLASSES[classe]}`).toEqual([]);
            });
          }
          await page.screenshot({ path: `${SAIDA}/${slug(`${t.papel}-${t.nome}`)}-${tam.width}.png`, fullPage: true }).catch(() => {});
          const consoleErros = erros.lista();
          await test.step(`console @${tam.nome}`, async () => {
            for (const a of consoleErros) console.log(`VARREDURA|console|${tam.nome}|${t.papel}|${t.rota}|${a}`);
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
