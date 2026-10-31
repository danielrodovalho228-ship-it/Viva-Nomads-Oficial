import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TAMANHOS } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T748 — VARREDURA DA PÁGINA INTEIRA, BLOCO 85 (Pista C, 31/10). O protocolo do bloco 21 (t385): seis classes, página
  toda rolada, carregamento real de cada imagem, elemento fixo sobre conteúdo, 390 e 1280 px, HTTP abaixo de 400.
  Rodízio pelo registro de cobertura (tests/e2e/cobertura.json): as telas que NUNCA tiveram varredura —
  /avisos/desligar, /dev/emails e /dashboard/qa/emails (conta de teste com qa_leitor, criada aqui) — e as públicas cuja
  única varredura é dos blocos 7–20: /alerta-busca/desligar, /app/boas-vindas, /conferir, /excluir-conta, /favoritos,
  /guias e /guia-fotos. A /qa/entrar fica de fora: sem QA_LOGIN_KEY_HASH (o servidor normal do lab) ela é 404 por
  desenho; a t596 a cobre num 2º servidor. Defeito novo entra como test.fail ligado a um item D-V (próximo livre: D-V9).
*/
type Conta = "QA" | "VISITANTE";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: () => string;
  /** testid que a tela tem de mostrar (a prova de que é a tela do merge, não um estado vazio); por largura quando muda. */
  marca?: string | ((largura: number) => string);
}

const TELAS: Tela[] = [
  ...[
    ["Desligar avisos (link sem token)", "/avisos/desligar"],
    ["Prévia dos e-mails (dev)", "/dev/emails"],
    ["Desligar alerta de busca", "/alerta-busca/desligar"],
    ["Boas-vindas do app", "/app/boas-vindas"],
    ["Conferir documento", "/conferir"],
    ["Excluir conta", "/excluir-conta"],
    ["Favoritos", "/favoritos"],
    ["Guias", "/guias"],
    ["Guia de fotos", "/guia-fotos"],
  ].map(([nome, rota]) => ({ conta: "VISITANTE" as const, papel: "visitante", nome, rota: () => rota })),
  { conta: "QA", papel: "qa (leitora)", nome: "Caixa de e-mails da QA", rota: () => "/dashboard/qa/emails" },
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

const SAIDA = "tests/laboratorio/saida/varredura-bloco85";
const senha = novaSenha();
const qa = { email: `qa.t748.${novoSufixo()}@lab.vivanomads.test`, nome: "Quésia Leitora", role: "tenant" as const };
let qaId = "";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

async function abrir(browser: Browser, t: Tela): Promise<Page> {
  if (t.conta === "QA") return entrar(browser, qa.email, senha);
  return (await browser.newContext()).newPage();
}

test.describe("T748 — varredura da página inteira, bloco 85 (nunca varridas: avisos/desligar, dev/emails, caixa da QA; e públicas antigas) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default" });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
  });
  test.beforeAll(async () => {
    qaId = await criarConta(qa, senha);
    await adm().from("profiles").update({ is_teste: true, qa_leitor: true }).eq("id", qaId);
  });
  test.afterAll(async () => {
    if (qaId) await apagarContas([qaId]);
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
