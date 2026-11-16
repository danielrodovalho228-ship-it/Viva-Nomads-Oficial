import { test, expect } from "@playwright/test";
import { TEMPO_MAX_SUGESTAO_MS } from "../../../src/lib/anuncio/texto-sugerido";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T2109 — E618 (Pista 3; varredura "sem spec" das 142, lote G) @E618 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E618; unitário e618-sugestao-sem-promessa.test.ts): no Passo 7 (Título e descrição) os campos NÃO
  prometem sugestão — o placeholder é sempre o exemplo ("Ex.: Studio mobiliado no Centro" / "Descreva o imóvel…"),
  nunca "Escrevendo uma sugestão…". O "a caminho" é um status à parte, junto do cartão da sugestão, e o pedido tem
  tempo máximo (TEMPO_MAX_SUGESTAO_MS): passado ele, entra o texto pronto — o status nunca fica pendurado.
  Montagem: rascunho com título e descrição vazios e documento aprovado (é quando o editor pede a sugestão ao entrar).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2109.${sufixo}@lab.vivanomads.test`, nome: "Sonia Sugestao", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T2109 — E618: Passo 7 sem promessa no campo; a sugestão chega no tempo máximo @E618", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
  });

  test.beforeEach(async () => {
    // Um rascunho novo por teste (a sugestão só é pedida uma vez por rascunho).
    const { data, error } = await adm()
      .from("properties")
      .insert({
        owner_id: ids.dono, title: "", description: "", property_type: "Apartamento", address: "Centro", city: "Uberlândia", state: "MG",
        bedrooms: 1, bathrooms: 1, area_m2: 40, max_guests: 2, min_period_days: 30, max_period_days: 180, monthly_price: 3000, status: "draft",
      })
      .select("id")
      .single();
    if (error) throw error;
    ids.rascunho = data.id as string;
    const { error: e2 } = await adm()
      .from("qualification_checklists")
      .insert({ owner_id: ids.dono, property_id: ids.rascunho, document_status: "approved", document_reviewed_at: new Date().toISOString() });
    if (e2) throw e2;
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — placeholders de exemplo, nada de Escrevendo uma sugestão, e o status sai dentro do tempo máximo`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const vistos: string[] = [];
      // Guarda todo placeholder que os campos tiverem enquanto a sugestão é preparada.
      const registrar = async () => {
        for (const id of ["cadastro-titulo", "cadastro-descricao"]) {
          const ph = await p.getByTestId(id).getAttribute("placeholder").catch(() => null);
          if (ph) vistos.push(ph);
        }
      };

      await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=descricao`, { waitUntil: "domcontentloaded" });
      await noPasso(p, "descricao", 30_000);
      await registrar();
      await expect(p.getByTestId("cadastro-titulo")).toHaveAttribute("placeholder", "Ex.: Studio mobiliado no Centro");
      await expect(p.getByTestId("cadastro-descricao")).toHaveAttribute("placeholder", "Descreva o imóvel…");

      // O "a caminho" (se aparecer) é um status fora dos campos, e sai dentro do tempo máximo.
      const preparando = p.getByTestId("sugestao-preparando");
      if (await preparando.isVisible().catch(() => false)) {
        await expect(preparando).toHaveAttribute("role", "status");
        await expect(preparando).not.toContainText("Escrevendo");
        await registrar();
      }
      await expect(preparando, "o status não fica pendurado além do tempo máximo").toBeHidden({ timeout: TEMPO_MAX_SUGESTAO_MS + 5_000 });
      await expect(p.getByTestId("sugestao-cartao").or(p.getByTestId("sugestao-aviso")).first(), "passado o pedido, a sugestão (ou o aviso) está à vista").toBeVisible();
      await registrar();

      expect(vistos.filter((v) => /Escrevendo|sugest/i.test(v)), "nenhum placeholder prometeu sugestão").toEqual([]);
      await expect(p.locator("main").getByText(/Escrevendo uma sugestão/)).toHaveCount(0);
      // A sugestão não entra sozinha nos campos (E613): eles continuam vazios até o dono usar.
      await expect(p.getByTestId("cadastro-titulo")).toHaveValue("");
      await expect(p.getByTestId("cadastro-descricao")).toHaveValue("");
      await p.context().close();
    });
  }
});
