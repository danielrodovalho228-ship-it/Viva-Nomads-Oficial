import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T603 — E190 (fila da vigia 29/10): a troca de papel acontece num clique só, nos DOIS sentidos, a partir da home
  (/dashboard) — o QA viu o 1º clique só recarregar a home do morador. Dois formatos de conta: dono com anúncio ativo e
  cadastro de morador com um rascunho (o formato da conta do QA). Cada troca é UM clique no item do menu da Conta, e o
  papel novo se mantém (a leitura do perfil e a guarda não desfazem a troca).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const contas = {
  dono: { email: `dono.t603.${sufixo}@lab.vivanomads.test`, nome: "Rui Troca", role: "owner" as const },
  morador: { email: `mor.t603.${sufixo}@lab.vivanomads.test`, nome: "Lia Troca", role: "tenant" as const },
};
const ids: Record<string, string> = {};

type Papel = "morador" | "dono";

function abas(p: Page, largura: number, papel: Papel) {
  return largura === 390 ? p.getByRole("navigation", { name: "Navegação principal" }) : p.getByTestId(`abas-${papel}`);
}

/** Papel visível agora (pelas abas: só o dono tem "Anúncios"; só o morador tem "Pedidos"). */
async function esperarPapel(p: Page, largura: number, papel: Papel) {
  const rotulo = papel === "dono" ? "Anúncios" : "Pedidos";
  const outro = papel === "dono" ? "Pedidos" : "Anúncios";
  const nav = abas(p, largura, papel);
  await expect(nav.locator("a").filter({ hasText: rotulo })).toHaveCount(1, { timeout: 30_000 });
  // Continua no papel novo (a leitura do perfil e a guarda chegam depois do recarregamento).
  await p.waitForTimeout(2_500);
  await expect(abas(p, largura, papel).locator("a").filter({ hasText: rotulo })).toHaveCount(1);
  await expect(abas(p, largura, papel).locator("a").filter({ hasText: outro })).toHaveCount(0);
}

/** UM clique: abre a Conta e toca no item de troca. */
async function trocarUmClique(p: Page, largura: number, de: Papel, item: "modo-proprietario" | "modo-morador") {
  const id = largura === 390 ? `conta-${de}-celular` : `conta-${de}`;
  const botao = largura === 390 ? p.getByTestId("topo-celular").getByTestId(id) : p.getByTestId(id);
  await expect(botao).toBeVisible({ timeout: 30_000 });
  await botao.click();
  await p.getByTestId(`${id}-${item}`).click();
  await expect(p).toHaveURL(/\/dashboard\/?$/, { timeout: 30_000 });
}

test.describe("T603 — E190: troca de papel num clique, nos dois sentidos", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(contas.dono, senha);
    ids.morador = await criarConta(contas.morador, senha);
    await criarImovelPronto(ids.dono, `Troca dono t603 ${sufixo}`, { ativo: true });
    await criarImovelPronto(ids.morador, `Troca rascunho t603 ${sufixo}`, { ativo: false });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.morador]);
  });

  for (const conta of ["dono", "morador"] as const) {
    for (const largura of [1280, 390] as const) {
      test(`${largura} px — ${conta === "dono" ? "dono com anúncio" : "morador com rascunho"}: home do morador → proprietário → morador, um clique cada`, async ({ browser }) => {
        await adm().from("profiles").update({ preferred_mode: "tenant", papel_ativo: "morador" }).eq("id", ids[conta]);
        const p = await entrar(browser, contas[conta].email, senha);
        await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await esperarPapel(p, largura, "morador");

        await trocarUmClique(p, largura, "morador", "modo-proprietario");
        await esperarPapel(p, largura, "dono");
        await p.screenshot({ path: `${SAIDA}/t603-${conta}-proprietario-${largura}.png` });
        expect((await adm().from("profiles").select("papel_ativo").eq("id", ids[conta]).single()).data?.papel_ativo).toBe("proprietario");

        await trocarUmClique(p, largura, "dono", "modo-morador");
        await esperarPapel(p, largura, "morador");
        await p.screenshot({ path: `${SAIDA}/t603-${conta}-morador-${largura}.png` });
        expect((await adm().from("profiles").select("papel_ativo").eq("id", ids[conta]).single()).data?.papel_ativo).toBe("morador");
        await p.context().close();
      });
    }
  }
});
