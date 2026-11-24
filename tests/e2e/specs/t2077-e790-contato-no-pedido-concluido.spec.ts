import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo, cnpjAleatorio } from "../fixtures/laboratorio";

/*
  T2077 — E790 (Pista 3; autorizado pelo Gerente na ronda 04:19Z) @E790 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO: só corre com INTEGRACOES_SIMULADAS=on e a chave de serviço).
  Regra decidida (E445; docs/e790-contato-nunca-revelado.md): o contato da outra parte (telefone, e-mail) NUNCA é
  trocado nem revelado, em nenhuma fase do pedido de parceiro — a conversa segue pelas mensagens da Viva. A fase
  "concluído" é a que as provas do Gerente nunca conseguiram exercitar (precisa levar um pedido até o fim): aqui o
  pedido nasce concluído no banco, com o telefone e o e-mail das duas partes gravados, e as DUAS partes abrem o pedido.
  O que se confere, a 390 e 1280 px, para o cliente e para o parceiro:
    - nem a tela, nem NENHUMA resposta do servidor que a tela recebe (HTML, payload do React, JSON) contém o e-mail ou
      o telefone da outra parte (dígitos crus nem formatados);
    - nenhuma ligação tel:/mailto: com dado de conta (só o canal da Viva pode existir);
    - o aviso "O contato não é trocado…" está à vista.
  Também a fase "entregue" (a anterior), como controlo do mesmo caminho.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const cliente = { email: `cli.t2077.${sufixo}@lab.vivanomads.test`, nome: "Celia Concluido", role: "owner" as const };
const prestador = { email: `par.t2077.${sufixo}@lab.vivanomads.test`, nome: "Pedro Prestador", role: "owner" as const };
const TEL_CLIENTE = "34991230001";
const TEL_PARCEIRO = "34991230002";
const TEL_PRESTADOR = "34991230003";
const ids: { cliente?: string; prestador?: string; parceiro?: string; pedidos: string[] } = { pedidos: [] };
const AVISO = "O contato não é trocado: a conversa segue pelas mensagens da Viva, antes e depois do aceite.";

/** As formas em que um telefone pode aparecer: dígitos, (34) 99123-0001, 99123-0001, +55… */
const formas = (t: string) => [t, `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`, `${t.slice(2, 7)}-${t.slice(7)}`, `55${t}`];

let seq = 0;
async function pedido(status: "entregue" | "concluido"): Promise<string> {
  seq += 1;
  const { data, error } = await adm()
    .from("parceiro_pedidos")
    .insert({
      codigo: `VN-SV-T277${sufixo.slice(-2).toUpperCase().replace(/[^0-9A-Z]/g, "0")}${String(seq).padStart(2, "0")}`, // ^VN-SV-[0-9A-Z]{8}$ (0190)
      parceiro_id: ids.parceiro,
      cliente_id: ids.cliente,
      categoria: "limpeza",
      status,
      descricao: "Limpeza completa (T2077).",
      horarios_propostos: [new Date(Date.now() - 3 * 86_400_000).toISOString()],
      valor_combinado: 300,
      taxa_percent: 0.1,
      valor_taxa: 30,
      valor_parceiro: 270,
      pagamento_status: "indisponivel",
    })
    .select("id")
    .single();
  if (error) throw error;
  ids.pedidos.push(data.id as string);
  return data.id as string;
}

/** Abre o pedido guardando o corpo de TODA resposta do próprio site (HTML, RSC, JSON). */
async function abrirPedido(browser: Browser, email: string, largura: number, id: string): Promise<{ p: Page; corpos: string[] }> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  const corpos: string[] = [];
  const origem = new URL(p.url()).origin;
  p.on("response", async (r) => {
    if (!r.url().startsWith(origem)) return;
    const tipo = r.headers()["content-type"] ?? "";
    if (!/html|json|text|x-component/.test(tipo)) return;
    try {
      corpos.push(await r.text());
    } catch {
      /* resposta sem corpo (redirecionamento) */
    }
  });
  await p.goto(`/dashboard/servicos/pedidos/${id}`, { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  return { p, corpos };
}

async function nadaDaOutraParte(p: Page, corpos: string[], outra: { email: string; telefones: string[] }, quem: string) {
  await expect(p.getByText(AVISO).first(), `${quem}: o aviso de que o contato não é trocado`).toBeVisible({ timeout: 30_000 });
  const tela = await p.locator("main").innerText();
  const tudo = [tela, ...corpos].join("\n");
  expect(tudo.includes(outra.email), `${quem}: o e-mail da outra parte (${outra.email}) chegou à tela ou ao payload`).toBe(false);
  for (const t of outra.telefones) for (const f of formas(t)) expect(tudo.includes(f), `${quem}: o telefone da outra parte (${f}) chegou à tela ou ao payload`).toBe(false);
  const ligacoes = await p.locator('main a[href^="tel:"], main a[href^="mailto:"]').evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
  for (const h of ligacoes) {
    expect(h.includes(outra.email), `${quem}: ligação com o e-mail da outra parte (${h})`).toBe(false);
    for (const t of outra.telefones) expect(h.replace(/\D/g, "").endsWith(t), `${quem}: ligação com o telefone da outra parte (${h})`).toBe(false);
  }
}

test.describe("T2077 — E790: o contato da outra parte não aparece nem no pedido concluído @E790", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.cliente = await criarConta(cliente, senha);
    ids.prestador = await criarConta(prestador, senha);
    await adm().from("profiles").update({ phone: TEL_CLIENTE }).eq("id", ids.cliente);
    await adm().from("profiles").update({ phone: TEL_PRESTADOR }).eq("id", ids.prestador);
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.prestador, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: `Pedro Limpa ${sufixo}`, slug: `limpa-t2077-${sufixo}`, categorias: ["limpeza"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString(), telefone: TEL_PARCEIRO })
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

  for (const status of ["concluido", "entregue"] as const) {
    for (const largura of [390, 1280]) {
      test(`${status}, ${largura} px — cliente e parceiro abrem o pedido sem o contato da outra parte`, async ({ browser }) => {
        const id = await pedido(status);
        const c = await abrirPedido(browser, cliente.email, largura, id);
        await nadaDaOutraParte(c.p, c.corpos, { email: prestador.email, telefones: [TEL_PARCEIRO, TEL_PRESTADOR] }, `cliente (${status})`);
        await c.p.context().close();
        const pa = await abrirPedido(browser, prestador.email, largura, id);
        await nadaDaOutraParte(pa.p, pa.corpos, { email: cliente.email, telefones: [TEL_CLIENTE] }, `parceiro (${status})`);
        await pa.p.context().close();
      });
    }
  }
});
