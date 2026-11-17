import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2121 — E556 @E556: Meus imóveis lê o rascunho pela mesma regra do editor.
  Regra decidida (E556; unitários e556-fatos-do-rascunho.test.ts e e556-fonte-unica.test.ts): no rascunho, as colunas
  internet_mbps, sem_cameras_interior e garantias_aceitas só são gravadas ao publicar. O card de Meus imóveis lê a
  internet, a privacidade e a garantia do draft_data (o que o editor mostra). Se o draft_data responde, vale a
  resposta, nunca a coluna vazia.
  Dois rascunhos com as MESMAS colunas vazias (internet_mbps nulo, sem câmeras = false, garantias_aceitas = []):
    - A: draft_data com 300 Mbps, "sem câmeras no interior" marcado e caução à vista → o card NÃO lista internet,
      privacidade nem garantia em "Falta para publicar";
    - B (controle): draft_data com as respostas vazias → o card lista os três (é a mesma tela, só muda o rascunho).
  390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2121.${sufixo}@lab.vivanomads.test`, nome: "Dora Rascunho Card", role: "owner" as const };
const ids: Record<string, string> = {};
const TITULO_A = `Rascunho T2121 respondido ${sufixo}`;
const TITULO_B = `Rascunho T2121 vazio ${sufixo}`;
const ITENS = ["pendencia-internet", "pendencia-privacidade", "pendencia-garantia"] as const;

async function rascunho(titulo: string, draftData: Record<string, unknown>): Promise<string> {
  const { data, error } = await adm()
    .from("properties")
    .insert({
      owner_id: ids.dono, title: titulo, description: "Rascunho do laboratório para conferir a leitura do draft_data em Meus imóveis.",
      property_type: "Apartamento", address: "Centro", city: "Uberlândia", state: "MG", bedrooms: 1, bathrooms: 1, area_m2: 40, max_guests: 2,
      min_period_days: 30, max_period_days: 180, monthly_price: 3000, status: "draft",
      internet_mbps: null, sem_cameras_interior: false, garantias_aceitas: [],
      draft_data: draftData,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

test.describe("T2121 — E556: o card de Meus imóveis lê internet, privacidade e garantia do rascunho @E556", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    ids.a = await rascunho(TITULO_A, {
      internetMbps: "300",
      privacidade: { semCamerasInterior: true },
      garantias: { caucao_avista: true, caucao_parcelada: false, seguro_fianca: false },
    });
    ids.b = await rascunho(TITULO_B, {
      internetMbps: "",
      privacidade: { semCamerasInterior: false },
      garantias: { caucao_avista: false, caucao_parcelada: false, seguro_fianca: false },
    });
  });

  test.afterAll(async () => {
    for (const k of ["a", "b"]) if (ids[k]) await adm().from("properties").delete().eq("id", ids[k]);
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — rascunho respondido sem as três faltas; o vazio (controle) com as três`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });

      const cardA = p.getByTestId("meu-anuncio").filter({ hasText: TITULO_A });
      const cardB = p.getByTestId("meu-anuncio").filter({ hasText: TITULO_B });
      await expect(cardA.getByTestId("prontidao"), "o card do rascunho A mostra a prontidão").toBeVisible({ timeout: 30_000 });
      await expect(cardB.getByTestId("falta-publicar"), "o card do rascunho B mostra o que falta").toBeVisible({ timeout: 30_000 });

      // Controle: com o draft_data vazio, as três faltas aparecem (a tela sabe mostrá-las).
      for (const item of ITENS) await expect(cardB.getByTestId(item), `controle: ${item} no rascunho vazio`).toHaveCount(1);
      // A: o draft_data respondeu; a coluna vazia não vale.
      for (const item of ITENS) await expect(cardA.getByTestId(item), `${item} não pode faltar no rascunho respondido`).toHaveCount(0);
      await p.context().close();
    });
  }
});
