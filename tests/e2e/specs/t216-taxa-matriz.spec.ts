import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { CHAVE_ANON, NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, lerSaida, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T216 — Matriz da taxa de serviço (ordem do Daniel, 18/10; especificação de 35 casos do coordenador). Laboratório,
  contas de teste, 390 e 1280 px. Itens cobertos aqui: 1, 2, 4, 5, 15, 17, 18 e 34 (os demais, nos unitários
  taxa-matriz.test.ts; o 26 acompanha o aditivo do Prompt 32). A faixa do dono muda no meio do fluxo ativando ou
  despublicando imóveis — o gatilho da 0172 (faixa_dono) acompanha.
   1. enviada a 12% → o dono passa a 3 ativos → "Se aceita hoje: 10%" → o morador aceita → congelada a 10%,
      "Sua taxa caiu para 10%" na tela e no e-mail do dono;
   2. enviada a 10% → o dono cai para 2 ativos (fora da janela de 30 dias) → aceite a 10%, origem "proposta_envio";
   5. o morador nunca vê a taxa: tela, respostas do servidor, e-mails e a API direta (sessão dele);
  15/17/18. base e rótulo: R$ 3.200 × 4 com consumo de R$ 200 e limpeza única de R$ 450 → R$ 1.536 (12%), o total
      de R$ 14.050 nunca é base; sem "comissão", sem sinal de menos na taxa.
*/
const SAIDA = "tests/laboratorio/saida";
const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const senha = novaSenha();
const sufixo = novoSufixo();
const contas: (string | undefined)[] = [];
const PROIBIDO_MORADOR = /taxa_congelada|taxa_no_envio|taxa_origem|comissao_valor|comissao_percent|valor_taxa|accepted_commission|Taxa de serviço/i;

interface Cenario {
  dono: { id: string; email: string };
  inq: { id: string; email: string };
  imovel: string;
  extras: string[];
  lead: string;
}

async function cenario(nome: string, ativosNoInicio: number): Promise<Cenario> {
  const tag = `${nome}.${randomBytes(3).toString("hex")}.${sufixo}`;
  const dono = { email: `dono.${tag}@lab.vivanomads.test`, id: "" };
  const inq = { email: `inq.${tag}@lab.vivanomads.test`, id: "" };
  dono.id = await criarConta({ email: dono.email, nome: `Dona ${nome} Sobrenome`, role: "owner" }, senha);
  inq.id = await criarConta({ email: inq.email, nome: `Inês ${nome} Sobrenome`, role: "tenant" }, senha);
  contas.push(dono.id, inq.id);
  await adm().from("profiles").update({ is_teste: true }).in("id", [dono.id, inq.id]);
  const imovel = await criarImovelPronto(dono.id, `Studio taxa ${nome}`, { ativo: true, preco: 3200 });
  await adm()
    .from("properties")
    .update({ negociacao: { aceita: true, itens: ["valor_mensal", "meses", "data_entrada", "limpeza"], descontos: [] }, min_period_days: 30, max_period_days: 180, condo_fee: 0, utilities_mode: "real", prep_fee: 0, checkout_cleaning_enabled: false, limpeza_estadia: null })
    .eq("id", imovel);
  // Imóveis extras: ativos ou rascunho, para mudar a faixa no meio do fluxo.
  const extras: string[] = [];
  for (let i = 1; i <= 2; i++) extras.push(await criarImovelPronto(dono.id, `Studio extra ${i} ${nome}`, { ativo: i < ativosNoInicio }));
  const lead = await criarLead(dono.id, inq.id, imovel);
  return { dono, inq, imovel, extras, lead };
}

async function abrir(browser: Browser, email: string, largura: number): Promise<Page> {
  const page = await entrar(browser, email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return page;
}

function emDias(d: number): string {
  return new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
}

/** O dono monta e envia R$ 3.200 × 4 com consumo de R$ 200 e limpeza única de R$ 450 (o caso fixo do item 15). */
async function enviar(page: Page, c: Cenario, pctEsperado: string, taxaEsperada: string): Promise<string> {
  await page.goto(`/dashboard/orcamentos/nova?interessado=${c.lead}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("montagem-proposta")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("proposta-valor").fill("3200");
  await page.getByTestId("proposta-meses").selectOption("4");
  await page.getByTestId("proposta-data").fill(emDias(10));
  await page.getByLabel("Consumo estimado (R$/mês)").fill("200");
  await page.getByLabel("Limpeza de preparação (R$, única)").fill("450");
  await page.getByTestId("proposta-validade").selectOption("7");
  await expect(page.getByTestId("resumo-total-contrato")).toContainText("14.050");
  const rotulo = `Taxa de serviço: ${pctEsperado} sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800) = ${taxaEsperada}`;
  await expect(page.getByTestId("proposta-taxa-dono")).toContainText(rotulo);
  await page.getByTestId("enviar-proposta").click();
  await page.waitForURL(/\/dashboard\/propostas\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  const id = page.url().split("/").pop()!;
  await expect(page.getByTestId("proposta-taxa")).toContainText(rotulo);
  const tela = await page.locator("main").innerText();
  expect(tela).not.toMatch(/comiss/i);
  expect(tela).not.toMatch(/−\s*R\$\s*1\.536|descontad|retid|fica com você/i);
  return id;
}

async function taxaGravada(id: string) {
  const { data } = await adm().from("propostas").select("taxa_no_envio, taxa_congelada, taxa_origem, lead_id").eq("id", id).single();
  return data as { taxa_no_envio: number | null; taxa_congelada: number | null; taxa_origem: string | null; lead_id: string };
}

/** O morador aceita pela tela; nada de taxa na tela nem no que o servidor devolveu a ele. */
async function moradorAceita(browser: Browser, c: Cenario, id: string, largura: number) {
  const t = await abrir(browser, c.inq.email, largura);
  const respostas: string[] = [];
  t.on("response", async (r) => {
    if (!r.url().includes("localhost")) return;
    try {
      respostas.push(await r.text());
    } catch {
      /* sem corpo */
    }
  });
  await t.goto(`/dashboard/propostas/${id}`, { waitUntil: "domcontentloaded" });
  await expect(t.getByTestId("proposta-aceitar")).toBeVisible({ timeout: 20_000 });
  await expect(t.getByTestId("proposta-taxa")).toHaveCount(0);
  await t.getByTestId("proposta-aceitar").click();
  await expect.poll(async () => (await taxaGravada(id)).taxa_congelada, { timeout: 20_000 }).not.toBeNull();
  await t.reload({ waitUntil: "domcontentloaded" });
  await t.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  expect(await t.content()).not.toMatch(PROIBIDO_MORADOR);
  expect(respostas.join("\n")).not.toMatch(PROIBIDO_MORADOR);
  await t.screenshot({ path: `${SAIDA}/t216-morador-${largura}.png`, fullPage: true });
  await t.context().close();
}

test.describe("T216 — matriz da taxa de serviço", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste).");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);
  test.afterAll(async () => {
    await apagarContas(contas);
  });

  test("1/4/15/17/18/34. 1280 — enviada a 12%; o dono passa a 3 ativos; 'Se aceita hoje: 10%'; aceite a 10% com o aviso e o e-mail só ao dono", async ({ browser }) => {
    const c = await cenario("Sobe", 1);
    const d = await abrir(browser, c.dono.email, 1280);
    const id = await enviar(d, c, "12%", "R$ 1.536");
    expect((await taxaGravada(id)).taxa_no_envio).toBe(0.12);

    // O dono ganha 2 imóveis ativos → 3 → faixa de 10%.
    await adm().from("properties").update({ status: "active" }).in("id", c.extras);
    await expect.poll(async () => Number((await adm().from("faixa_dono").select("taxa_atual").eq("owner_id", c.dono.id).single()).data?.taxa_atual)).toBe(0.1);
    await d.reload({ waitUntil: "domcontentloaded" });
    // Item 4: antes do aceite, a taxa DO ENVIO com a base, e a de hoje à parte.
    await expect(d.getByTestId("proposta-taxa")).toContainText("Taxa de serviço: 12% sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800) = R$ 1.536");
    await expect(d.getByTestId("proposta-taxa-se-aceita-hoje")).toHaveText("Se aceita hoje: 10% (sua faixa melhorou).");
    await d.screenshot({ path: `${SAIDA}/t216-pre-aceite-1280.png`, fullPage: true });

    const saidaAntes = (await lerSaida()).length;
    await moradorAceita(browser, c, id, 1280);
    const g = await taxaGravada(id);
    expect([g.taxa_no_envio, g.taxa_congelada, g.taxa_origem]).toEqual([0.12, 0.1, "faixa"]);
    const { data: lead } = await adm().from("leads").select("accepted_commission_rate, accepted_commission_origem, accepted_commission_faixa").eq("id", c.lead).single();
    expect([Number(lead!.accepted_commission_rate), lead!.accepted_commission_origem, Number(lead!.accepted_commission_faixa)]).toEqual([0.1, "faixa", 0.1]);

    // Depois do aceite: a congelada com a base e o aviso de que caiu.
    await d.reload({ waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("proposta-taxa")).toContainText("Taxa de serviço: 10% sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800) = R$ 1.280 (congelada no aceite)");
    await expect(d.getByTestId("proposta-taxa-caiu")).toHaveText("Sua taxa caiu para 10% por causa da sua faixa atual.");
    await d.screenshot({ path: `${SAIDA}/t216-pos-aceite-1280.png`, fullPage: true });

    // Item 34: o e-mail do aceite leva a taxa com a base ao DONO; nada de taxa ao morador.
    await expect
      .poll(async () => (await lerSaida()).slice(saidaAntes).some((l) => l.para === c.dono.email && String(l.corpo).includes("R$ 3.200 × 4 = R$ 12.800) = R$ 1.280")), { timeout: 20_000 })
      .toBe(true);
    const doDono = (await lerSaida()).slice(saidaAntes).filter((l) => l.para === c.dono.email);
    expect(doDono.some((l) => String(l.corpo).includes("Sua taxa caiu para 10% por causa da sua faixa atual"))).toBe(true);
    const doMorador = (await lerSaida()).filter((l) => l.para === c.inq.email);
    for (const l of doMorador) expect(String(l.corpo)).not.toMatch(/Taxa de serviço|comiss/i);

    // Fechamento do dono: ele lê a taxa congelada do lead (accepted_commission_rate = 0,10, conferida acima); a taxa só
    // aparece no passo "Contrato", depois da verificação e dos documentos do inquilino — o unitário taxa-matriz confere
    // que o fechamento usa esse valor (getFechamentoContext → comissaoRate).
    await d.context().close();
  });

  test("2/5. 390 — enviada a 10%; o dono cai para 2 ativos (janela de 30 dias já passou) → aceite a 10%, origem 'proposta_envio'; a API não dá a taxa ao morador", async ({ browser }) => {
    const c = await cenario("Desce", 3);
    const d = await abrir(browser, c.dono.email, 390);
    const id = await enviar(d, c, "10%", "R$ 1.280");
    expect((await taxaGravada(id)).taxa_no_envio).toBe(0.1);

    // Um imóvel sai do ar → 2 ativos → 12%. A queda ficou para trás (simula 31 dias), então a de hoje é 12%.
    await adm().from("properties").update({ status: "draft" }).eq("id", c.extras[0]);
    await expect.poll(async () => Number((await adm().from("faixa_dono").select("taxa_atual").eq("owner_id", c.dono.id).single()).data?.taxa_atual)).toBe(0.12);
    await adm().from("faixa_dono").update({ queda_em: new Date(Date.now() - 31 * 86_400_000).toISOString() }).eq("owner_id", c.dono.id);
    await d.reload({ waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("proposta-taxa")).toContainText("Taxa de serviço: 10% sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800) = R$ 1.280");
    await expect(d.getByTestId("proposta-taxa-se-aceita-hoje")).toHaveCount(0);

    // Item 5 — API direta com a sessão do morador: as colunas de taxa não saem nem pedindo.
    const cli = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await cli.auth.signInWithPassword({ email: c.inq.email, password: senha });
    expect(eLogin).toBeNull();
    const { data: ok, error: eOk } = await cli.from("propostas").select("id, status").eq("id", id).maybeSingle();
    expect(eOk).toBeNull();
    expect(ok?.id).toBe(id);
    for (const coluna of ["taxa_congelada", "taxa_no_envio", "taxa_origem", "*"]) {
      const { data, error } = await cli.from("propostas").select(coluna).eq("id", id).maybeSingle();
      expect(error, `select ${coluna}`).not.toBeNull();
      expect(JSON.stringify(data ?? {})).not.toMatch(/taxa/);
    }

    await moradorAceita(browser, c, id, 390);
    const g = await taxaGravada(id);
    expect([g.taxa_no_envio, g.taxa_congelada, g.taxa_origem]).toEqual([0.1, 0.1, "proposta_envio"]);
    await d.reload({ waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("proposta-taxa")).toContainText("= R$ 1.280 (congelada no aceite)");
    await expect(d.getByTestId("proposta-taxa-caiu")).toHaveCount(0);
    await d.screenshot({ path: `${SAIDA}/t216-desce-390.png`, fullPage: true });
    await d.context().close();
  });
});
