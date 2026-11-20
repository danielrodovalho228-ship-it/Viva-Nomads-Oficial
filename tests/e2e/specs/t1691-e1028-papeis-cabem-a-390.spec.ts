import { randomBytes } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1691 — E1028 (18/11; era o D-V9 das varreduras, marcado como falha esperada desde o bloco 96).
  Conta › Papéis estourava 13 px à direita a 390 px para quem tem a parceria ativa: o botão "Abrir meu painel de
  parceiro" nunca quebra (regra dos botões) e pedia 243 px numa coluna de 214 px, ao lado da foto do cartão. O cartão
  não cabia, a grelha alargava para 387 px e a tela inteira ganhava rolagem lateral.
  Agora o botão de cada cartão fica por baixo da foto e do texto, na largura toda do cartão no celular.
  Cobre os três rótulos do botão do cartão "Quero ser parceiro":
    A) parceria ativa        — "Abrir meu painel de parceiro" (o caso que estourava);
    B) aprovada, sem página  — "Parceria aprovada — ativar sua página" (o rótulo mais comprido; a mesma coluna);
    C) sem parceria          — "Cadastrar meu serviço" (o que já cabia: não pode piorar).
  A 390 e a 1280 px: sem rolagem lateral, cada cartão dentro da tela e cada botão inteiro dentro do seu cartão.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ativa = { email: `ativa.t1691.${sufixo}@lab.vivanomads.test`, nome: "Alice Ativa", role: "owner" as const };
const aprovada = { email: `apr.t1691.${sufixo}@lab.vivanomads.test`, nome: "Ana Aprovada", role: "tenant" as const };
const semParceria = { email: `sem.t1691.${sufixo}@lab.vivanomads.test`, nome: "Sara Sem", role: "tenant" as const };
const ids: Record<string, string> = {};

const CASOS = [
  { nome: "A) parceria ativa", conta: ativa, rotulo: "Abrir meu painel de parceiro" },
  { nome: "B) parceria aprovada, sem página", conta: aprovada, rotulo: "Parceria aprovada — ativar sua página" },
  { nome: "C) sem parceria", conta: semParceria, rotulo: "Cadastrar meu serviço" },
] as const;

/** As medidas da tela: a largura do documento e, por cartão, a caixa do cartão e a do botão dele (se tiver). */
async function medir(p: Page) {
  return p.evaluate(() => {
    const caixa = (e: Element) => {
      const r = e.getBoundingClientRect();
      return { esquerda: Math.round(r.left), direita: Math.round(r.right), largura: Math.round(r.width) };
    };
    const cartoes = Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="papel-cartao-"]')).map((c) => {
      const botao = c.querySelector<HTMLElement>('a[data-testid="papel-comecar-anuncio"], a[data-testid="papel-parceiro-botao"]');
      return { id: c.dataset.testid!, cartao: caixa(c), botao: botao ? { ...caixa(botao), texto: botao.innerText.trim(), cortado: botao.scrollWidth > botao.clientWidth + 1 } : null };
    });
    return { tela: document.documentElement.clientWidth, documento: document.documentElement.scrollWidth, cartoes };
  });
}

test.describe("T1691 — E1028: Conta › Papéis cabe a 390 px com qualquer rótulo do botão de parceiro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (cria contas e a parceria com a chave de serviço).");
  test.describe.configure({ timeout: 120_000 });

  test.beforeAll(async () => {
    ids.ativa = await criarConta(ativa, senha);
    await criarImovelPronto(ids.ativa, `Studio T1691 ${sufixo}`, { ativo: true });
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.ativa, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: `Alice Limpeza ${sufixo}`, slug: `alice-t1691-${sufixo}`.toLowerCase().replace(/[^a-z0-9-]/g, ""), categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório para o teste do E1028." })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = data.id as string;
    ids.aprovada = await criarConta(aprovada, senha);
    // A aprovada leva o token de ativação, como a aprovação do admin deixa (0190).
    const { error: erroSolicitacao } = await adm().from("parceiro_solicitacoes").insert({ user_id: ids.aprovada, email: aprovada.email, nome: aprovada.nome, status: "aprovada", origem: "conta", tipo_pessoa: "pj", categorias: ["limpeza"], cidades: ["Uberlândia"], token_ativacao_hash: randomBytes(32).toString("hex") });
    if (erroSolicitacao) throw erroSolicitacao;
    ids.semParceria = await criarConta(semParceria, senha);
  });

  test.afterAll(async () => {
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    if (ids.aprovada) await adm().from("parceiro_solicitacoes").delete().eq("user_id", ids.aprovada);
    await apagarContas([ids.ativa, ids.aprovada, ids.semParceria]);
  });

  for (const caso of CASOS) {
    for (const largura of [390, 1280]) {
      test(`${caso.nome} — ${largura} px: sem rolagem lateral, cartões na tela, botão inteiro no cartão`, async ({ browser }) => {
        const p = await entrar(browser, caso.conta.email, senha);
        await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await p.goto("/dashboard/conta/papeis", { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("tela-papeis")).toBeVisible({ timeout: 30_000 });
        // O rótulo do botão depende da leitura da parceria: só mede depois de ele assentar.
        await expect(p.getByTestId("papel-parceiro-botao")).toHaveText(caso.rotulo, { timeout: 20_000 });
        await p.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined); // o painel mantém conexão aberta
        const m = await medir(p);
        expect(m.cartoes.map((c) => c.id)).toEqual(["papel-cartao-morar", "papel-cartao-anunciar", "papel-cartao-parceiro"]);
        expect(m.documento, `a página tem ${m.documento} px de largura numa tela de ${m.tela} px`).toBeLessThanOrEqual(m.tela);
        for (const c of m.cartoes) {
          expect(c.cartao.direita, `${c.id}: passa da direita da tela (${c.cartao.direita} > ${m.tela})`).toBeLessThanOrEqual(m.tela);
          expect(c.cartao.esquerda, `${c.id}: começa fora da tela`).toBeGreaterThanOrEqual(0);
          if (!c.botao) continue;
          expect(c.botao.cortado, `${c.id}: o texto "${c.botao.texto}" não cabe no botão`).toBe(false);
          expect(c.botao.esquerda, `${c.id}: o botão sai pela esquerda do cartão`).toBeGreaterThanOrEqual(c.cartao.esquerda);
          expect(c.botao.direita, `${c.id}: o botão sai pela direita do cartão`).toBeLessThanOrEqual(c.cartao.direita);
        }
        await p.screenshot({ path: test.info().outputPath(`t1691-${caso.nome.slice(0, 1)}-${largura}.png`), fullPage: true });
        await p.context().close();
      });
    }
  }
});
