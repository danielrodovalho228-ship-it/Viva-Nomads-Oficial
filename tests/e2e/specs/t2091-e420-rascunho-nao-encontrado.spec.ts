import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2091 — E420 (Pista 3; varredura "sem spec" do mapa das 142, ronda 08:24Z) @E420 — sem @ao-vivo-seguro: precisa de
  sessão e do laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E420): o editor de anúncio aberto com um rascunho da URL (?draft=) que não existe OU é de outra conta
  AVISA — "Rascunho não encontrado", "não existe ou não é desta conta" — em vez de abrir um cadastro novo em silêncio; a
  mesma mensagem para os dois casos (não revela o anúncio dos outros), com os caminhos para Meus imóveis e para um novo.
  O unitário rascunho-nao-encontrado.test.ts fixa o texto e o servidor; esta spec prova na tela.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2091.${sufixo}@lab.vivanomads.test`, nome: "Dora Rascunho", role: "owner" as const };
const outro = { email: `outro.t2091.${sufixo}@lab.vivanomads.test`, nome: "Otto Alheio", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T2091 — E420: rascunho da URL inexistente ou de outra conta avisa, não abre cadastro novo @E420", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.outro = await criarConta(outro, senha);
    for (const id of [ids.dono, ids.outro]) await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", id);
    // O rascunho de OUTRA conta.
    ids.alheio = await criarImovelPronto(ids.outro, `Rascunho alheio ${sufixo}`, { ativo: false });
    await adm().from("properties").update({ status: "draft" }).eq("id", ids.alheio);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.outro]);
  });

  for (const [caso, draft] of [["inexistente", () => randomUUID()], ["de outra conta", () => ids.alheio]] as const) {
    test(`1280 px — ?draft= ${caso}: "Rascunho não encontrado", com os dois caminhos, e o título alheio nunca aparece`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: 1280, height: 900 });
      await p.goto(`/dashboard/imoveis/novo?draft=${draft()}`, { waitUntil: "domcontentloaded" });
      const aviso = p.getByTestId("rascunho-fechado");
      await expect(aviso).toBeVisible({ timeout: 30_000 });
      await expect(aviso).toHaveAttribute("data-motivo", "nao_encontrado");
      await expect(aviso).toContainText("Rascunho não encontrado");
      await expect(aviso).toContainText("não existe ou não é desta conta");
      await expect(p.getByTestId("rascunho-fechado-meus")).toHaveAttribute("href", "/dashboard/imoveis");
      await expect(p.getByTestId("rascunho-fechado-novo")).toHaveAttribute("href", "/dashboard/imoveis/novo");
      await expect(p.getByText(`Rascunho alheio ${sufixo}`)).toHaveCount(0);
      await p.context().close();
    });
  }
});
