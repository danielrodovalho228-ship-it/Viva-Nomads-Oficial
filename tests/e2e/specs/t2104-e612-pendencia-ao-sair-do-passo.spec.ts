import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T2104 — E612 (Pista 3; varredura "sem spec" das 142, lote E) @E612 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E612; unitário e612-pendencia-ao-sair.test.ts): o "Continuar" dos Passos 5 e 6 segue livre mesmo
  com bloqueador de publicação, mas o passo SEGUINTE abre com o aviso do que ficou pendente lá — título
  "Ficou pendente no Passo N — <passo>", a lista do que falta, a nota "Você pode seguir; sem isso o anúncio não
  publica." e o atalho "Voltar ao Passo N". Passo aberto pelo endereço não mostra aviso.
  Montagem: um rascunho com os detalhes completos, sem o padrão mínimo confirmado e sem o tipo de entrada.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2104.${sufixo}@lab.vivanomads.test`, nome: "Paula Pendente", role: "owner" as const };
const ids: Record<string, string> = {};
const NOTA = "Você pode seguir; sem isso o anúncio não publica.";

test.describe("T2104 — E612: sair de um passo com bloqueador mostra no seguinte o que ficou pendente @E612", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeEach(async () => {
    ids.dono ??= await criarConta(dono, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    if (ids.rascunho) await adm().from("properties").delete().eq("id", ids.rascunho);
    const { data, error } = await adm()
      .from("properties")
      .insert({
        owner_id: ids.dono, title: `Rascunho T2104 ${sufixo}`, description: "Rascunho do laboratório para conferir o aviso de pendência ao sair do passo.",
        property_type: "Apartamento", address: "Centro", city: "Uberlândia", state: "MG", bedrooms: 1, bathrooms: 1, area_m2: 40, max_guests: 2,
        min_period_days: 30, max_period_days: 180, monthly_price: 3000, status: "draft", tipo_entrada: null,
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
    test(`${largura} px — Passo 5 e Passo 6 com bloqueador: o aviso no passo seguinte e o atalho de volta`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const aviso = p.getByTestId("pendencia-ao-sair");

      // Abrir o Passo 5 pelo endereço não traz aviso (ninguém saiu de passo nenhum).
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
      await noPasso(p, "comodidades", 30_000);
      await expect(aviso, "Passo 5 aberto pelo endereço: nenhum aviso").toHaveCount(0);

      // Passo 5 com o padrão mínimo por confirmar: o Continuar avança e o Passo 6 diz o que ficou.
      await p.getByTestId("cadastro-continuar").click();
      await noPasso(p, "regras");
      await expect(aviso).toBeVisible();
      await expect(aviso.locator("p").first()).toHaveText("Ficou pendente no Passo 5 — Comodidades");
      await expect(aviso.locator("li").filter({ hasText: /Padrão mínimo/ }), "o padrão mínimo na lista do que falta").toHaveCount(1);
      await expect(aviso).toContainText(NOTA);
      await expect(p.getByTestId("pendencia-ao-sair-voltar")).toHaveText("Voltar ao Passo 5");

      // O atalho volta ao Passo 5 e o aviso sai.
      await p.getByTestId("pendencia-ao-sair-voltar").click();
      await noPasso(p, "comodidades");
      await expect(aviso).toHaveCount(0);

      // Passo 6 sem o tipo de entrada: o Passo 7 diz que ficou pendente no Passo 6.
      await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=regras`, { waitUntil: "domcontentloaded" });
      await noPasso(p, "regras", 30_000);
      await expect(aviso, "abrir um passo pelo endereço não traz aviso").toHaveCount(0);
      await p.getByTestId("cadastro-continuar").click();
      await noPasso(p, "descricao");
      await expect(aviso).toBeVisible();
      await expect(aviso.locator("p").first()).toHaveText(/^Ficou pendente no Passo 6 — /);
      await expect(aviso.locator("li").first(), "a lista do que falta no Passo 6").toBeVisible();
      await expect(p.getByTestId("pendencia-ao-sair-voltar")).toHaveText("Voltar ao Passo 6");
      await p.context().close();
    });
  }
});
