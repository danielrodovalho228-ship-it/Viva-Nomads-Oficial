import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, cpfAleatorio, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo, tornarContratoVigente } from "../fixtures/laboratorio";
import { conversationId } from "../../../src/lib/messages/conversation-id";
import { DOCUMENTO_BLOQUEADO } from "../../../src/lib/messages/contact-guard";

/**
 * T1654 — Família 6, parte C, T2 (servidor): a ação sendMessage é chamada DIRETO (sem a tela, que já mascara antes de
 * enviar), nas três fases da relação e nos dois sentidos. Em todas: a linha gravada e a mensagem que o outro lado lê
 * (pela própria sessão, com RLS) vêm mascaradas. CPF válido: a resposta traz o aviso de documento e nada é gravado.
 * Só no laboratório (cria contas e grava por fora).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.f6c.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const inq = { email: `inq.f6c.${sufixo}@lab.vivanomads.test`, nome: "Ivo Inquilino", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imoveis: string[]; contratos: string[] } = { imoveis: [], contratos: [] };
const MASK = "[contato protegido]";

/** Telefone por extenso + e-mail ofuscado + mensageiro citado: as três lacunas que a parte C fecha. */
const TEXTO = "me chama no zap nove nove nove oito sete seis cinco quatro três ou ivo arroba gmail ponto com";

function idDaAcao(nome: string): string {
  const m = JSON.parse(readFileSync(join(process.cwd(), ".next/server/server-reference-manifest.json"), "utf8")) as { node: Record<string, { exportedName?: string }> };
  const id = Object.entries(m.node).find(([, v]) => v.exportedName === nome)?.[0];
  if (!id) throw new Error(`ação ${nome} fora do manifesto (build do laboratório?)`);
  return id;
}

async function enviarPelaAcao(page: Page, input: { receiverId: string; propertyId: string; body: string }): Promise<string> {
  const r = await page.request.post("/dashboard/mensagens", {
    headers: { "Next-Action": idDaAcao("sendMessage"), "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
    // O conversationId vindo do cliente é ignorado: o servidor recalcula pelas duas pessoas + imóvel.
    data: JSON.stringify([input]),
  });
  expect(r.status()).toBe(200);
  return r.text();
}

async function lerComoDestinatario(email: string, conversa: string): Promise<string[]> {
  const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  const { data, error: e2 } = await c.from("messages").select("body").eq("conversation_id", conversa).order("created_at");
  if (e2) throw e2;
  return (data ?? []).map((l) => l.body as string);
}

async function contrato(imovel: string, status: "ativo" | "concluido"): Promise<string> {
  const { data, error } = await adm()
    .from("contratos")
    .insert({
      property_id: imovel,
      tenant_id: ids.inq,
      owner_plan: "essential",
      faixa: "temporada",
      prazo_total_dias: 60,
      aluguel_mensal: 3200,
      tamanho_bloco_meses: 2,
      comissao_percent: 0.08,
      comissao_valor: 256,
      qtd_ocupantes: 1,
      status: "ativo",
      garantia: "caucao",
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as string;
  ids.contratos.push(id);
  await tornarContratoVigente(id, ids.dono!);
  if (status === "concluido") {
    const { error: e2 } = await adm().from("contratos").update({ status: "concluido" }).eq("id", id);
    if (e2) throw e2;
  }
  return id;
}

const FASES = ["antes do aceite", "contrato ativo", "estadia encerrada"] as const;

test.describe("T1654 — @familia-6c Família 6 C: proteção de contato no servidor (sendMessage direto)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  let pDono: Page;
  let pInq: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    test.setTimeout(240_000);
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    for (const f of FASES) ids.imoveis.push(await criarImovelPronto(ids.dono, `Studio F6C ${f} ${sufixo}`, { ativo: true }));
    // Fase 1: só o pedido (lead novo). Fase 2: aceito + contrato vigente. Fase 3: aceito + contrato concluído.
    await criarLead(ids.dono, ids.inq, ids.imoveis[0]!, false);
    await criarLead(ids.dono, ids.inq, ids.imoveis[1]!, true);
    await contrato(ids.imoveis[1]!, "ativo");
    await criarLead(ids.dono, ids.inq, ids.imoveis[2]!, true);
    await contrato(ids.imoveis[2]!, "concluido");
    pDono = await entrar(browser, dono.email, senha);
    pInq = await entrar(browser, inq.email, senha);
  });
  test.afterAll(async () => {
    for (const c of ids.contratos) {
      await adm().from("pagamentos_bloco").delete().eq("contrato_id", c);
      await adm().from("contrato_blocos").delete().eq("contrato_id", c);
      await adm().from("contratos").delete().eq("id", c);
    }
    if (ids.dono && ids.inq) await adm().from("messages").delete().in("sender_id", [ids.dono, ids.inq]);
    await pDono?.context().close();
    await pInq?.context().close();
    await apagarContas([ids.dono, ids.inq]);
  });

  FASES.forEach((fase, i) => {
    for (const sentido of ["inquilino → dono", "dono → inquilino"] as const) {
      test(`${fase} · ${sentido}: gravada e lida pelo outro lado com o contato mascarado`, async () => {
        const deInq = sentido === "inquilino → dono";
        const [page, para, paraEmail] = deInq ? [pInq, ids.dono!, dono.email] : [pDono, ids.inq!, inq.email];
        const de = deInq ? ids.inq! : ids.dono!;
        const imovel = ids.imoveis[i]!;
        const resposta = await enviarPelaAcao(page, { receiverId: para, propertyId: imovel, body: `${TEXTO} (${sentido})` });
        expect(resposta).not.toContain('"ok":false');
        const conversa = conversationId(de, para, imovel);
        const { data } = await adm().from("messages").select("body").eq("conversation_id", conversa).eq("sender_id", de).order("created_at", { ascending: false }).limit(1);
        const gravada = (data?.[0]?.body as string | undefined) ?? "";
        expect(gravada).toContain(MASK);
        expect(gravada).toContain("zap");
        expect(gravada).not.toMatch(/nove nove nove/i);
        expect(gravada).not.toMatch(/arroba/i);
        const lidas = await lerComoDestinatario(paraEmail, conversa);
        const lida = lidas.find((b) => b.includes(`(${sentido})`)) ?? "";
        expect(lida).toBe(gravada);
      });
    }
  });

  test("CPF válido: aviso de documento e nada gravado", async () => {
    const conversa = conversationId(ids.inq!, ids.dono!, ids.imoveis[1]!);
    const antes = (await adm().from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversa)).count ?? 0;
    const resposta = await enviarPelaAcao(pInq, { receiverId: ids.dono!, propertyId: ids.imoveis[1]!, body: `meu cpf é ${cpfAleatorio()}` });
    expect(resposta).toContain(DOCUMENTO_BLOQUEADO);
    const depois = (await adm().from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversa)).count ?? 0;
    expect(depois).toBe(antes);
  });
});
