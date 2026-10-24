import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T194 — Cadastro do anúncio, passo do Endereço (prompt 20; era o passo 1 dos 6 passos, é o 3º dos 10), a 390 e 1280 px:
  1. No topo, UM cartão "Deixe a IA preencher o anúncio para você" (Enviar fotos / Enviar matrícula); as duas caixas
     tracejadas saíram e viraram uma linha discreta no fim ("Importar" · "Falar com a equipe").
  2. CEP que sempre responde: ViaCEP → BrasilAPI. Achou → "Endereço encontrado" e foco no Número; 38482-288 (o do print)
     → "Não encontramos esse CEP" + "busque pelo endereço", que preenche o CEP certo; sem rede → mensagem.
  3. Fotos pelo cartão sobem para a galeria do passo Fotos e a IA analisa sozinha ("Analisando…" → "Pronto: …").
  4. Celular: barra de fotos fixa no rodapé em todos os passos; no topo, "Passo X de 10" com a barra de progresso (a
     faixa de passos dos 6 passos saiu). No computador, a foto aparece na prévia ao vivo.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const FOTOS = ["sala", "quarto-1", "quarto-2", "cozinha", "banheiro", "home-office", "varanda", "fachada"].map((n) => `public/images/imoveis/ube/ube-001-${n}.webp`);
const ids: Record<number, string> = {};

const VIACEP = "https://viacep.com.br/ws/**";
const BRASILAPI = "https://brasilapi.com.br/api/cep/v2/**";

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

/** Conta nova (sem rascunho): abre direto no passo Endereço pelo nome na URL. */
async function abrirPasso1(page: Page) {
  await page.goto("/dashboard/imoveis/novo?etapa=endereco", { waitUntil: "domcontentloaded" });
  await noPasso(page, "endereco");
}

test.describe("T194 — passo 1: IA primeiro, CEP que sempre responde, fotos à vista", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (integrações simuladas).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    for (const l of [390, 1280]) ids[l] = await criarConta({ email: `dono.p20.${l}.${sufixo}@lab.vivanomads.test`, nome: `Paulo ${l === 390 ? "Celular" : "Computador"} Sobrenome`, role: "owner" }, senha);
  });
  test.afterAll(async () => {
    await apagarContas(Object.values(ids));
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px — cartão da IA no topo, CEP com resposta em todos os casos, fotos pelo cartão`, async ({ browser }) => {
      const page = await entrar(browser, `dono.p20.${largura}.${sufixo}@lab.vivanomads.test`, senha);
      await page.setViewportSize({ width: largura, height: 900 });

      // CEPs simulados (o laboratório não sai para a rede): um que existe, o do print (não existe em lugar nenhum),
      // a busca reversa pelo endereço e um que cai sem rede.
      await page.route(VIACEP, async (r) => {
        const url = r.request().url();
        if (url.includes("/38400100/")) return r.fulfill({ json: { cep: "38400-100", logradouro: "Avenida do Laboratório", bairro: "Centro", localidade: "Uberlândia", uf: "MG" } });
        if (url.includes("/38482288/")) return r.fulfill({ json: { erro: "true" } });
        if (url.includes("/99999999/")) return r.abort("internetdisconnected");
        if (/\/MG\/Uberl/.test(url)) return r.fulfill({ json: [{ cep: "38400-200", logradouro: "Rua do Teste", bairro: "Fundinho", localidade: "Uberlândia", uf: "MG" }] });
        return r.fulfill({ json: { erro: "true" } });
      });
      await page.route(BRASILAPI, async (r) => {
        if (r.request().url().includes("99999999")) return r.abort("internetdisconnected");
        return r.fulfill({ status: 404, json: { message: "CEP não encontrado" } });
      });

      await abrirPasso1(page);

      // 1) Cartão da IA no topo; caixas tracejadas fora; atalhos numa linha no fim.
      const passo = page.getByTestId("etapa-onde-fica");
      const cartao = page.getByTestId("cartao-ia");
      await expect(cartao).toBeVisible();
      await expect(cartao.getByRole("heading", { name: "Deixe a IA preencher o anúncio para você" })).toBeVisible();
      await expect(cartao.getByTestId("cartao-ia-fotos")).toHaveText(/Enviar fotos/);
      await expect(cartao.getByTestId("cartao-ia-matricula")).toHaveText(/Enviar matrícula/);
      expect(await passo.evaluate((el) => el.firstElementChild?.getAttribute("data-testid"))).toBe("cartao-ia");
      await expect(page.getByText("Já tem um anúncio em outro site? Importar meu anúncio")).toHaveCount(0);
      await expect(page.getByTestId("ajuda-publicar")).toHaveCount(0);
      const atalhos = page.getByTestId("atalhos-passo1");
      await expect(atalhos).toContainText("Já tem anúncio em outro site?");
      await expect(atalhos).toContainText("Prefere ajuda?");
      expect(await passo.evaluate((el) => {
        const filhos = [...el.children].map((c) => c.getAttribute("data-testid"));
        return filhos.indexOf("atalhos-passo1") > filhos.indexOf("documento-vinculo");
      })).toBe(true);
      // O atalho de importar continua funcionando pela linha de baixo.
      await atalhos.getByTestId("importar-abrir").click();
      await expect(page.getByTestId("importar-aviso")).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/t194-passo1-${largura}.png`, fullPage: true });

      // Topo dos 10 passos: "Passo 3 de 10" numa linha só, sem texto cortado, e a barra de progresso (no lugar da
      // faixa de passos). Celular: barra de fotos fixa à vista.
      const topo = page.getByTestId("cabecalho-passos");
      await expect(page.getByTestId("passo-texto")).toHaveText("Passo 3 de 10");
      expect(await page.getByTestId("passo-texto").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await expect(topo.getByRole("progressbar", { name: "Progresso do cadastro" })).toHaveAttribute("aria-valuenow", "30");
      if (largura === 390) {
        await expect(page.getByTestId("barra-fotos")).toBeVisible();
        await expect(page.getByTestId("barra-fotos-contador")).toHaveText(/Fotos: 0 de 8 mínimas/);
      } else {
        await expect(page.getByTestId("barra-fotos")).toBeHidden();
        await expect(page.getByTestId("novo-resumo").getByTestId("previa-sem-foto")).toBeVisible();
      }

      // 2) CEP do print (38482-288): nada encontrado → mensagem visível, sem apagar o digitado.
      const cep = page.getByTestId("cadastro-cep");
      await cep.fill("38482288");
      const resultado = page.getByTestId("cep-resultado");
      await expect(resultado).toHaveAttribute("data-tipo", "nao_encontrado", { timeout: 15_000 });
      await expect(resultado).toContainText("Não encontramos esse CEP — buscar pelo endereço");
      await expect(cep).toHaveValue("38482-288");
      await cep.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t194-cep-nao-encontrado-${largura}.png`, fullPage: false });

      // "Buscar pelo endereço" preenche o CEP certo e a rua.
      await resultado.getByTestId("cep-buscar-endereco").click();
      const busca = page.getByTestId("busca-endereco");
      await busca.getByTestId("busca-endereco-uf").selectOption("MG");
      await busca.getByTestId("busca-endereco-cidade").fill("Uberlândia");
      await busca.getByTestId("busca-endereco-rua").fill("Rua do Te");
      await busca.getByTestId("busca-endereco-buscar").click();
      await expect(busca.getByTestId("busca-endereco-opcao")).toHaveCount(1);
      await busca.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t194-busca-endereco-${largura}.png`, fullPage: false });
      await busca.getByTestId("busca-endereco-opcao").first().click();
      await expect(cep).toHaveValue("38400-200");
      await expect(page.getByTestId("cadastro-rua")).toHaveValue("Rua do Teste");
      await expect(page.getByTestId("cep-resultado")).toHaveAttribute("data-tipo", "rua");
      await expect(page.getByTestId("busca-endereco")).toHaveCount(0);

      // CEP que existe: "Endereço encontrado" e o foco vai para o Número.
      await page.getByTestId("cadastro-rua").fill("");
      await cep.fill("38400100");
      await expect(page.getByTestId("cep-resultado")).toHaveText("Endereço encontrado", { timeout: 15_000 });
      await expect(page.getByTestId("cadastro-rua")).toHaveValue("Avenida do Laboratório");
      await expect(page.getByTestId("cadastro-numero")).toBeFocused();
      await cep.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t194-cep-encontrado-${largura}.png`, fullPage: false });

      // Sem rede nas duas bases: mensagem para preencher à mão.
      await cep.fill("99999999");
      await expect(page.getByTestId("cep-resultado")).toHaveText("Não conseguimos buscar agora — preencha o endereço abaixo", { timeout: 15_000 });

      // CEP incompleto: o aviso só aparece ao sair do campo.
      await cep.fill("3840");
      await expect(page.getByTestId("cep-incompleto")).toHaveCount(0);
      await page.getByTestId("cadastro-numero").focus();
      await expect(page.getByTestId("cep-incompleto")).toHaveText("O CEP tem 8 números.");
      await cep.fill("38400100");

      // 3) Fotos pelo cartão: sobem para a galeria e a IA analisa sozinha (resposta fixa do laboratório).
      await cartao.getByTestId("cartao-ia-input").setInputFiles(FOTOS);
      const status = cartao.getByTestId("cartao-ia-status");
      await expect(status).toContainText(/Enviando|Analisando|Pronto/, { timeout: 30_000 });
      await expect(status).toHaveAttribute("data-estado", "feita", { timeout: 90_000 });
      await expect(status).toContainText(/^Pronto: /);
      await expect(status.getByTestId("cartao-ia-ver-passo3")).toBeVisible();
      await cartao.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t194-cartao-ia-pronto-${largura}.png`, fullPage: false });
      if (largura === 390) {
        await expect(page.getByTestId("barra-fotos-contador")).toContainText("Fotos: 8 enviadas");
      } else {
        // O contador "(8)" da faixa de passos saiu com ela: no computador, a foto principal entra na prévia ao vivo.
        await expect(page.getByTestId("novo-resumo").getByTestId("previa-foto")).toBeVisible();
      }
      await semRolagemLateral(page);

      // "Ver no passo": leva às Comodidades, com o que a IA preencheu marcado para conferir.
      await status.getByTestId("cartao-ia-ver-passo3").click();
      await noPasso(page, "comodidades", 15_000);
      await expect(page.getByTestId("ia-resumo")).toBeVisible();
      // O título sugerido pela IA agora fica no passo "Título e descrição" (2 passos adiante, sem trava no caminho).
      await page.getByTestId("cadastro-continuar").click();
      await noPasso(page, "regras");
      await page.getByTestId("cadastro-continuar").click();
      await noPasso(page, "descricao");
      await expect(page.getByTestId("cadastro-titulo")).not.toHaveValue("");
      // As fotos estão na galeria do passo Fotos (a mesma). Celular: "Organizar" da barra; computador (a faixa de passos
      // clicável saiu): "Voltar para o passo anterior" até as Fotos (Descrição → Regras → Comodidades → Detalhes →
      // Endereço → Fotos).
      if (largura === 390) await page.getByTestId("barra-fotos").getByRole("button", { name: "Organizar" }).click();
      else {
        for (const passo of ["regras", "comodidades", "detalhes", "endereco"] as const) {
          await page.getByTestId("cadastro-voltar").click();
          await noPasso(page, passo);
        }
        await page.getByTestId("cadastro-voltar").click();
      }
      await noPasso(page, "fotos", 15_000);
      await expect(page.getByText(/^8\/40 fotos/)).toBeVisible();
      if (largura === 390) {
        // A barra continua à vista no passo Fotos (e em todos os outros).
        await expect(page.getByTestId("barra-fotos")).toBeVisible();
      }
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t194-passo2-galeria-${largura}.png`, fullPage: false });
      await page.context().close();
    });
  }
});
