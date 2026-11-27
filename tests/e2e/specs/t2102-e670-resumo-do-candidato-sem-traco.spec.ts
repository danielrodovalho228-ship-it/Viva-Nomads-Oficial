import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2102 — E670 (Pista 3; varredura "sem spec" das 142, lote D) @E670 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E670; unitário e670-resumo-candidato.test.ts): a linha de resumo sob o nome do candidato não mostra
  categoria vazia como traço nem "atenção" sem motivo. Um candidato sem categoria profissional e sem motivo de atenção
  tem o resumo VAZIO, e a linha some — no cartão de Interessados e no perfil do candidato. O defeito era a linha
  "— · atenção".
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2102.${sufixo}@lab.vivanomads.test`, nome: "Lia Linharesumo", role: "owner" as const };
const inq = { email: `inq.t2102.${sufixo}@lab.vivanomads.test`, nome: "Caio Semcategoria", role: "tenant" as const };
const ids: Record<string, string> = {};

/** Nenhum traço de categoria vazia e nenhum "atenção" sem motivo (o "atenção:" com motivo seria permitido). */
async function semTracoNemAtencaoSolta(p: Page, onde: string) {
  const texto = await p.locator("main").innerText();
  expect(texto, `${onde}: o resumo antigo "— · atenção"`).not.toMatch(/—\s*·\s*atenção/);
  // Minúsculas de propósito: o selo do semáforo amarelo diz "Atenção" e é legítimo; o resumo é que dizia "atenção".
  expect(texto, `${onde}: "atenção" sem o motivo`).not.toMatch(/atenção(?!:)/);
}

test.describe("T2102 — E670: sem categoria e sem motivo, o resumo do candidato some (nada de traço · atenção) @E670", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    await adm().from("profiles").update({ professional_category: null }).eq("id", ids.inq);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do resumo ${sufixo}`, { ativo: true });
    ids.lead = await criarLead(ids.dono, ids.inq, ids.imovel);
  });

  test.afterAll(async () => {
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — Interessados e o perfil do candidato sem a linha de resumo vazia`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      await p.goto("/dashboard/leads", { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("candidato-nome").first(), "o cartão do candidato").toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("candidato-nome")).toHaveCount(1);
      await expect(p.getByTestId("candidato-resumo"), "Interessados: resumo vazio não vira linha").toHaveCount(0);
      await semTracoNemAtencaoSolta(p, "Interessados");

      await p.goto(`/dashboard/leads/${ids.lead}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("perfil-candidato")).toBeVisible({ timeout: 30_000 });
      await expect(p.getByTestId("perfil-candidato-resumo"), "perfil: resumo vazio não vira linha").toHaveCount(0);
      await semTracoNemAtencaoSolta(p, "Perfil do candidato");
      await p.context().close();
    });
  }
});
