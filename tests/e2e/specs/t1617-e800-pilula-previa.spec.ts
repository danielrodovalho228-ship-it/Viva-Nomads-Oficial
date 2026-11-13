import { test, expect, type Browser, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1617 — E800 (D3, prova ao vivo de 12/11): na prévia do perfil, a pílula "É assim que o morador/proprietário te vê…"
  quebrava em duas linhas com o texto encostando nas bordas arredondadas, e o relógio cobria o começo de "Responde X% das
  conversas…". Medida geométrica na tela, nas contas da massa (dono: DONO17; morador: INQUILINA), a 1280 e a 390 px, e
  num dono próprio com 3 conversas respondidas — a linha "Responde X%…" só existe com conversas (a massa não tem).
*/
const senhaResponde = novaSenha();
const responde = { email: `e800.dono.${novoSufixo()}@lab.vivanomads.test`, senha: senhaResponde };
const ids: (string | undefined)[] = [];

const CONTAS = [
  { nome: "DONO-QUE-RESPONDE", email: responde.email as string | undefined, senha: responde.senha as string | undefined, exigeResposta: true },
  { nome: "DONO17", email: process.env.TESTES_VARREDURA_DONO17_EMAIL, senha: process.env.TESTES_VARREDURA_DONO17_SENHA, exigeResposta: false },
  { nome: "INQUILINA", email: process.env.TESTES_VARREDURA_INQUILINA_EMAIL, senha: process.env.TESTES_VARREDURA_INQUILINA_SENHA, exigeResposta: false },
];

async function entrar(browser: Browser, email: string, senha: string, largura: number): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura < 768 ? 844 : 900 } });
  const page = await ctx.newPage();
  await entrarNaPagina(page, email, senha);
  return page;
}

test.describe("T1617 — E800 pílula da prévia e relógio sem sobreposição", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.beforeAll(async () => {
    const dono = await criarConta({ email: responde.email, nome: "[TESTE QA] Paulo Prévia Responde", role: "owner" }, senhaResponde);
    const inq = await criarConta({ email: `e800.inq.${novoSufixo()}@lab.vivanomads.test`, nome: "[TESTE QA] Ana Pergunta", role: "tenant" }, novaSenha());
    ids.push(dono, inq);
    const imovel = await criarImovelPronto(dono, "Studio da prévia (t1617)");
    // 3 conversas (o mínimo da métrica): a inquilina escreve e o dono responde → "Responde 100% das conversas, …".
    for (let i = 0; i < 3; i++) {
      const c = randomUUID();
      await gravarMensagem(inq, dono, imovel, `Olá, o studio está livre? (${i})`, c);
      await gravarMensagem(dono, inq, imovel, "Está sim, pode perguntar por aqui.", c);
    }
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const conta of CONTAS) {
    for (const largura of [1280, 390]) {
      test(`${conta.nome} ${largura}px — pílula com folga e raio da quebra; relógio fora do texto`, async ({ browser }) => {
        test.skip(!conta.email || !conta.senha, "conta da massa ausente");
        const page = await entrar(browser, conta.email!, conta.senha!, largura);
        await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
        const titulo = page.locator('[data-testid="espelho-titulo"]:visible').first();
        await expect(titulo).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(1_500); // a prévia pode trocar de cartão quando a leitura chega

        const p = await titulo.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          const faixa = document.createRange();
          // O texto da pílula (sem o ícone): o último nó de texto com conteúdo.
          const nos = [...el.querySelectorAll("*"), el].flatMap((n) => [...n.childNodes]).filter((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
          faixa.selectNodeContents(nos[nos.length - 1]);
          const linhas = [...faixa.getClientRects()];
          const esq = Math.min(...linhas.map((l) => l.left));
          const dir = Math.max(...linhas.map((l) => l.right));
          const alturaLinha = parseFloat(cs.lineHeight) || 20;
          return { altura: r.height, alturaLinha, raio: parseFloat(cs.borderTopLeftRadius), folgaEsq: esq - r.left, folgaDir: r.right - dir, nLinhas: new Set(linhas.map((l) => Math.round(l.top))).size };
        });
        const quebrou = p.nLinhas > 1;
        if (quebrou) expect.soft(p.raio, `pílula quebrada em ${p.nLinhas} linhas com raio ${p.raio}px`).toBeLessThanOrEqual(12);
        expect.soft(p.folgaDir, `texto a ${p.folgaDir.toFixed(1)}px da borda direita`).toBeGreaterThanOrEqual(12);
        expect.soft(p.folgaEsq, `texto a ${p.folgaEsq.toFixed(1)}px da borda esquerda`).toBeGreaterThanOrEqual(12);

        const resposta = page.locator('[data-testid="espelho-resposta"]:visible').first();
        if (conta.exigeResposta) await expect(resposta, "o dono com conversas mostra a linha 'Responde X%…'").toBeVisible({ timeout: 15_000 });
        if (await resposta.count()) {
          const g = await resposta.evaluate((el) => {
            const svg = el.querySelector("svg")!.getBoundingClientRect();
            const span = [...el.querySelectorAll("span")].find((s) => /Responde/.test(s.textContent ?? ""))!;
            const faixa = document.createRange();
            faixa.selectNodeContents(span);
            const linhas = [...faixa.getClientRects()];
            const sobrepoe = linhas.some((l) => svg.right > l.left + 0.5 && svg.left < l.right && svg.bottom > l.top && svg.top < l.bottom);
            return { largura: svg.width, sobrepoe };
          });
          expect.soft(g.largura, "o relógio encolheu").toBeGreaterThanOrEqual(15);
          expect(g.sobrepoe, "o relógio cobre o texto de 'Responde…'").toBe(false);
        }
        await page.context().close();
      });
    }
  }
});
