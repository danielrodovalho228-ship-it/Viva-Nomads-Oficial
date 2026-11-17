import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2097 — E576 (Pista 3; varredura "sem spec" das 142, lote C) @E576 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E576): parceria APROVADA e ainda não ativada (solicitação 'aprovada', sem página de parceiro) — Conta ›
  Papéis mostra "Sua parceria foi aprovada. Ative sua página…" e o botão "Parceria aprovada — ativar sua página", que
  leva a /dashboard/parceiro. Sem solicitação aprovada (pendente, recusada, nenhuma), nada disso aparece. O unitário
  e576-papeis-parceria-aprovada.test.ts fixa a situação e os textos; esta spec prova na tela.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const aprovada = { email: `apr.t2097.${sufixo}@lab.vivanomads.test`, nome: "Ana Aprovada", role: "tenant" as const };
const pendente = { email: `pen.t2097.${sufixo}@lab.vivanomads.test`, nome: "Paulo Pendente", role: "tenant" as const };
const ids: Record<string, string> = {};
const TEXTO = "Sua parceria foi aprovada. Ative sua página para completar o cadastro e começar a receber pedidos.";

async function solicitacao(userId: string, email: string, nome: string, status: string) {
  // A aprovada leva o token de ativação (0190: parceiro_solicitacoes_aprovada_token), como a aprovação do admin deixa.
  const token = status === "aprovada" ? { token_ativacao_hash: randomBytes(32).toString("hex") } : {};
  const { error } = await adm().from("parceiro_solicitacoes").insert({ user_id: userId, email, nome, status, origem: "conta", tipo_pessoa: "pj", categorias: ["limpeza"], cidades: ["Uberlândia"], ...token });
  if (error) throw error;
}

test.describe("T2097 — E576: parceria aprovada e não ativada aparece em Papéis com o caminho para ativar @E576", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.aprovada = await criarConta(aprovada, senha);
    ids.pendente = await criarConta(pendente, senha);
    await solicitacao(ids.aprovada, aprovada.email, aprovada.nome, "aprovada");
    await solicitacao(ids.pendente, pendente.email, pendente.nome, "pendente");
  });
  test.afterAll(async () => {
    await adm().from("parceiro_solicitacoes").delete().in("user_id", [ids.aprovada ?? "", ids.pendente ?? ""]);
    await apagarContas([ids.aprovada, ids.pendente]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px — aprovada sem página: o texto e o botão "Parceria aprovada — ativar sua página" → /dashboard/parceiro`, async ({ browser }) => {
      const p = await entrar(browser, aprovada.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/conta/papeis", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("tela-papeis")).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("papel-parceiro-aprovada")).toHaveText(TEXTO, { timeout: 15_000 });
      const botao = p.getByTestId("papel-parceiro-botao");
      await expect(botao).toHaveText("Parceria aprovada — ativar sua página");
      await expect(botao).toHaveAttribute("href", "/dashboard/parceiro");
      await p.context().close();
    });
  }

  test("1280 px — solicitação só pendente: nem o texto nem o botão de ativar", async ({ browser }) => {
    const p = await entrar(browser, pendente.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/conta/papeis", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("tela-papeis")).toBeVisible({ timeout: 30_000 });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await expect(p.getByTestId("papel-parceiro-aprovada")).toHaveCount(0);
    await expect(p.getByText("Parceria aprovada — ativar sua página")).toHaveCount(0);
    await p.context().close();
  });
});
