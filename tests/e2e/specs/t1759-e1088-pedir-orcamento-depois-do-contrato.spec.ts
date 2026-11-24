import { test, expect, type Browser } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1759 — E1088 @E1088 (ESPEC-E1088, linha Proposta): o "Pedir orçamento" volta ao morador depois do contrato.
  Regra: candidatura aceita, sem orçamento em aberto, e TODOS os contratos dessa candidatura assinados pelas duas
  partes (ou nenhum). O contrato cancelado não conta (ORDEM-605). Uma moradora, um dono, quatro candidaturas aceitas
  (uma por imóvel), em /dashboard/candidaturas, a 390 e a 1280 px:
   (a) um contrato assinado pelos dois → o botão aparece, e o clique manda ao dono, no chat, o pedido com o número;
   (b) um contrato por assinar → sem o botão (só o número do pedido);
   (c) dois contratos, um assinado pelos dois e outro por assinar → sem o botão;
   (d) um assinado pelos dois e um CANCELADO nunca assinado → o botão aparece (o cancelado não conta).
  Os contratos são gravados no banco do laboratório (como na t1726). Na main de antes do E1088, (a) e (d) caem.
  Laboratório; não é prova ao vivo no site.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1759.${sufixo}@lab.vivanomads.test`, nome: "Dalia Orcamento Sobrenome", role: "owner" as const };
const inq = { email: `inq.t1759.${sufixo}@lab.vivanomads.test`, nome: "Ilda Orcamento Sobrenome", role: "tenant" as const };
const CASOS = ["a", "b", "c", "d"] as const;
type Caso = (typeof CASOS)[number];
const ids: { dono?: string; inq?: string; imovel: Partial<Record<Caso, string>>; lead: Partial<Record<Caso, string>> } = { imovel: {}, lead: {} };

const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const ASSINADO = "2026-11-20T12:00:00Z";
const pedido = (lead: string) => `VN-PD-${lead.slice(0, 8).toUpperCase()}`;

/** Um contrato da candidatura, gravado no laboratório (as mesmas colunas da t1726), com as assinaturas pedidas. */
async function contrato(caso: Caso, ini: number, fim: number, o: { dono: boolean; morador: boolean; status?: "ativo" | "cancelado" }) {
  const { error } = await adm()
    .from("contratos")
    .insert({
      lead_id: ids.lead[caso], property_id: ids.imovel[caso], tenant_id: ids.inq, owner_plan: "essential", faixa: "media_estadia",
      prazo_total_dias: fim - ini, aluguel_mensal: 2800, tamanho_bloco_meses: 1, comissao_percent: 0.12, comissao_valor: 336,
      qtd_ocupantes: 1, garantia: "caucao", status: o.status ?? "ativo", periodo: `[${emDias(ini)},${emDias(fim)}]`,
      assinado_proprietario_em: o.dono ? ASSINADO : null, assinado_inquilino_em: o.morador ? ASSINADO : null,
      ...(o.status === "cancelado" ? { cancelado_por: "acordo" } : {}),
    });
  if (error) throw error;
}

async function minhasCandidaturas(browser: Browser, largura: 390 | 1280) {
  const page = await entrar(browser, inq.email, senha);
  await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  await page.goto("/dashboard/candidaturas", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("candidatura-item").first()).toBeVisible({ timeout: 30_000 });
  return page;
}

test.beforeAll(async () => {
  if (!NO_LABORATORIO) return;
  ids.dono = await criarConta(dono, senha);
  ids.inq = await criarConta(inq, senha);
  await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
  for (const caso of CASOS) {
    ids.imovel[caso] = await criarImovelPronto(ids.dono, `[TESTE QA] Pedir orçamento (${caso}) ${sufixo}`, { ativo: true, preco: 2800 });
    ids.lead[caso] = await criarLead(ids.dono, ids.inq, ids.imovel[caso]!, true);
  }
  await contrato("a", 30, 60, { dono: true, morador: true });
  await contrato("b", 30, 60, { dono: true, morador: false });
  await contrato("c", 30, 60, { dono: true, morador: true });
  await contrato("c", 90, 120, { dono: false, morador: false });
  await contrato("d", 30, 60, { dono: true, morador: true });
  await contrato("d", 90, 120, { dono: false, morador: false, status: "cancelado" });
});

test.afterAll(async () => {
  const leads = Object.values(ids.lead).filter(Boolean) as string[];
  if (leads.length) await adm().from("contratos").delete().in("lead_id", leads);
  const imoveis = Object.values(ids.imovel).filter(Boolean) as string[];
  if (imoveis.length) await adm().from("messages").delete().in("property_id", imoveis);
  await apagarContas([ids.dono, ids.inq]);
});

test.describe("T1759 — E1088: o 'Pedir orçamento' volta depois do contrato assinado pelos dois @E1088", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  for (const largura of [390, 1280] as const) {
    test(`a ${largura} px: o botão segue a regra nos quatro casos (b e c sem botão; a e d com botão)`, async ({ browser }) => {
      const page = await minhasCandidaturas(browser, largura);
      for (const caso of CASOS) {
        const cartao = page.locator(`#candidatura-${ids.lead[caso]}`);
        await expect(cartao, `cartão (${caso})`).toBeVisible({ timeout: 30_000 });
        const botao = cartao.getByTestId("candidatura-pedir-orcamento-botao");
        if (caso === "a" || caso === "d") {
          await expect(botao, `(${caso}) com o botão`).toBeVisible();
          await expect(cartao.getByTestId("candidatura-numero-pedido")).toHaveText(pedido(ids.lead[caso]!));
        } else {
          await expect(botao, `(${caso}) sem o botão`).toHaveCount(0);
          await expect(cartao.getByTestId("candidatura-numero-pedido-cartao")).toContainText(pedido(ids.lead[caso]!));
        }
      }
      await page.context().close();
    });
  }

  test("(a) o clique manda ao dono, no chat, o pedido com o número", async ({ browser }) => {
    const page = await minhasCandidaturas(browser, 390);
    const cartao = page.locator(`#candidatura-${ids.lead.a}`);
    await cartao.getByTestId("candidatura-pedir-orcamento-botao").click();
    await expect(cartao.getByTestId("candidatura-pedir-orcamento-msg")).toHaveText("Pedido de orçamento enviado ao proprietário no chat.", { timeout: 30_000 });
    await page.context().close();
    const msgs = (await adm().from("messages").select("body, sender_id, receiver_id").eq("property_id", ids.imovel.a!)).data ?? [];
    expect(msgs.some((m) => m.sender_id === ids.inq && m.receiver_id === ids.dono && String(m.body).includes(pedido(ids.lead.a!))), "a mensagem ao dono cita o número do pedido").toBe(true);
  });
});
