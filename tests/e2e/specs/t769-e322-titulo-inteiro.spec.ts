import { test, expect, type Locator } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T769 — E322 (01/11): o título longo do imóvel aparece INTEIRO (quebra de linha), sem corte com reticências:
   1. /dashboard/orcamentos do proprietário — coluna "Imóvel" (computador) e cartão (celular);
   2. Caixa de e-mails de teste na Ajuda — o assunto segue encurtado (regra do e-mail), e a linha mostra o imóvel inteiro.
  A 390 e a 1280.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const TITULO = `[TESTE QA] Apto mobiliado 2 quartos – Santa Mônica com varanda e vista t769 ${sufixo}`;
const dono = { email: `dono.t769.${sufixo}@lab.vivanomads.test`, nome: "Dina Titulo", role: "owner" as const };
const inq = { email: `inq.t769.${sufixo}@lab.vivanomads.test`, nome: "Ivo Interessado", role: "tenant" as const };
const ids: { dono?: string; inq?: string } = {};

const emDias = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

async function semCorte(l: Locator) {
  // Nada escondido: o texto cabe na própria caixa (sem overflow/ellipsis).
  const m = await l.evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth, overflow: getComputedStyle(e).textOverflow, ws: getComputedStyle(e).whiteSpace }));
  expect(m.overflow).not.toBe("ellipsis");
  expect(m.ws).not.toBe("nowrap");
  expect(m.sw).toBeLessThanOrEqual(m.cw + 1);
}

test.describe("T769 — E322: título inteiro do imóvel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "owner", papel_ativo: "proprietario" }).eq("id", ids.dono);
    const imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3200 });
    const lead = await criarLead(ids.dono, ids.inq, imovel);
    const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
    const { data: p, error } = await adm()
      .from("propostas")
      .insert({ numero, lead_id: lead, property_id: imovel, owner_id: ids.dono, tenant_id: ids.inq, status: "enviada", versao_atual: 1, validade_dias: 7, valida_ate: emDias(7) + "T23:00:00Z" })
      .select("id")
      .single();
    if (error) throw error;
    await adm().from("proposta_versoes").insert({
      proposta_id: p.id, versao: 1, autor: "owner", valor_base: 3200, valor_mensal: 3200, meses: 4, data_entrada: emDias(10), total_mensal: 3200, total_contrato: 12800,
    });
    // E-mail de teste da própria conta: assunto encurtado (regra do e-mail) e a linha "Imóvel: …" inteira no corpo.
    await adm().from("emails_teste").insert({
      evento: "lab", usuario_id: ids.dono, destinatario_mascarado: "d•••@lab.vivanomads.test",
      assunto: `Proposta enviada: ${TITULO.slice(0, 39)}… · Viva Nomads`,
      corpo: `Olá Dina,\nSua proposta foi enviada.\nImóvel: ${TITULO} · Santa Mônica, Uberlândia\nValor mensal: R$ 3.200\n`,
    });
  });
  test.afterAll(async () => {
    if (ids.dono) await adm().from("emails_teste").delete().eq("usuario_id", ids.dono);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });

      await p.goto("/dashboard/orcamentos", { waitUntil: "domcontentloaded" });
      const celula = p.getByTestId("orcamento-imovel").filter({ visible: true }).first();
      await expect(celula).toHaveText(TITULO, { timeout: 30_000 });
      await semCorte(celula);
      await p.screenshot({ path: `${SAIDA}/t769-orcamentos-${largura}.png` });

      await p.goto("/dashboard/conta/ajuda", { waitUntil: "domcontentloaded" });
      const linha = p.getByTestId("caixa-email-imovel").first();
      await expect(linha).toHaveText(`Imóvel: ${TITULO} · Santa Mônica, Uberlândia`, { timeout: 30_000 });
      await semCorte(linha);
      await linha.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t769-caixa-${largura}.png` });
      await p.context().close();
    });
  }
});
