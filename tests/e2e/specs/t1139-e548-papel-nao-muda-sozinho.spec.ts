import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T1139 — E548 (#2560, 05/11): o papel nunca muda sozinho. Abrir a área do morador (ex.: "Ver minhas estadias" em
 * Conta › Avaliações → /dashboard/locacoes) com o modo do proprietário escolhido NÃO troca nem grava o modo: a página
 * se desenha pela URL e, ao voltar, o painel segue no modo escolhido. Antes, a visita gravava o modo morador e a
 * navegação ficava em "Áreas do morador" até a troca manual. Entrou com o e548-papel-nao-muda-sozinho.test.ts; aqui é a
 * tela, 390 e 1280, de uma conta com os dois papéis (fora do 1º acesso: intenção e papel ativo gravados):
 *   1. abre /dashboard/locacoes (área do morador) e espera o tempo de uma sincronização;
 *   2. profiles.papel_ativo segue "proprietario" e preferred_mode segue "owner";
 *   3. de volta ao Início, o topo é o do proprietário (1280: topo-dono, data-papel="proprietario").
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `dois.t1139.${sufixo}@lab.vivanomads.test`, nome: "Duda Dois Papéis", role: "owner" as const };
const ids: Record<string, string> = {};

async function perfil() {
  const { data } = await adm().from("profiles").select("papel_ativo, preferred_mode").eq("id", ids.conta).single();
  return data as { papel_ativo: string | null; preferred_mode: string | null };
}

test.describe("T1139 — E548: abrir a área do morador não troca nem grava o modo do painel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
    const { error } = await adm()
      .from("profiles")
      .update({ intencao: ["morar", "anunciar"], papel_ativo: "proprietario", preferred_mode: "owner" })
      .eq("id", ids.conta);
    expect(error, error?.message).toBeNull();
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.conta]);
  });

  for (const w of [390, 1280] as const) {
    test(`visitar /dashboard/locacoes mantém papel_ativo e preferred_mode; o Início volta no proprietário (${w})`, async ({ browser }) => {
      const p = await entrar(browser, conta.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      try {
        await p.goto("/dashboard/locacoes", { waitUntil: "domcontentloaded" });
        await expect(p.locator("main")).toBeVisible({ timeout: 30_000 });
        // O tempo de a sincronização da área (SincronizarPapel → usarPapel) gravar, se ainda gravasse.
        await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
        await p.waitForTimeout(2_500);
        expect(await perfil(), "a visita à área do morador não grava nada").toEqual({ papel_ativo: "proprietario", preferred_mode: "owner" });

        await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
        if (w === 1280) await expect(p.getByTestId("topo-dono")).toHaveAttribute("data-papel", "proprietario", { timeout: 30_000 });
        else await expect(p.getByTestId("topo-celular")).toBeVisible({ timeout: 30_000 });
        await p.waitForTimeout(1_500);
        expect(await perfil(), "depois de voltar ao Início, segue o modo escolhido").toEqual({ papel_ativo: "proprietario", preferred_mode: "owner" });
      } finally {
        await p.context().close();
      }
    });
  }
});
