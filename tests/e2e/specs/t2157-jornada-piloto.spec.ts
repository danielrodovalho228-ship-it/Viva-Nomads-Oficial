import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2157 — Jornada do piloto @criticos (ORDEM-DUET-138, item 4: "spec de jornada").
  Percorre a jornada do piloto no laboratório (contas de teste, integrações simuladas), de ponta a ponta, até a última
  etapa APROVADA na sequência crítica do Gerente:
    1 cadastro → 2 anúncio → 3 busca → 4 candidatura/conversa → 5 pré-aceite → 6 proposta → 7 contrato → 8 estadia →
    9 saída/caução → 10 avaliação.
  Roda em todo PR pelo lab-crítico (fluxo "jornada-piloto" em tests/laboratorio/fluxos-criticos.json). PR que deixa a
  jornada vermelha não entra.

  Como cresce: a cada item aprovado na sequência, a pista que fez o item acrescenta o passo dele aqui, no mesmo PR do
  item, como um `test("Etapa N — …")` novo no fim do describe (a ordem dos testes é a ordem da jornada; o describe é
  serial e as etapas partilham as contas e os ids de `jornada`). Nenhuma etapa entra antes de ser aprovada.

  Etapa 0 (a porta de entrada, já na main): é o chão de que todas as etapas dependem — o visitante chega à busca com
  resultados e as duas contas do piloto (dono e inquilino) entram pela tela e chegam ao painel. Nenhuma etapa da
  sequência foi aprovada ainda (a fila por etapa do Gerente chega numa ordem seguinte).
*/
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const sufixo = novoSufixo();
const senha = novaSenha();
const jornada: { dono?: string; inquilino?: string } = {};
const contas = {
  dono: { email: `t2157-dono-${sufixo}@laboratorio.test`, nome: `Dono Jornada ${sufixo}`, role: "owner" as const },
  inquilino: { email: `t2157-inq-${sufixo}@laboratorio.test`, nome: `Inquilino Jornada ${sufixo}`, role: "tenant" as const },
};

test.describe("T2157 — jornada do piloto, até a última etapa aprovada @criticos", () => {
  test.skip(!NO_LABORATORIO, "só no laboratório (contas de teste e integrações simuladas)");

  test.beforeAll(async () => {
    jornada.dono = await criarConta(contas.dono, senha);
    jornada.inquilino = await criarConta(contas.inquilino, senha);
  });

  test.afterAll(async () => {
    await apagarContas([jornada.dono, jornada.inquilino]);
  });

  test("Etapa 0 — o visitante chega à busca com resultados", async ({ page }) => {
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("card-resultado").first(), "a busca do visitante mostra anúncios").toBeVisible({ timeout: 30_000 });
  });

  test("Etapa 0 — dono e inquilino do piloto entram pela tela e chegam ao painel", async ({ browser }) => {
    for (const quem of ["dono", "inquilino"] as const) {
      const page = await entrar(browser, contas[quem].email, senha);
      await expect(page, `${quem}: entra e chega ao painel`).toHaveURL(/\/dashboard/);
      await page.context().close();
    }
  });

  // Etapa 1 (cadastro e conta) entra aqui, no PR do item aprovado.
});
