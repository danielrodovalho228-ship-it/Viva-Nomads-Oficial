import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { esperarSemEsqueleto } from "../fixtures/esqueleto";

/*
  T1755 — E1112 @E1112 (a correcção da ORDEM-DUET-652, linha Parceiros): a categoria "avaliador" nasce pelo PEDIDO DE
  CREDENCIAMENTO (/dashboard/parceiro/avaliacao), e esse caminho não conferia contacto no "Nome público" — o nome que
  vira o nome público do parceiro na aprovação. A guarda do "Seja parceiro" passa a valer também aqui.
  Só conta de teste. Laboratório; não é prova ao vivo no site.
   1. Pedido com telefone no nome: recusado, com o aviso da casa junto do campo do nome (em vermelho, com o foco); os
      campos continuam preenchidos; NADA fica gravado (nem a solicitação de parceiro, nem o credenciamento).
      O mesmo com e-mail no nome. Print a 390 e a 1280 px.
   2. Pedido limpo nasce: a solicitação de parceiro (categoria "vistoria", com o nome) e o credenciamento "solicitado".
      P2 (ORDEM-DUET-668/672, forma 1): o caso começa com um envio SUJO (o aviso do nome aparece); depois o nome
      corrigido sem o aceite da conduta (o formulário fica e o aviso do nome TEM de ter sumido); só então o limpo.
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
// O aviso da casa (CONTATO_AVISO, src/lib/pedidos/pedidos.ts).
const AVISO = "Para sua segurança e registro, o contato acontece pela plataforma — remova telefone, e-mail ou apps de mensagem do texto.";
const NOME_LIMPO = "Abel Avaliações";
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `aval.t1755.${sufixo}@lab.vivanomads.test`, nome: "[TESTE QA] Abel Avaliador", role: "tenant" as const };
const cnpj = cnpjAleatorio();
const ids: Record<string, string> = {};

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
const gravado = async () => {
  const [sol, cred] = await Promise.all([
    adm().from("parceiro_solicitacoes").select("id, nome, categorias, status").eq("user_id", ids.conta),
    adm().from("avaliadores_credenciamento").select("id, status, cidade").eq("user_id", ids.conta),
  ]);
  if (sol.error) throw sol.error;
  if (cred.error) throw cred.error;
  return { solicitacoes: (sol.data ?? []) as { id: string; nome: string; categorias: string[]; status: string }[], credenciamentos: (cred.data ?? []) as { id: string; status: string; cidade: string }[] };
};
async function abrirFormulario(page: Page) {
  await page.goto("/dashboard/parceiro/avaliacao", { waitUntil: "domcontentloaded" });
  await esperarSemEsqueleto(page, "o pedido de credenciamento");
  const form = page.getByTestId("credenciamento-form").locator("form");
  await expect(form.locator('[name="nome"]')).toBeVisible({ timeout: 30_000 });
  // Espera a hidratação: antes dela, o envio é o nativo (recarrega a página) e não prova nada.
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  return form;
}
const preencher = async (form: ReturnType<Page["locator"]>, nome: string) => {
  const valores = { nome, documento: cnpj, cidade: "Uberlândia", experienciaLink: "https://portfolio.lab.vivanomads.test/t1755", relacoes: "Nenhuma relação com proprietários." };
  for (const [n, v] of Object.entries(valores)) await form.locator(`[name="${n}"]`).fill(v);
  await form.locator('[name="aceiteConduta"]').check();
  return valores;
};

test.describe("T1755 — E1112: o pedido de credenciamento recusa contacto no nome público @E1112", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
  });

  test.afterAll(async () => {
    if (ids.conta) {
      await adm().from("avaliadores_credenciamento").delete().eq("user_id", ids.conta);
      await adm().from("parceiro_solicitacoes").delete().eq("user_id", ids.conta);
    }
    await apagarContas([ids.conta]);
  });

  test("1. telefone (ou e-mail) no nome: recusado com o aviso junto do campo; os campos ficam; nada é gravado", async ({ browser }) => {
    const page = await entrar(browser, conta.email, senha);
    for (const w of LARGURAS) {
      await largura(page, w);
      const form = await abrirFormulario(page);
      const valores = await preencher(form, `${NOME_LIMPO} (34) 99999-1234`);
      await page.getByTestId("credenciamento-enviar").click();

      // O aviso da casa sai junto do campo do nome, como alerta; o campo fica em vermelho e com o foco.
      const nome = form.locator('[name="nome"]');
      const aviso = page.getByTestId("campo-erro-nome");
      await expect(aviso, `a ${w} px`).toHaveText(AVISO, { timeout: 30_000 });
      await expect(aviso).toHaveAttribute("role", "alert");
      await expect(nome).toHaveAttribute("aria-invalid", "true");
      await expect(nome).toHaveClass(/border-red-600/);
      await expect(nome).toBeFocused();
      const medida = await form.evaluate((f) => {
        const c = f.querySelector('[name="nome"]')!.getBoundingClientRect();
        const a = f.querySelector('[data-testid="campo-erro-nome"]')!.getBoundingClientRect();
        return { fimDoCampo: c.bottom, topoDoAviso: a.top };
      });
      expect(medida.topoDoAviso, "o aviso fica logo abaixo do campo do nome").toBeGreaterThanOrEqual(medida.fimDoCampo - 1);
      expect(medida.topoDoAviso - medida.fimDoCampo, "e encostado a ele").toBeLessThan(24);
      // Só o nome é apontado: o resto do pedido estava certo.
      for (const outro of ["documento", "cidade", "experienciaLink"]) await expect(form.locator(`[name="${outro}"]`)).not.toHaveAttribute("aria-invalid", "true");
      await expect(page.getByTestId("campo-erro-documento")).toHaveCount(0);
      // Nada foi limpo: a pessoa corrige o nome e envia de novo.
      for (const [n, v] of Object.entries(valores)) await expect(form.locator(`[name="${n}"]`)).toHaveValue(v);
      await expect(form.locator('[name="aceiteConduta"]')).toBeChecked();
      // Nada ficou gravado.
      expect(await gravado(), `a ${w} px: nada gravado`).toEqual({ solicitacoes: [], credenciamentos: [] });
      await expect(page.getByTestId("credenciamento-situacao"), "o pedido não nasceu").toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `a ${w} px: sem rolagem lateral`).toBe(true);
      await page.screenshot({ path: `${SAIDA}/t1755-1-contacto-no-nome-${w}.png` });

      // O mesmo com e-mail no nome (a regra é a da casa: telefone, e-mail, mensageiros).
      await nome.fill(`${NOME_LIMPO} abel@exemplo.com.br`);
      await page.getByTestId("credenciamento-enviar").click();
      await expect(page.getByTestId("campo-erro-nome")).toHaveText(AVISO, { timeout: 30_000 });
      await expect(nome).toHaveValue(`${NOME_LIMPO} abel@exemplo.com.br`);
      expect(await gravado()).toEqual({ solicitacoes: [], credenciamentos: [] });
    }
    await page.context().close();
  });

  test("2. pedido limpo nasce: a solicitação de parceiro (categoria avaliador) e o credenciamento 'solicitado'", async ({ browser }) => {
    const page = await entrar(browser, conta.email, senha);
    await largura(page, 390);
    const form = await abrirFormulario(page);
    // P2: primeiro o envio sujo — o aviso tem de aparecer, para a sua ausência depois valer alguma coisa.
    await preencher(form, `${NOME_LIMPO} (34) 99999-1234`);
    await page.getByTestId("credenciamento-enviar").click();
    await expect(page.getByTestId("campo-erro-nome"), "o envio sujo mostra o aviso").toHaveText(AVISO, { timeout: 30_000 });
    expect(await gravado(), "o envio sujo não grava").toEqual({ solicitacoes: [], credenciamentos: [] });
    // P2, forma 1 (ORDEM-DUET-672): a pessoa corrige o nome, mas o envio ainda falha por OUTRO motivo (o aceite da
    // conduta por marcar — é o servidor que o recusa; a cidade vazia não serve, o navegador trava o envio por "required").
    // O formulário continua na tela — e o aviso do nome tem de ter desaparecido, ficando só o da cidade. (No envio
    // limpo o formulário inteiro sai da tela, e a ausência do aviso lá não provaria nada.)
    await form.locator('[name="nome"]').fill(NOME_LIMPO);
    await form.locator('[name="aceiteConduta"]').uncheck();
    await page.getByTestId("credenciamento-enviar").click();
    await expect(page.getByTestId("campo-erro-aceiteConduta"), "o segundo envio falha pelo aceite da conduta").toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("credenciamento-form"), "o formulário continua na tela").toBeVisible();
    await expect(page.getByTestId("campo-erro-nome"), "o aviso do nome desapareceu com o nome corrigido").toHaveCount(0);
    await expect(form.locator('[name="nome"]')).not.toHaveAttribute("aria-invalid", "true");
    expect(await gravado(), "o segundo envio também não grava").toEqual({ solicitacoes: [], credenciamentos: [] });
    // E agora o envio limpo.
    await form.locator('[name="aceiteConduta"]').check();
    await page.getByTestId("credenciamento-enviar").click();

    await expect.poll(async () => (await gravado()).credenciamentos.length, { timeout: 30_000 }).toBe(1);
    const g = await gravado();
    expect(g.credenciamentos[0].status).toBe("solicitado");
    expect(g.credenciamentos[0].cidade).toBe("Uberlândia");
    expect(g.solicitacoes).toHaveLength(1);
    expect(g.solicitacoes[0].nome).toBe(NOME_LIMPO);
    expect(g.solicitacoes[0].categorias).toEqual(["vistoria"]);
    expect(g.solicitacoes[0].status).toBe("pendente");
    // A tela passa a mostrar a situação do credenciamento.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("credenciamento-situacao")).toHaveAttribute("data-status", "solicitado", { timeout: 30_000 });
    await page.context().close();
  });
});
