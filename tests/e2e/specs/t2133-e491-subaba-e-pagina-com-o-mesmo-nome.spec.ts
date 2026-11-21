import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2133 — E491 @E491: a subaba e a página que ela abre têm o MESMO nome (nome = destino).
  Regra decidida (E491; unitário src/config/e491-orcamentos-nome.test.ts):
    - dono: a subaba de Interessados que abre /dashboard/orcamentos chama-se "Orçamentos", e a página aberta tem o
      título "Orçamentos";
    - morador: a subaba de Pedidos que abre /dashboard/propostas chama-se "Propostas", e a página tem o título
      "Propostas".
  O t459 prova o rótulo da subaba do dono. Esta spec prova o caminho inteiro, pelo clique: o rótulo da subaba, o destino
  e o título da página que abre, nos dois papéis. 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2133.${sufixo}@lab.vivanomads.test`, nome: "Olga Orcamento", role: "owner" as const };
const morador = { email: `mor.t2133.${sufixo}@lab.vivanomads.test`, nome: "Paulo Proposta", role: "tenant" as const };
const ids: string[] = [];

const CASOS = [
  { conta: dono, papel: "dono", partida: "/dashboard/leads", subaba: "subaba-dono-propostas", nome: "Orçamentos", destino: "/dashboard/orcamentos" },
  { conta: morador, papel: "morador", partida: "/dashboard/pedidos", subaba: "subaba-morador-propostas", nome: "Propostas", destino: "/dashboard/propostas" },
] as const;

test.describe("T2133 — E491: subaba Orçamentos/Propostas abre a página com o mesmo nome @E491", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.push(await criarConta(dono, senha));
    ids.push(await criarConta(morador, senha));
    await adm().from("profiles").update({ preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids[0]);
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280] as const) {
    for (const c of CASOS) {
      test(`${largura} px — ${c.papel}: a subaba "${c.nome}" abre ${c.destino}, com o título "${c.nome}"`, async ({ browser }) => {
        const p = await entrar(browser, c.conta.email, senha);
        await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await p.goto(c.partida, { waitUntil: "domcontentloaded" });
        const sub = p.getByTestId(c.subaba).filter({ visible: true }).first();
        await expect(sub, "a subaba à vista").toBeVisible({ timeout: 30_000 });
        await expect(sub).toHaveText(c.nome);
        await expect(sub).toHaveAttribute("href", c.destino);
        await sub.click();
        await expect(p).toHaveURL(new RegExp(`${c.destino}(\\?|#|$)`), { timeout: 30_000 });
        await expect(p.locator("h1").filter({ visible: true }).first(), "o título da página é o nome da subaba").toHaveText(c.nome, { timeout: 30_000 });
        await expect(p.getByTestId(c.subaba).filter({ visible: true }).first(), "a subaba fica acesa no destino").toHaveAttribute("aria-current", "page");
        await p.context().close();
      });
    }
  }
});
