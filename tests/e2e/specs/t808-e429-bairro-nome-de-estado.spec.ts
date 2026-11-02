import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirNoEndereco, noPasso } from "../fixtures/cadastro";

/*
  T808 — E429 (02/11, achado do Daniel no uso real): no Passo 3, "Minas Gerais" — bairro OFICIAL de Uberlândia (CEP
  38402-288, Av. Comendador Alexandrino Garcia) — era recusado por ter o nome do estado. Consultas de CEP simuladas
  (ViaCEP e BrasilAPI) com o retorno real. A 390 e 1280:
   1. CEP 38402-288 → bairro "Minas Gerais" no campo, nenhum erro nem aviso, e o Continuar AVANÇA para o Passo 4;
   2. CEP comum (bairro "Santa Mônica") segue normal e avança;
   3. bairro digitado à mão diferente do CEP e com nome de estado → só um AVISO, e o Continuar AVANÇA.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t808.${sufixo}@lab.vivanomads.test`, nome: "Marta Bairro", role: "owner" as const };
const ids: Record<string, string> = {};

async function simularCep(page: Page, cep: string, rua: string, bairro: string) {
  await page.route("https://viacep.com.br/ws/**", (r) => r.fulfill({ json: { cep, logradouro: rua, bairro, localidade: "Uberlândia", uf: "MG", estado: "Minas Gerais" } }));
  await page.route("https://brasilapi.com.br/api/cep/**", (r) => r.fulfill({ json: { cep: cep.replace("-", ""), state: "MG", city: "Uberlândia", neighborhood: bairro, street: rua } }));
}

async function preencherEAvancar(page: Page, cep: string, numero: string) {
  await page.getByTestId("cadastro-cep").fill(cep.replace("-", ""));
  await expect(page.getByTestId("cadastro-cidade")).toHaveValue("Uberlândia", { timeout: 15_000 });
  await page.getByTestId("cadastro-numero").fill(numero);
}

test.describe("T808 — E429: bairro com nome de estado não trava o cadastro", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`1. a ${w} px: CEP 38402-288 (bairro Minas Gerais) avança sem erro`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await simularCep(page, "38402-288", "Avenida Comendador Alexandrino Garcia", "Minas Gerais");
      await abrirNoEndereco(page);
      await preencherEAvancar(page, "38402-288", "3441");
      await expect(page.getByTestId("cadastro-bairro")).toHaveValue("Minas Gerais");
      await expect(page.getByTestId("aviso-bairro")).toHaveCount(0);
      await page.screenshot({ path: `tests/laboratorio/saida/t808-minas-gerais-${w}.png` });
      await page.getByTestId("cadastro-continuar").click();
      await noPasso(page, "detalhes", 20_000);
      await expect(page.getByText(/é um estado, não um bairro/)).toHaveCount(0);
      await page.context().close();
    });

    test(`2. a ${w} px: CEP comum (Santa Mônica) segue normal`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await simularCep(page, "38408-100", "Avenida João Naves de Ávila", "Santa Mônica");
      await abrirNoEndereco(page);
      await preencherEAvancar(page, "38408-100", "2121");
      await expect(page.getByTestId("cadastro-bairro")).toHaveValue("Santa Mônica");
      await page.getByTestId("cadastro-continuar").click();
      await noPasso(page, "detalhes", 20_000);
      await page.context().close();
    });

    test(`3. a ${w} px: digitado à mão diferente do CEP só AVISA e não trava`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await simularCep(page, "38408-100", "Avenida João Naves de Ávila", "Santa Mônica");
      await abrirNoEndereco(page);
      await preencherEAvancar(page, "38408-100", "2121");
      await expect(page.getByTestId("cadastro-bairro")).toHaveValue("Santa Mônica");
      await page.getByTestId("cadastro-bairro").fill("Minas Gerais");
      // O pedido "O CEP indica … — confirmar?" pode aparecer no lugar do aviso; os dois só informam.
      await expect(page.getByTestId("aviso-bairro").or(page.getByText(/O CEP indica/))).toBeVisible({ timeout: 10_000 });
      await page.screenshot({ path: `tests/laboratorio/saida/t808-divergente-${w}.png` });
      await page.getByTestId("cadastro-continuar").click();
      await noPasso(page, "detalhes", 20_000);
      await page.context().close();
    });
  }
});
