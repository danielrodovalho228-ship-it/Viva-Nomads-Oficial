import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T2125 — E699 @E699: as travas da publicação aparecem desde o PASSO 1 do cadastro.
  Regra decidida (E699; unitário travas-publicacao.test.ts): quem começa o cadastro vê, já no Passo 1, o cartão "Para
  publicar, a Viva pede duas coisas", com a Confirmação de identidade e o Documento do imóvel (matrícula), cada um com o
  seu estado. O cartão não trava nada. O "Resolver" da identidade leva:
    - para a verificação (/dashboard/verificacao) quando a conta tem CPF;
    - para o CPF na conta (/dashboard/conta/dados#documento) quando não tem.
  Duas contas novas de proprietário (identidade não confirmada, nenhum documento enviado): uma com CPF e outra sem.
  Cadastro novo, Passo 1 (Tipo). 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const comCpf = { email: `dono.t2125a.${sufixo}@lab.vivanomads.test`, nome: "Ivo Identidade", role: "owner" as const };
const semCpf = { email: `dono.t2125b.${sufixo}@lab.vivanomads.test`, nome: "Iara Sem Documento", role: "owner" as const };
const ids: string[] = [];

const CASOS = [
  { conta: comCpf, nome: "com CPF", resolver: "/dashboard/verificacao" },
  { conta: semCpf, nome: "sem CPF", resolver: "/dashboard/conta/dados#documento" },
] as const;

test.describe("T2125 — E699: o cartão das travas da publicação já no Passo 1 @E699", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.push(await criarConta(comCpf, senha, true));
    ids.push(await criarConta(semCpf, senha, false));
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280] as const) {
    for (const caso of CASOS) {
      test(`${largura} px — conta ${caso.nome}: Passo 1 com identidade e documento em "falta", e o Resolver certo`, async ({ browser }) => {
        const p = await entrar(browser, caso.conta.email, senha);
        await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        await p.goto("/dashboard/imoveis/novo?etapa=tipo", { waitUntil: "domcontentloaded" });
        await noPasso(p, "tipo", 30_000);

        const cartao = p.getByTestId("travas-publicacao");
        await expect(cartao, "o cartão das travas já no Passo 1").toBeVisible({ timeout: 20_000 });
        await expect(cartao).toContainText("Para publicar, a Viva pede duas coisas");

        const identidade = cartao.getByTestId("trava-identidade");
        await expect(identidade, "a identidade é conferida (não fica em carregando)").toHaveAttribute("data-estado", "falta", { timeout: 20_000 });
        await expect(identidade).toContainText("Confirmação de identidade — falta");
        await expect(identidade.getByTestId("trava-identidade-resolver")).toHaveAttribute("href", caso.resolver);

        const documento = cartao.getByTestId("trava-documento");
        await expect(documento).toHaveAttribute("data-estado", "falta");
        await expect(documento).toContainText("Documento do imóvel (matrícula) — falta");

        // Não trava nada: o Passo 1 segue com o Continuar.
        await expect(p.getByTestId("cadastro-continuar")).toBeEnabled();
        await p.context().close();
      });
    }
  }
});
