import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, TELEFONE_LAB, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2116 — E409 + E427 (com o E328) (Pista 3; varredura "sem spec" das 142, lote I) @E409 @E427 — sem @ao-vivo-seguro:
  precisa de sessão e do laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (unitário nome-visita.test.ts): na visita, o nome só aparece a partir da CONFIRMAÇÃO do horário (o
  aceite prático da visita). Antes, o dono vê "Quem vem: Interessado(a)" e o morador não vê quem recebe. Confirmada, o
  dono vê o nome COMPLETO de quem vem (E427) e o morador vê "Quem recebe: <nome completo>". Telefone e e-mail nunca
  aparecem (E409). Mede-se no detalhe da visita (/dashboard/visitas/<id>), para os dois lados.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2116.${sufixo}@lab.vivanomads.test`, nome: "Olavo Recebe Silva", role: "owner" as const };
const mor = { email: `mor.t2116.${sufixo}@lab.vivanomads.test`, nome: "Tania Visitante Souza", role: "tenant" as const };
const ids: Record<string, string> = {};
const digitos = TELEFONE_LAB.replace(/\D/g, "");

async function detalhe(p: Page) {
  await p.goto(`/dashboard/visitas/${ids.visita}`, { waitUntil: "domcontentloaded" });
  await expect(p.getByTestId("visita-detalhe")).toBeVisible({ timeout: 30_000 });
}
async function semContato(p: Page, outro: { email: string }) {
  const texto = await p.locator("main").innerText();
  expect(texto.includes(outro.email), "o e-mail da outra parte nunca aparece").toBe(false);
  expect(texto.replace(/\D/g, "").includes(digitos), "o telefone da outra parte nunca aparece").toBe(false);
}

test.describe("T2116 — E409/E427: na visita, o nome só depois da confirmação, e nunca o contato @E409 @E427", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.mor = await criarConta(mor, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio da visita ${sufixo}`, { ativo: true });
    const H = new Date(Date.now() + 4 * 86_400_000);
    H.setUTCHours(14, 0, 0, 0);
    ids.H = H.toISOString();
    const { data, error } = await adm()
      .from("visitas_video")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, tenant_id: ids.mor, horarios: [ids.H], modalidade: "presencial", status: "pedido" })
      .select("id")
      .single();
    if (error) throw error;
    ids.visita = data.id as string;
  });

  test.afterAll(async () => {
    if (ids.imovel) await adm().from("visitas_video").delete().eq("property_id", ids.imovel);
    await apagarContas([ids.dono, ids.mor]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — pedida: Interessado(a) e ninguém do outro lado; confirmada: os nomes completos; nunca o contato`, async ({ browser }) => {
      await adm().from("visitas_video").update({ status: "pedido", horario_confirmado: null }).eq("id", ids.visita);
      const d = await entrar(browser, dono.email, senha);
      const m = await entrar(browser, mor.email, senha);
      for (const p of [d, m]) await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      // Pedida: protegido dos dois lados.
      await detalhe(d);
      await expect(d.getByTestId("visita-pessoa")).toHaveText(/Quem vem: Interessado\(a\)/);
      await expect(d.locator("main")).not.toContainText("Tania");
      await semContato(d, mor);
      await detalhe(m);
      await expect(m.getByTestId("visita-pessoa-dono"), "antes da confirmação o morador não vê quem recebe").toHaveCount(0);
      await expect(m.locator("main")).not.toContainText("Olavo");
      await semContato(m, dono);

      // Confirmada: o aceite prático — os nomes completos, sem contato.
      await adm().from("visitas_video").update({ status: "confirmado", horario_confirmado: ids.H }).eq("id", ids.visita);
      await detalhe(d);
      await expect(d.getByTestId("visita-pessoa")).toHaveText(/Quem vem: Tania Visitante Souza/);
      await semContato(d, mor);
      await detalhe(m);
      await expect(m.getByTestId("visita-pessoa-dono")).toHaveText(/Quem recebe: Olavo Recebe Silva/);
      await semContato(m, dono);
      await d.context().close();
      await m.context().close();
    });
  }
});
