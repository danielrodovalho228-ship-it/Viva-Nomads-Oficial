import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, novoSufixo } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";
import { TAMANHOS, escutarErros, lerMassa } from "../fixtures/varredura";
import { CLASSES, escutarImagens, varrerPagina, type Classe } from "../fixtures/varredura-pagina";

/*
  T788 — VARREDURA DA PÁGINA INTEIRA, BLOCO 109, ADMIN (Pista C, 31/10), 2ª volta do ciclo. O protocolo do bloco 21
  (t385): seis classes (imagem pelo carregamento real, elemento fixo sobre conteúdo, cartão sem foto, estouro
  horizontal, texto cortado, grade), página toda rolada, 390 e 1280 px, HTTP abaixo de 400; e o console (erro de
  console ou de página, régua da t249) no relatório. As telas varridas há mais tempo depois do bloco 108 (registro de
  cobertura: última varredura no bloco 91, t777): as do ADMIN com id na URL e a de refazer as duas etapas, com a sessão
  de admin do laboratório:
   - chamado no atendimento (chamado semeado com simulacao=true: não entra nas contagens do /admin, como na t599);
   - contrato (o contrato da massa da varredura);
   - pedido de serviço de parceiro (pedido semeado para o parceiro da massa, como na t368);
   - refazer duas etapas.
  O que é semeado aqui é apagado no fim. Defeito novo entra como test.fail ligado a um item (L-84 / D-V11 livres).
*/
type Conta = "ADMIN" | "VISITANTE";
interface Tela {
  conta: Conta;
  papel: string;
  nome: string;
  rota: () => string;
  /** testid que a tela tem de mostrar (a prova de que é a tela do merge, não um estado vazio); por largura quando muda. */
  marca?: string | ((largura: number) => string);
}

const MASSA = lerMassa();
const sufixo = novoSufixo();
const ids: { chamado?: string; pedido?: string } = {};
const TELAS: Tela[] = [
  { conta: "ADMIN", papel: "admin", nome: "Chamado no atendimento", rota: () => `/admin/atendimento/${ids.chamado}` },
  { conta: "ADMIN", papel: "admin", nome: "Contrato", rota: () => `/admin/contratos/${MASSA?.contrato}` },
  { conta: "ADMIN", papel: "admin", nome: "Pedido de serviço de parceiro", rota: () => `/admin/parceiros/pedidos/${ids.pedido}` },
  { conta: "ADMIN", papel: "admin", nome: "Refazer duas etapas", rota: () => "/admin/2fa/refazer" },
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

const SAIDA = "tests/laboratorio/saida/varredura-bloco109-admin";
const slug = (s: string) => s.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

async function abrir(browser: Browser, t: Tela): Promise<Page> {
  if (t.conta === "ADMIN") return (await browser.newContext({ storageState: authFile("admin") })).newPage();
  return (await browser.newContext()).newPage();
}

test.describe("T788 — varredura da página inteira, bloco 109 (2ª volta, admin: chamado, contrato, pedido de parceiro, refazer duas etapas) (390 e 1280 px)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "default" });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (os dois tamanhos saem dentro do teste)");
    expect(MASSA, "laboratório sem a massa da varredura (scripts/lab/massa-varredura.mjs)").not.toBeNull();
  });
  test.beforeAll(async () => {
    if (!MASSA) return;
    const agora = Date.now();
    const { data: ch, error: ec } = await adm()
      .from("chamados")
      .insert({
        visitante_email: `lab-t788.${sufixo}@lab.vivanomads.test`, visitante_nome: "Lab T788", tipo: "suporte", categoria: "outro", prioridade: "p3", status: "aberto", canal: "site",
        assunto: `Lab T788 ${sufixo} — dúvida sobre a caução`, responsavel_tipo: "humano",
        prazo_primeira_resposta: new Date(agora + 3_600_000).toISOString(), prazo_resolucao: new Date(agora + 86_400_000).toISOString(), simulacao: true,
      })
      .select("id")
      .single();
    if (ec) throw ec;
    ids.chamado = ch.id as string;
    const { data: pe, error: ep } = await adm()
      .from("parceiro_pedidos")
      .insert({ codigo: `VN-SV-${randomBytes(4).toString("hex").toUpperCase()}`, parceiro_id: MASSA.parceiro, cliente_id: MASSA.ids.INQUILINA, categoria: "fotografia", descricao: "Fotos do apartamento (varredura do bloco 91).", status: "solicitado" })
      .select("id")
      .single();
    if (ep) throw ep;
    ids.pedido = pe.id as string;
  });
  test.afterAll(async () => {
    if (ids.chamado) await adm().from("chamados").delete().eq("id", ids.chamado);
    if (ids.pedido) await adm().from("parceiro_pedidos").delete().eq("id", ids.pedido);
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
          // Console e erro de página (critério d da t249, com as exceções de terceiros de lá) também entram no relatório.
          const erros = escutarErros(page);
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
          const consoleErros = erros.lista();
          await test.step(`console @${tam.nome}`, async () => {
            for (const a of consoleErros) console.log(`VARREDURA|console|${tam.nome}|${t.papel}|${rotulo}|${a}`);
            expect.soft(consoleErros, `${t.papel} — ${t.nome} @${tam.nome} — console: erro de console ou de página`).toEqual([]);
          });
          await page.screenshot({ path: `${SAIDA}/${slug(`${t.papel}-${t.nome}`)}-${tam.width}.png`, fullPage: true }).catch(() => {});
          relatorio[tam.nome] = { ...achados, console: consoleErros };
        } finally {
          await page.context().close();
        }
      }
      writeFileSync(`${SAIDA}/${slug(`${t.papel}-${t.nome}`)}.json`, JSON.stringify({ papel: t.papel, tela: t.nome, achados: relatorio }, null, 2));
    });
  }
});
