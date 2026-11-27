import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso, type PassoCadastro } from "../fixtures/cadastro";

/*
  T2118 — E608 (Pista 3; varredura "sem spec" das 142, lote D) @E608 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E608; unitário e608-obrigatorios-marcados.test.ts): cada campo obrigatório para publicar, nos Passos
  2–5 do cadastro de um anúncio NOVO (rascunho), tem o asterisco ao lado do rótulo — com "(obrigatório para publicar)"
  para o leitor de tela — e o passo traz a legenda "Campos com * são obrigatórios para publicar.". O Passo 1 (tipo) não
  tem obrigatório na prontidão, então não tem legenda.
    - Passo 2 (Fotos): a contagem das 8 fotos leva a marca;
    - Passo 3 (Endereço): Rua, Número, Bairro e Cidade têm a marca; Complemento não;
    - Passo 4 (Detalhes): Banheiros, Área e Pessoas têm a marca; Quartos e Vagas não;
    - Passo 5 (Comodidades): a legenda e a marca; a internet já não se diz "(opcional)".
  O que se mede na tela: o rótulo ao lado de cada [data-testid=marca-obrigatorio] (o primeiro texto do mesmo rótulo).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2118.${sufixo}@lab.vivanomads.test`, nome: "Olga Obrigatoria", role: "owner" as const };
const ids: Record<string, string> = {};
const LEGENDA = "Campos com * são obrigatórios para publicar.";

/** Os rótulos marcados com o asterisco no passo aberto (o texto do primeiro <span> do rótulo da marca). */
const rotulosMarcados = (p: Page) =>
  p.getByTestId("marca-obrigatorio").evaluateAll((ms) =>
    ms.filter((m) => (m as HTMLElement).offsetParent !== null).map((m) => (m.parentElement?.firstElementChild?.textContent ?? "").trim()),
  );

async function abrir(p: Page, passo: PassoCadastro) {
  await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=${passo}`, { waitUntil: "domcontentloaded" });
  await noPasso(p, passo, 30_000);
}

test.describe("T2118 — E608: os obrigatórios dos Passos 2 a 5 têm o asterisco e a legenda @E608", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    const { data, error } = await adm()
      .from("properties")
      .insert({
        owner_id: ids.dono, title: `Rascunho T2118 ${sufixo}`, description: "Rascunho do laboratório para conferir os obrigatórios marcados.",
        property_type: "Apartamento", address: "Centro", city: "Uberlândia", state: "MG", bedrooms: 1, bathrooms: 1, area_m2: 40,
        min_period_days: 30, max_period_days: 180, monthly_price: 3000, status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.rascunho = data.id as string;
  });

  test.afterAll(async () => {
    if (ids.rascunho) await adm().from("properties").delete().eq("id", ids.rascunho);
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — Passos 1 a 5: a legenda e o asterisco só onde a prontidão exige`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      // Passo 1 — Tipo: nada obrigatório na prontidão, nem legenda.
      await abrir(p, "tipo");
      await expect(p.getByTestId("legenda-obrigatorio"), "Passo 1 sem legenda").toHaveCount(0);

      // Passo 2 — Fotos: a contagem das 8 fotos é obrigatória.
      await abrir(p, "fotos");
      await expect(p.getByTestId("legenda-obrigatorio")).toHaveText(LEGENDA);
      await expect(p.getByTestId("fotos-contagem"), "Passo 2: a contagem diz o mínimo de 8").toContainText("/ 8 fotos");
      await expect(p.getByTestId("fotos-contagem").getByTestId("marca-obrigatorio"), "Passo 2: a marca na contagem das fotos").toHaveCount(1);

      // Passo 3 — Endereço.
      await abrir(p, "endereco");
      await expect(p.getByTestId("legenda-obrigatorio")).toHaveText(LEGENDA);
      const endereco = await rotulosMarcados(p);
      for (const r of ["Rua", "Número", "Bairro"]) expect(endereco, `Passo 3: ${r} marcado`).toContain(r);
      expect(endereco.some((r) => r.startsWith("Cidade")), `Passo 3: Cidade marcada (${endereco.join(", ")})`).toBe(true);
      expect(endereco, "Passo 3: Complemento é opcional").not.toContain("Complemento");
      // O leitor de tela ouve o porquê do asterisco.
      await expect(p.getByTestId("marca-obrigatorio").first()).toContainText("(obrigatório para publicar)");

      // Passo 4 — Detalhes.
      await abrir(p, "detalhes");
      await expect(p.getByTestId("legenda-obrigatorio")).toHaveText(LEGENDA);
      const detalhes = await rotulosMarcados(p);
      for (const r of ["Banheiros", "Área", "Pessoas"]) expect(detalhes, `Passo 4: ${r} marcado`).toContain(r);
      for (const r of ["Quartos", "Vagas"]) expect(detalhes, `Passo 4: ${r} não é obrigatório`).not.toContain(r);

      // Passo 5 — Comodidades.
      await abrir(p, "comodidades");
      await expect(p.getByTestId("legenda-obrigatorio")).toHaveText(LEGENDA);
      expect((await rotulosMarcados(p)).length, "Passo 5: há obrigatórios marcados").toBeGreaterThan(0);
      await expect(p.getByText("Velocidade da internet informada (opcional)"), "a internet não se diz opcional no anúncio novo").toHaveCount(0);
      await p.context().close();
    });
  }
});
