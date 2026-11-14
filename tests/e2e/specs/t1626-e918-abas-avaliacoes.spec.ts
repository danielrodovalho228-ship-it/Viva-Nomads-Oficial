import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1626 — E918: em /dashboard/avaliacoes a aba "Recebidas" tem de ATIVAR (clicada e por URL direta) e mostrar as
  avaliações recebidas; "Para avaliar" não pode continuar ativa. Guarda as três abas: a ativa (aria-current) e o conteúdo
  de cada uma, pelo endereço e pelo clique, a 390 e 1280 px, para morador e dono (contas novas do laboratório).
  Caso real (prova ao vivo do Gerente, 14/11): conta de dono SEM avaliação nenhuma (estado vazio), "Recebidas" clicada 2× e
  aberta por /dashboard/avaliacoes?tab=recebidas — a página só lia ?aba=. As contas daqui também nascem sem avaliações.
*/
const ABAS = [
  { valor: "para-avaliar", rotulo: "Para avaliar", conteudo: "painel-para-avaliar" },
  { valor: "recebidas", rotulo: "Recebidas", conteudo: "avaliacoes-aba-todas" },
  { valor: "feitas", rotulo: "Feitas", conteudo: "painel-feitas" },
] as const;

async function conferirAtiva(p: Page, aba: (typeof ABAS)[number], onde: string) {
  const fileira = p.getByTestId("painel-abas");
  await expect(fileira.locator('[aria-current="page"]'), `${onde}: uma só aba ativa`).toHaveCount(1);
  await expect(fileira.locator('[aria-current="page"]'), `${onde}: a aba ativa`).toHaveAttribute("data-testid", `painel-aba-${aba.valor}`);
  await expect(p.getByTestId(aba.conteudo).first(), `${onde}: o conteúdo de "${aba.rotulo}"`).toBeVisible();
  for (const outra of ABAS.filter((a) => a.valor !== aba.valor)) {
    await expect(p.getByTestId(outra.conteudo), `${onde}: o conteúdo de "${outra.rotulo}" não aparece`).toHaveCount(0);
  }
}

test.describe("T1626 — E918 abas do painel Avaliações", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  const senha = novaSenha();
  const contas = (["tenant", "owner"] as const).map((role) => ({ email: `${role}.t1626.${novoSufixo()}@lab.vivanomads.test`, nome: "Iara Abas", role }));
  const ids: string[] = [];
  test.beforeAll(async () => {
    for (const c of contas) ids.push(await criarConta(c, senha));
    await adm().from("profiles").update({ is_teste: true }).in("id", ids);
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const [i, papel] of (["morador", "dono"] as const).entries()) {
    for (const [largura, altura] of [[390, 844], [1280, 900]] as const) {
      test(`${papel} ${largura} px: cada aba ativa pelo endereço e pelo clique`, async ({ browser }) => {
        test.setTimeout(180_000);
        const p = await entrar(browser, contas[i].email, senha);
        await p.setViewportSize({ width: largura, height: altura });
        for (const aba of ABAS) {
          for (const param of ["aba", "tab"]) {
            await p.goto(`/dashboard/avaliacoes?${param}=${aba.valor}`, { waitUntil: "domcontentloaded" });
            await conferirAtiva(p, aba, `${papel} ${largura} URL ?${param}=${aba.valor}`);
          }
        }
        // Estado vazio, como no caso real: nada para avaliar e nenhuma recebida.
        await p.goto("/dashboard/avaliacoes", { waitUntil: "domcontentloaded" });
        await expect(p.getByTestId("painel-sem-recebidas"), "conta sem avaliações (estado vazio)").toBeVisible();
        // Dois cliques seguidos em "Recebidas" (o roteiro da prova ao vivo).
        await p.getByTestId("painel-aba-recebidas").click();
        await p.getByTestId("painel-aba-recebidas").click();
        await expect(p).toHaveURL(/aba=recebidas/);
        await conferirAtiva(p, ABAS[1], `${papel} ${largura} dois cliques em "Recebidas"`);
        await p.goto("/dashboard/avaliacoes", { waitUntil: "domcontentloaded" });
        await conferirAtiva(p, ABAS[0], `${papel} ${largura} sem ?aba`);
        for (const aba of [ABAS[1], ABAS[2], ABAS[0], ABAS[1]]) {
          await p.getByTestId(`painel-aba-${aba.valor}`).click();
          await expect(p).toHaveURL(new RegExp(`aba=${aba.valor}`));
          await conferirAtiva(p, aba, `${papel} ${largura} clique em "${aba.rotulo}"`);
        }
        await p.context().close();
      });
    }
  }
});
