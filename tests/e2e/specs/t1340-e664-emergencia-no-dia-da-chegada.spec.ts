import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { conversationId } from "../../../src/lib/messages/conversation-id";

/*
  T1340 — E664 (draft #3090): "Falar com o proprietário agora" na conversa, SÓ no dia da entrada. Contrato ativo,
  assinado pelas duas partes, com o bloco entrando HOJE (Brasília): o morador vê o botão, aciona, recebe a confirmação
  ("Avisamos o proprietário agora"), a conversa ganha a mensagem de aviso e o dono recebe o aviso; um segundo acionamento
  logo depois cai na espera mínima. Sem telefone na tela. Com a entrada amanhã, o botão não aparece. 390 e 1280 px.
  Spec preparada sobre a branch do draft; só roda verde com o E664 presente.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1340.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona Chegada", role: "owner" as const };
const inq = { email: `inq.t1340.${sufixo}@lab.vivanomads.test`, nome: "Ivo Chegada Morador", role: "tenant" as const };
const ids: { dono?: string; inq?: string; hoje?: string; amanha?: string; contHoje?: string; contAmanha?: string; imovelHoje?: string; imovelAmanha?: string } = {};
const brasilia = (dias: number) => new Date(Date.now() - 3 * 3600_000 + dias * 86_400_000).toISOString().slice(0, 10);
const titulo = (k: string) => `Chegada ${k} ${sufixo}`;

async function contrato(imovel: string, inicio: string, fim: string) {
  const agora = new Date().toISOString();
  const { data, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: ids.inq, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 256, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: data.id, numero_bloco: 1, inicio, fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo" });
  if (eb) throw eb;
  const { error: em } = await adm().from("messages").insert({ conversation_id: conversationId(ids.inq!, ids.dono!, imovel), sender_id: ids.inq, receiver_id: ids.dono, property_id: imovel, body: "Olá! Chego em breve." });
  if (em) throw em;
  return data.id as string;
}
async function abrirConversa(p: Page, k: string) {
  await p.goto("/dashboard/mensagens", { waitUntil: "networkidle" });
  await p.getByRole("button", { name: new RegExp(titulo(k)) }).first().click();
}

test.describe("T1340 — E664: emergência no dia da chegada", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    ids.hoje = brasilia(0);
    ids.amanha = brasilia(1);
    ids.imovelHoje = await criarImovelPronto(ids.dono, titulo("hoje"), { ativo: true, preco: 3200 });
    ids.imovelAmanha = await criarImovelPronto(ids.dono, titulo("amanha"), { ativo: true, preco: 3200 });
    ids.contHoje = await contrato(ids.imovelHoje, ids.hoje, brasilia(60));
    ids.contAmanha = await contrato(ids.imovelAmanha, ids.amanha, brasilia(61));
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().in("property_id", [ids.imovelHoje ?? "", ids.imovelAmanha ?? ""]);
    await adm().from("contratos").delete().in("id", [ids.contHoje ?? "", ids.contAmanha ?? ""]);
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: o botão só aparece com a entrada hoje e o aviso chega ao dono`, async ({ browser }) => {
      const p = await entrar(browser, inq.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });

      await abrirConversa(p, "amanha");
      await expect(p.getByTestId("conversa-nome")).toBeVisible({ timeout: 20_000 });
      await expect(p.getByTestId("emergencia-chegada")).toHaveCount(0);

      await abrirConversa(p, "hoje");
      const caixa = p.getByTestId("emergencia-chegada");
      await expect(caixa).toBeVisible({ timeout: 20_000 });
      await expect(caixa).not.toContainText(/\(\d{2}\)|\d{4,5}-\d{4}|@/);
      const botao = p.getByTestId("emergencia-chegada-botao");
      await expect(botao).toContainText("Falar com o proprietário agora");
      expect((await botao.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      if (w === 390) {
        await botao.click();
        await expect(p.getByTestId("emergencia-chegada-resultado")).toContainText("Avisamos o proprietário agora", { timeout: 30_000 });
        const { data } = await adm().from("messages").select("body").eq("property_id", ids.imovelHoje!).eq("sender_id", ids.inq!);
        expect((data ?? []).some((m) => String(m.body).startsWith("Aviso urgente"))).toBe(true);
      } else {
        // 2º acionamento do mesmo contrato (a 390 px acionou antes): cai na espera mínima, com mensagem visível.
        await botao.click();
        await expect(p.getByTestId("emergencia-chegada-resultado")).toBeVisible({ timeout: 30_000 });
      }
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
