import { test, expect, type Page } from "@playwright/test";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { DOCUMENTO_BLOQUEADO } from "../../../src/lib/messages/contact-guard";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, gravarMensagem, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2204 — E1057 (a), linha Mensagens (ORDEM-DUET-293). RASCUNHO: entra na vez das Mensagens.
  CPF/RG não vão pelo chat, nem mascarados (Prompt 32): a regra vive em contact-guard.ts (CPF só com DV válido; RG
  com máscara, com prefixo de UF ou com o rótulo "RG/identidade") e é aplicada no servidor (sendMessage) e na tela
  (avisoAntesDeEnviar → "documento"). Até aqui só havia a unitária (estadia.test.ts:188); o t281 só confere a faixa de
  aviso fixa da conversa. Este spec prova a RECUSA pela tela: a frase do Ocupantes aparece, nada é gravado e a outra
  parte não recebe aviso nem e-mail. 390 e 1280.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2204.${sufixo}@lab.vivanomads.test`, nome: "Dora Semdocumento", role: "owner" as const };
const inq = { email: `inq.t2204.${sufixo}@lab.vivanomads.test`, nome: "Iara Semdocumento", role: "tenant" as const };
const ids: Record<string, string> = {};
const TITULO = `Studio sem documento ${sufixo}`;

/** Os formatos que a regra tem de recusar (o CPF tem DV válido; o de DV inválido seria telefone, não documento). */
const DOCUMENTOS = [
  { nome: "CPF com máscara", texto: "meu CPF é 529.982.247-25" },
  { nome: "CPF sem máscara", texto: "cpf 52998224725 para o contrato" },
  { nome: "RG com prefixo de UF", texto: "RG MG-12.345.678 da minha esposa" },
  { nome: "RG pelo rótulo", texto: "identidade nº 12345678 ok?" },
] as const;

async function gravadasDoInq(): Promise<number> {
  const { count } = await adm().from("messages").select("id", { count: "exact", head: true }).eq("sender_id", ids.inq).eq("property_id", ids.imovel);
  return count ?? 0;
}
async function avisosDoDono(): Promise<number> {
  const { count } = await adm().from("avisos").select("id", { count: "exact", head: true }).eq("usuario_id", ids.dono).eq("evento", "new_message");
  return count ?? 0;
}
async function emailsDoDono(): Promise<number> {
  const { count } = await adm().from("emails_teste").select("id", { count: "exact", head: true }).eq("usuario_id", ids.dono).eq("evento", "new_message");
  return count ?? 0;
}

async function abrir(page: Page) {
  await page.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
  const conversa = page.getByRole("button", { name: new RegExp(TITULO) }).first();
  await expect(conversa).toBeVisible({ timeout: 30_000 });
  await conversa.click();
  await expect(page.getByTestId("mensagem-campo")).toBeVisible();
}

test.describe("T2204 — E1057 (a): CPF/RG pelo chat são recusados pela tela, e nada sai @E1057", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    // Conta de teste: um e-mail que saísse ficaria na caixa de QA, onde o spec o procura.
    const { error } = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.dono, ids.inq]);
    if (error) throw error;
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true });
    await gravarMensagem(ids.dono, ids.inq, ids.imovel, "Olá! Pode perguntar por aqui.", conversationId(ids.inq, ids.dono, ids.imovel));
  });
  test.afterAll(async () => {
    await adm().from("messages").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono, ids.inq]);
  });

  for (const w of [390, 1280] as const) {
    test(`${w}: cada formato de documento é recusado com a frase do Ocupantes; nada gravado, nada avisado`, async ({ browser }) => {
      const p = await entrar(browser, inq.email, senha);
      await p.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await abrir(p);
      const campo = p.getByTestId("mensagem-campo");
      const enviar = p.getByRole("button", { name: "Enviar", exact: true });
      const [mensagens, avisos, emails] = [await gravadasDoInq(), await avisosDoDono(), await emailsDoDono()];

      for (const d of DOCUMENTOS) {
        await campo.fill(`${d.texto} ${w} ${sufixo}`);
        await enviar.click();
        const recusa = p.getByTestId("mensagens-documento-bloqueado");
        await expect(recusa, d.nome).toBeVisible();
        await expect(recusa, d.nome).toContainText(DOCUMENTO_BLOQUEADO);
        // O texto fica no campo para a pessoa apagar o documento; nada vai ao banco.
        await expect(campo, d.nome).toHaveValue(`${d.texto} ${w} ${sufixo}`);
        await p.waitForTimeout(1_000);
        expect(await gravadasDoInq(), `${d.nome}: nada gravado`).toBe(mensagens);
      }

      // A outra parte não é avisada: nem sino nem e-mail (o aviso só nasce de mensagem gravada).
      await p.waitForTimeout(3_000);
      expect(await avisosDoDono(), "nenhum aviso de mensagem nova ao dono").toBe(avisos);
      expect(await emailsDoDono(), "nenhum e-mail de mensagem nova ao dono").toBe(emails);

      // Controle: sem documento, o mesmo campo envia (a recusa não é um campo travado).
      await campo.fill(`Posso visitar sábado? ${w} ${sufixo}`);
      await enviar.click();
      await expect.poll(gravadasDoInq, { timeout: 20_000 }).toBe(mensagens + 1);
      await expect(p.getByTestId("mensagens-documento-bloqueado")).toHaveCount(0);
      await p.context().close();
    });
  }
});
