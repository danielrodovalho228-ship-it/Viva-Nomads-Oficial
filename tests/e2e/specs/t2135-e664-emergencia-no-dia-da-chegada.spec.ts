import { test, expect } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2135 — E664 @E664: "Falar com o proprietário agora" na conversa, só no dia da entrada.
  Regra decidida (E664; unitário src/lib/estadia/emergencia-chegada.test.ts): o botão aparece na conversa só para o
  MORADOR, em contrato ativo assinado pelas duas partes, no DIA DA ENTRADA (Brasília). Acionado, avisa o proprietário
  com urgência (sino + e-mail + push) e grava uma mensagem na conversa. A Viva é a intermediária: nenhum telefone é
  mostrado nem trocado. Há um limite: o 2º acionamento logo a seguir não sai de novo.
  Por largura, um imóvel com contrato que ENTRA HOJE e outro que entra AMANHÃ (controle):
    1. morador, conversa do imóvel de hoje: o botão aparece; acionado, mostra a confirmação, a mensagem urgente entra na
       conversa e o dono recebe o aviso "emergencia_chegada" no sino; nenhum contato na tela;
    2. o 2º acionamento logo depois: recusado pelo limite, sem nova mensagem;
    3. morador, conversa do imóvel de amanhã: sem o botão;
    4. dono, conversa do imóvel de hoje: sem o botão (só o morador aciona).
  Os textos esperados estão escritos aqui, pela regra. 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2135.${sufixo}@lab.vivanomads.test`, nome: "Elisa Entrada", role: "owner" as const };
const inq = { email: `inq.t2135.${sufixo}@lab.vivanomads.test`, nome: "Caio Chegada", role: "tenant" as const };
const ids: { dono?: string; inq?: string } = {};
const imoveis: string[] = [];
const contratos: string[] = [];
const ENVIADA = "Avisamos o proprietário agora, com urgência. A Viva acompanha e a resposta chega por aqui, nesta conversa. Nenhum telefone é compartilhado.";
const ESPERE = "O aviso urgente já foi enviado há pouco. Aguarde alguns minutos; a resposta chega nesta conversa.";
const MSG = "Aviso urgente: cheguei ao imóvel e preciso falar agora. Responda por aqui, por favor.";
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const somar = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

async function estadia(titulo: string, entrada: string): Promise<{ imovel: string; contrato: string }> {
  const imovel = await criarImovelPronto(ids.dono!, titulo, { ativo: true, preco: 3200 });
  imoveis.push(imovel);
  const lead = await criarLead(ids.dono!, ids.inq!, imovel, true);
  const agora = new Date().toISOString();
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: ids.inq, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, capacidade_snapshot: 2, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  contratos.push(c.id as string);
  const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio: entrada, fim: somar(entrada, 59), meses: 2, valor: 6400, caucao: 3200, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora });
  if (eb) throw eb;
  await gravarMensagem(ids.inq!, ids.dono!, imovel, `Olá, a entrada de ${titulo} está combinada.`, conversationId(ids.inq!, ids.dono!, imovel));
  return { imovel, contrato: c.id as string };
}

test.describe("T2135 — E664: 'Falar com o proprietário agora' só no dia da entrada, para o morador, sem contato @E664", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
  });

  test.afterAll(async () => {
    if (contratos.length) {
      await adm().from("contrato_blocos").delete().in("contrato_id", contratos);
      await adm().from("contratos").delete().in("id", contratos);
    }
    for (const i of imoveis) await adm().from("messages").delete().eq("property_id", i);
    await adm().from("avisos").delete().eq("usuario_id", ids.dono ?? "");
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const largura of [390, 1280] as const) {
    test(`${largura} px — hoje: o morador aciona uma vez (aviso + mensagem, sem contato); amanhã e o dono: sem o botão`, async ({ browser }) => {
      const hoje = await estadia(`Casa Chegada Hoje ${largura === 390 ? "um" : "dois"} ${sufixo}`, hojeBRT());
      const amanha = await estadia(`Casa Chegada Amanha ${largura === 390 ? "um" : "dois"} ${sufixo}`, somar(hojeBRT(), 1));

      const p = await entrar(browser, inq.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });

      // 3. amanhã: sem o botão
      await p.getByRole("button", { name: /Casa Chegada Amanha/ }).first().click();
      await expect(p.getByText(/a entrada de Casa Chegada Amanha/).last()).toBeVisible({ timeout: 20_000 });
      await expect(p.getByTestId("emergencia-chegada"), "entrada amanhã: sem o botão").toHaveCount(0);

      // 1. hoje: o botão aparece e o aviso sai uma vez
      await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
      await p.getByRole("button", { name: /Casa Chegada Hoje/ }).first().click();
      const bloco = p.getByTestId("emergencia-chegada");
      await expect(bloco).toBeVisible({ timeout: 20_000 });
      await expect(bloco.getByTestId("emergencia-chegada-botao")).toHaveText(/Falar com o proprietário agora/);
      await bloco.getByTestId("emergencia-chegada-botao").click();
      await expect(bloco.getByTestId("emergencia-chegada-resultado")).toHaveText(ENVIADA, { timeout: 20_000 });
      await expect
        .poll(async () => ((await adm().from("messages").select("body").eq("property_id", hoje.imovel).eq("body", MSG)).data ?? []).length, { timeout: 15_000, message: "a mensagem urgente entrou na conversa" })
        .toBe(1);
      await expect
        .poll(async () => ((await adm().from("avisos").select("id").eq("usuario_id", ids.dono).eq("evento", "emergencia_chegada").eq("ref_id", hoje.contrato)).data ?? []).length, { timeout: 15_000, message: "o dono recebeu o aviso urgente no sino" })
        .toBe(1);
      await expect(p.locator("main"), "nenhum telefone na tela").not.toContainText(/34999990000|\(\d{2}\)\s?\d{4,5}-?\d{4}/);

      // 2. o 2º acionamento logo a seguir: recusado pelo limite, sem nova mensagem
      await bloco.getByTestId("emergencia-chegada-botao").click();
      await expect(bloco.getByTestId("emergencia-chegada-resultado")).toHaveText(ESPERE, { timeout: 20_000 });
      expect(((await adm().from("messages").select("id").eq("property_id", hoje.imovel).eq("body", MSG)).data ?? []).length, "nenhuma mensagem nova").toBe(1);
      await p.context().close();

      // 4. o dono, na mesma conversa: sem o botão
      const d = await entrar(browser, dono.email, senha);
      await d.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await d.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
      await d.getByRole("button", { name: /Casa Chegada Hoje/ }).first().click();
      await expect(d.getByText(MSG).last(), "o dono vê a mensagem urgente").toBeVisible({ timeout: 20_000 });
      await expect(d.getByTestId("emergencia-chegada"), "o dono não vê o botão").toHaveCount(0);
      await d.context().close();
    });
  }
});
