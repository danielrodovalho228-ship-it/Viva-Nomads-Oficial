import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T871 — E462: pedido de parceiro em "Orçamento aceito" tem saída. 390 e 1280 px, só no laboratório.
 *  1. O parceiro vê "Atualizar orçamento" e "Recusar o pedido" no aceito, com o aviso de que o cliente decide de novo.
 *  2. Atualizar → "Orçamento recebido"; os valores congelados no aceite saem; o cliente aceita o novo valor e eles
 *     congelam de novo (taxa + parceiro = valor).
 *  3. Recusar no aceito → "Recusado pelo parceiro".
 *  4. Com pagamento registrado (simulado), o aceito não mostra as saídas.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const cliente = { email: `cli.t871.${sufixo}@lab.vivanomads.test`, nome: "Clara Cliente", role: "owner" as const };
const prestador = { email: `par.t871.${sufixo}@lab.vivanomads.test`, nome: "Paulo Parceiro", role: "owner" as const };
const ids: { cliente?: string; prestador?: string; parceiro?: string; pedidos: string[] } = { pedidos: [] };

let seq = 0;
async function pedidoAceito(pagamento: "indisponivel" | "simulado" = "indisponivel"): Promise<string> {
  seq += 1;
  const { data, error } = await adm()
    .from("parceiro_pedidos")
    .insert({
      codigo: `VN-SV-T871${sufixo.slice(-2).toUpperCase().replace(/[^0-9A-Z]/g, "0")}${String(seq).padStart(2, "0")}`,
      parceiro_id: ids.parceiro,
      cliente_id: ids.cliente,
      categoria: "limpeza",
      status: "aceito",
      descricao: "Limpeza completa (T871).",
      horarios_propostos: [new Date(Date.now() + 2 * 86_400_000).toISOString()],
      valor_combinado: 300,
      taxa_percent: 0.1,
      valor_taxa: 30,
      valor_parceiro: 270,
      pagamento_status: pagamento,
    })
    .select("id")
    .single();
  if (error) throw error;
  ids.pedidos.push(data.id as string);
  return data.id as string;
}
async function doBanco(id: string) {
  const { data } = await adm().from("parceiro_pedidos").select("status, valor_combinado, taxa_percent, valor_taxa, valor_parceiro").eq("id", id).single();
  return data as Record<string, unknown>;
}
async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  page.on("dialog", (d) => {
    throw new Error(`diálogo do navegador não permitido: ${d.message()}`);
  });
  return page;
}

test.describe("T871 — E462: saídas do parceiro no orçamento aceito", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.cliente = await criarConta(cliente, senha);
    ids.prestador = await criarConta(prestador, senha);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.prestador, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Paulo Limpa ${sufixo}`, slug: `limpa-t871-${sufixo}`, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = data.id as string;
  });

  test.afterAll(async () => {
    if (ids.pedidos.length) await adm().from("parceiro_pedidos").delete().in("id", ids.pedidos);
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await apagarContas([ids.cliente, ids.prestador]);
  });

  for (const largura of [390, 1280]) {
    test(`a ${largura}px: atualizar o orçamento aceito volta ao cliente, que aceita o novo valor`, async ({ browser }) => {
      const id = await pedidoAceito();
      const p = await abrir(browser, prestador.email, largura);
      await p.goto(`/dashboard/servicos/pedidos/${id}`, { waitUntil: "domcontentloaded" });
      await expect(p.getByTestId("pedido-status")).toHaveText("Orçamento aceito");
      await expect(p.getByTestId("pedido-aviso-atualizar-aceito")).toContainText("ele precisa aceitar o novo valor");
      await expect(p.getByTestId("pedido-enviar-orcamento")).toHaveText("Atualizar orçamento");
      await expect(p.getByTestId("pedido-recusar")).toBeVisible();
      await expect(p.getByTestId("pedido-confirmar-horario").first()).toBeVisible(); // o caminho normal continua
      await p.locator("#pedido-valor-campo").fill("400");
      await p.getByTestId("pedido-enviar-orcamento").click();
      await expect(p.getByTestId("pedido-status")).toHaveText("Orçamento recebido", { timeout: 20_000 });
      expect(await doBanco(id)).toMatchObject({ status: "orcado", valor_combinado: 400, taxa_percent: null, valor_taxa: null, valor_parceiro: null });
      expect(await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      const c = await abrir(browser, cliente.email, largura);
      await c.goto(`/dashboard/servicos/pedidos/${id}`, { waitUntil: "domcontentloaded" });
      await c.getByTestId("pedido-aceitar").click();
      await expect(c.getByTestId("pedido-status")).toHaveText("Orçamento aceito", { timeout: 20_000 });
      expect(await doBanco(id)).toMatchObject({ status: "aceito", valor_combinado: 400, valor_taxa: 40, valor_parceiro: 360 });
      await p.context().close();
      await c.context().close();
    });
  }

  test("recusar o pedido no orçamento aceito", async ({ browser }) => {
    const id = await pedidoAceito();
    const p = await abrir(browser, prestador.email, 390);
    await p.goto(`/dashboard/servicos/pedidos/${id}`, { waitUntil: "domcontentloaded" });
    await p.locator("#pedido-motivo").fill("Imprevisto na agenda");
    await p.getByTestId("pedido-recusar").click();
    await p.getByRole("button", { name: "Recusar o pedido" }).last().click();
    await expect(p.getByTestId("pedido-status")).toHaveText("Recusado pelo parceiro", { timeout: 20_000 });
    expect(await doBanco(id)).toMatchObject({ status: "recusado" });
    await p.context().close();
  });

  test("com pagamento registrado, o aceito não mostra as saídas", async ({ browser }) => {
    const id = await pedidoAceito("simulado");
    const p = await abrir(browser, prestador.email, 1280);
    await p.goto(`/dashboard/servicos/pedidos/${id}`, { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("pedido-status")).toHaveText("Orçamento aceito");
    await expect(p.getByTestId("pedido-orcar")).toHaveCount(0);
    await expect(p.getByTestId("pedido-recusar")).toHaveCount(0);
    await p.context().close();
  });
});
