import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { abrirPasso, emDiasBR, isoParaBR, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T700 — E260 (QA, 30/10): cada pendência é dita UMA vez.
   (a) Passo 9: janela de 24 dias com mínimo de 30 e "Continuar" → o aviso aparece só junto das datas (`janela-curta`,
       com a explicação e a saída); o resumo "Para continuar, falta:" do topo não o repete. O Continuar segue recusando.
   (b) Passo 10: a lista de conferência é a única fonte das pendências. Saem o "Falta confirmar: …" e o "Falta resolver:
       …"; o motivo do "Publicar anúncio" vira uma frase curta que aponta para a lista ("Faltam N itens da lista de
       conferência"), sem repetir os itens, e tocar nele desce até a lista.
  Nas duas larguras (1280 e 390).
*/
const CAPTURAS = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t700.${sufixo}@lab.vivanomads.test`, nome: "Uma Vez", role: "owner" as const };
const ids: { dono?: string; janela?: string; revisao?: string } = {};
const LARGURAS = [1280, 390] as const;

/** Quantas vezes um trecho aparece no texto visível da página. */
const vezesNaTela = (p: Page, trecho: string) => p.evaluate((t) => document.body.innerText.split(t).length - 1, trecho);

const naTela = (p: Page, testid: string) =>
  p.getByTestId(testid).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  });

test.describe("T700 — E260: avisos únicos nos Passos 9 e 10", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.janela = await prepararRascunho(ids.dono, `Studio t700 janela ${sufixo}`, { minPeriod: "30" });
    ids.revisao = await prepararRascunho(ids.dono, `Studio t700 revisão ${sufixo}`);
    // Sem o padrão mínimo confirmado: a linha de Comodidades fica pendente na lista.
    const { error } = await adm().from("conforto_declaracoes").delete().eq("property_id", ids.revisao);
    expect(error).toBeNull();
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  for (const largura of LARGURAS) {
    test(`(a) ${largura} px: a janela curta é dita uma vez só, junto das datas`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids.janela!, "disponibilidade", largura);
      await p.getByTestId("disponivel-de").fill(isoParaBR(emDiasBR(2)));
      await p.getByTestId("disponivel-ate").fill(isoParaBR(emDiasBR(26)));
      const aviso = p.getByTestId("janela-curta");
      await expect(aviso).toContainText("são 24 dias — menos que a duração mínima de 30 dias", { timeout: 15_000 });
      await expect(aviso).toContainText("ou deixe sem data final");
      await p.getByTestId("cadastro-continuar").click();
      await noPasso(p, "disponibilidade");
      // Recusado, sem resumo repetido no topo; o aviso inline vem à vista.
      await expect(p.getByTestId("passo-erros")).toHaveCount(0);
      await expect.poll(() => naTela(p, "janela-curta"), { message: `@${largura}: o aviso vem à vista`, timeout: 5_000 }).toBe(true);
      expect(await vezesNaTela(p, "menos que a duração mínima de"), "o aviso aparece UMA vez").toBe(1);
      await aviso.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await p.screenshot({ path: `${CAPTURAS}/t700-passo9-${largura}.png` });
      await p.context().close();
    });
  }

  for (const largura of LARGURAS) {
    test(`(b) ${largura} px: as pendências moram só na lista de conferência; o motivo aponta para ela`, async ({ browser }) => {
      const p = await abrirPasso(browser, { email: dono.email, senha }, ids.revisao!, "revisao", largura);
      const lista = p.getByTestId("lista-conferencia");
      const linhaConforto = p.getByTestId("etapa-revisar").locator('[data-itens~="conforto"]');
      await expect(linhaConforto).toHaveAttribute("data-ok", "0", { timeout: 20_000 });
      await expect(linhaConforto).toContainText("Falta:");
      // Sem os blocos repetidos.
      await expect(p.getByTestId("publicar-falta")).toHaveCount(0);
      expect(await vezesNaTela(p, "Falta confirmar"), "sem 'Falta confirmar'").toBe(0);
      expect(await vezesNaTela(p, "Falta resolver"), "sem 'Falta resolver'").toBe(0);
      // O motivo: quantos itens da lista (e o aceite, que não está nela), sem nomear item nenhum da lista.
      const motivo = p.getByTestId("publicar-motivo");
      await expect(motivo).toHaveText(/^Faltam? (\d+) ite(m|ns) da lista de conferência( e o aceite do termo da IA)?$/);
      const n = Number((await motivo.innerText()).match(/\d+/)![0]);
      const faltamLinhas = Number(await lista.getAttribute("data-faltam"));
      const revisao = p.getByTestId("conferencia-revisao");
      const faltamRevisao = (await revisao.count()) ? (await revisao.innerText()).replace(/^Falta:\s*/, "").split("; ").length : 0;
      expect(n, "o número do motivo é o da lista").toBe(faltamLinhas + faltamRevisao);
      for (const nome of ["padrão mínimo", "Padrão mínimo", "documento", "declarações"]) await expect(motivo).not.toContainText(nome);
      // Tocar no motivo desce até a lista.
      await motivo.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await p.screenshot({ path: `${CAPTURAS}/t700-passo10-motivo-${largura}.png` });
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await motivo.click();
      await expect.poll(() => naTela(p, "lista-conferencia"), { message: `@${largura}: o motivo desce até a lista`, timeout: 5_000 }).toBe(true);
      await p.waitForTimeout(600);
      await p.screenshot({ path: `${CAPTURAS}/t700-passo10-lista-${largura}.png` });
      // O "Resolver" da linha leva ao passo (o caminho para resolver continua na lista).
      await p.getByTestId("conferencia-resolver-comodidades").click();
      await expect(p.getByTestId("conforto-checklist")).toBeVisible({ timeout: 20_000 });
      await p.context().close();
    });
  }
});
