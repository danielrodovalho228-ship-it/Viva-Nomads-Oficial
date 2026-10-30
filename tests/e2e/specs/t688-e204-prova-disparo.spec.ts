import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T688 — PROVA DO DISPARO do E204 (e-mails de orçamento de parceiro), no mesmo caminho do roteiro ao vivo
  (docs/qa-disparos-e204-e206.md, itens 1–3): o dono pede orçamento a um fotógrafo pela página do parceiro, com o
  imóvel; o parceiro orça R$ 350; o dono aceita. Contas do laboratório marcadas como de teste: os e-mails caem na caixa
  de teste (emails_teste), lida aqui. Para cada e-mail, a prova fixa:
    • o MARCO — a ação na tela que dispara;
    • a JANELA — o e-mail chega em até 30 s depois do marco (criado_em ≥ marco) e não antes;
    • os DESTINATÁRIOS — exatamente 1 e-mail do evento, para quem deve, e nenhum para a outra parte;
    • o CONTEÚDO — serviço, imóvel (título · bairro, cidade), data sugerida, código e link do pedido; valor no orçamento
      recebido e no aceito; o líquido ("Você recebe") só para o parceiro; nunca o endereço exato antes do aceite.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t688.${sufixo}@lab.vivanomads.test`, nome: "Dora Prova", role: "owner" as const };
const foto = { email: `foto.t688.${sufixo}@lab.vivanomads.test`, nome: "Fabi Prova", role: "owner" as const };
const slug = `fotos-t688-${sufixo}`;
const TITULO = `Prova E204 ${sufixo}`;
const SERVICO = "Ensaio fotográfico do imóvel";
const JANELA_MS = 30_000;
const ids: { dono?: string; foto?: string; parceiro?: string; imovel?: string; pedido?: string; codigo?: string } = {};

type Linha = { evento: string; assunto: string; corpo: string; criado_em: string; usuario_id: string };

/** Os e-mails do evento que chegaram a partir do marco (espera até a janela fechar). */
async function aposOMarco(evento: string, marco: number, usuarios: string[]): Promise<Linha[]> {
  const desde = new Date(marco - 2_000).toISOString(); // 2 s de folga de relógio entre o laboratório e o banco
  let linhas: Linha[] = [];
  for (let i = 0; i < JANELA_MS / 1000; i++) {
    const { data } = await adm().from("emails_teste").select("evento, assunto, corpo, criado_em, usuario_id").eq("evento", evento).in("usuario_id", usuarios).gte("criado_em", desde);
    linhas = (data ?? []) as Linha[];
    if (linhas.length) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return linhas;
}

/** Amanhã às HH:00 de Brasília, no formato do campo datetime-local. */
function amanha(hora: number): string {
  const d = new Date(Date.now() + 86_400_000 - 3 * 3_600_000);
  return `${d.toISOString().slice(0, 10)}T${String(hora).padStart(2, "0")}:00`;
}

async function abrir(browser: Browser, email: string): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: 1280, height: 900 });
  return page;
}

test.describe("T688 — E204: prova do disparo dos 3 e-mails de orçamento (marco, janela, destinatários, conteúdo)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.foto = await criarConta(foto, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.foto]);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
    const { data, error } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.foto, tipo_pessoa: "pf", documento: cpfAleatorio(), nome_publico: `Fotos Prova ${sufixo}`, slug, categorias: ["fotografia"], cidades: ["Uberlândia"], descricao_curta: "Parceiro de laboratório.", status: "publicado", publicado_em: new Date().toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    ids.parceiro = data.id as string;
    await adm().from("parceiro_servicos").insert({ parceiro_id: ids.parceiro, categoria: "fotografia", titulo: SERVICO, preco_base: 300, unidade: "por serviço", ativo: true });
  });

  test.afterAll(async () => {
    if (ids.pedido) await adm().from("parceiro_pedidos").delete().eq("id", ids.pedido);
    if (ids.parceiro) await adm().from("parceiros").delete().eq("id", ids.parceiro);
    await adm().from("emails_teste").delete().in("usuario_id", [ids.dono, ids.foto].filter(Boolean) as string[]);
    await apagarContas([ids.dono, ids.foto]);
  });

  test("os 3 e-mails saem no marco certo, só para quem deve, com serviço, imóvel, data, valor e pedido", async ({ browser }) => {
    test.setTimeout(240_000);
    const partes = [ids.dono!, ids.foto!];
    const imovel = `${TITULO} · Centro, Uberlândia`;

    // ── Item 1 — MARCO: o dono envia o pedido pela página do parceiro, com o imóvel. → parceiro_pedido_novo (parceiro).
    const d = await abrir(browser, dono.email);
    await d.goto(`/parceiros/${slug}?imovel=${ids.imovel}`, { waitUntil: "domcontentloaded" });
    await d.getByTestId("solicitar-orcamento").click();
    await expect(d.getByTestId("solicitar-orcamento-folha")).toBeVisible();
    await d.getByTestId("solicitar-orcamento-descricao").fill("Fotos do imóvel para o anúncio, 1 quarto e home office.");
    await expect(d.getByTestId("solicitar-orcamento-imovel")).toHaveValue(ids.imovel!);
    await d.getByTestId("solicitar-orcamento-horario-0").fill(amanha(10));
    const marco1 = Date.now();
    await d.getByTestId("solicitar-orcamento-enviar").click();
    await expect(d).toHaveURL(/\/dashboard\/servicos\/pedidos\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    ids.pedido = d.url().split("/").pop()!;
    ids.codigo = String((await adm().from("parceiro_pedidos").select("codigo").eq("id", ids.pedido).single()).data?.codigo);

    const novo = await aposOMarco("parceiro_pedido_novo", marco1, partes);
    expect(novo, "exatamente 1 e-mail de pedido novo").toHaveLength(1);
    expect(novo[0].usuario_id, "vai ao parceiro, não ao dono").toBe(ids.foto);
    expect(Date.parse(novo[0].criado_em) - marco1, "dentro da janela").toBeLessThan(JANELA_MS);
    expect(novo[0].assunto).toMatch(/Novo pedido de orçamento/);
    expect(novo[0].corpo).toContain(`você recebeu um pedido de orçamento de ${SERVICO.toLowerCase()} para ${TITULO}`);
    expect(novo[0].corpo).toContain(`Serviço: ${SERVICO}`);
    expect(novo[0].corpo).toContain(`Imóvel: ${imovel}`);
    expect(novo[0].corpo).toMatch(/Data sugerida: \d{2}\/\d{2}\/\d{4} às 10:00/);
    expect(novo[0].corpo).toContain(`Pedido: ${ids.codigo}`);
    expect(novo[0].corpo).toContain(`/dashboard/servicos/pedidos/${ids.pedido}`);
    expect(novo[0].corpo).not.toMatch(/Valor:|Você recebe:|mensagens da plataforma/);

    // ── Item 2 — MARCO: o parceiro envia o orçamento de R$ 350. → parceiro_orcamento_recebido (dono).
    const p = await abrir(browser, foto.email);
    await p.goto(`/dashboard/servicos/pedidos/${ids.pedido}`, { waitUntil: "domcontentloaded" });
    await p.locator("#pedido-valor-campo").fill("350");
    const marco2 = Date.now();
    await p.getByTestId("pedido-enviar-orcamento").click();
    await expect(p.getByTestId("pedido-status")).toHaveText("Orçamento recebido", { timeout: 20_000 });

    const recebido = await aposOMarco("parceiro_orcamento_recebido", marco2, partes);
    expect(recebido, "exatamente 1 e-mail de orçamento recebido").toHaveLength(1);
    expect(recebido[0].usuario_id, "vai ao dono, não ao parceiro").toBe(ids.dono);
    expect(Date.parse(recebido[0].criado_em) - marco2).toBeLessThan(JANELA_MS);
    expect(recebido[0].corpo).toContain(`o parceiro enviou o orçamento de ${SERVICO.toLowerCase()} para ${TITULO}: R$ 350`);
    expect(recebido[0].corpo).toContain("Valor: R$ 350");
    expect(recebido[0].corpo).toContain(`Imóvel: ${imovel}`);
    expect(recebido[0].corpo).toContain(`Pedido: ${ids.codigo}`);
    expect(recebido[0].corpo, "o dono nunca vê o líquido do parceiro").not.toContain("Você recebe:");

    // ── Item 3 — MARCO: o dono aceita o orçamento. → parceiro_orcamento_aceito (parceiro), com o líquido.
    await d.reload({ waitUntil: "domcontentloaded" });
    const marco3 = Date.now();
    await d.getByTestId("pedido-aceitar").click();
    await expect(d.getByTestId("pedido-status")).toHaveText("Orçamento aceito", { timeout: 20_000 });

    const aceito = await aposOMarco("parceiro_orcamento_aceito", marco3, partes);
    expect(aceito, "exatamente 1 e-mail de orçamento aceito").toHaveLength(1);
    expect(aceito[0].usuario_id, "vai ao parceiro, não ao dono").toBe(ids.foto);
    expect(Date.parse(aceito[0].criado_em) - marco3).toBeLessThan(JANELA_MS);
    expect(aceito[0].corpo).toContain(`O cliente aceitou o seu orçamento de ${SERVICO.toLowerCase()} para ${TITULO} (R$ 350)`);
    expect(aceito[0].corpo).toContain("Valor: R$ 350");
    expect(aceito[0].corpo).toContain("Você recebe: R$ 315");
    expect(aceito[0].corpo).toContain(`Pedido: ${ids.codigo}`);

    // Nada fora de hora: nenhum evento de orçamento ANTES do 1º marco, e nenhum e-mail repetido no fim.
    const { data: todos } = await adm().from("emails_teste").select("evento, criado_em").in("usuario_id", partes).in("evento", ["parceiro_pedido_novo", "parceiro_orcamento_recebido", "parceiro_orcamento_aceito"]);
    const linhas = (todos ?? []) as { evento: string; criado_em: string }[];
    expect(linhas.filter((l) => Date.parse(l.criado_em) < marco1 - 2_000), "nenhum e-mail antes do marco").toHaveLength(0);
    expect(linhas, "3 e-mails no total, um por evento").toHaveLength(3);
    await d.context().close();
    await p.context().close();
  });
});
