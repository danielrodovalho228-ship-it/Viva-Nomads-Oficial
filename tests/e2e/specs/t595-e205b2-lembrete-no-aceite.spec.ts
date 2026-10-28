import { test, expect, type Browser } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T595 — E205-B2, a porta do ACEITE: o lembrete do bloco renovado ainda não pago (bloco_inicio_lembrete) sai na hora
  em que a renovação é aceita pelas duas partes, se o bloco começa em até 3 dias. Caminho exercitado: o aditivo
  assinado pelos dois com código (estadia-actions → aplicarAditivo → lembreteDeBlocoNoAceite), pela tela de verdade.
    A. aditivo +1 mês assinado, o bloco 2 novo começa em 2 dias, sem pagamento → o morador recebe NA HORA, uma vez;
       o dono, nunca;
    B. aditivo +1 mês assinado, o bloco 2 novo começa em 9 dias → nada na hora; quando o bloco chega a 3 dias do
       início, a rotina diária (cron) manda — uma vez, e de novo não repete.
  O renovarBloco (a outra porta) não tem botão em nenhuma tela: o Next não publica uma Server Action que nenhum
  componente do cliente importa, então o laboratório não alcança essa porta. As duas portas chamam a MESMA função
  (lembreteDeBlocoNoAceite); a guarda em src/lib/estadia/lembrete-bloco.test.ts confere as duas chamadas.
  A parte do cron sobe um 2º servidor do mesmo build (porta 3126) com um CRON_SECRET só dele, como a t592.
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3126;
const SEGREDO = `lab-t595-${Math.random().toString(36).slice(2)}`;
const EVENTO = "bloco_inicio_lembrete";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
const contratos: string[] = [];
const emails: Record<string, string> = {};
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const emDias = (n: number) => new Date(Date.parse(hojeBRT()) + n * 86_400_000).toISOString().slice(0, 10);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
let servidor: ChildProcess | null = null;

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  emails[quem] = `${quem}.t595.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email: emails[quem], nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

/** Contrato ativo com SÓ o bloco 1 (2 meses, já começou, pago), terminando em `fimEm` dias. */
async function contrato(letra: string, inquilino: string, fimEm: number) {
  const imovel = await criarImovelPronto(ids.dono, `Studio aceite ${letra} t595 ${sufixo}`, { ativo: true, preco: 3200 });
  const lead = await criarLead(ids.dono, inquilino, imovel, true);
  const agora = new Date().toISOString();
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: inquilino, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, capacidade_snapshot: 2, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  contratos.push(c.id);
  const fim = emDias(fimEm);
  const inicio = new Date(Date.parse(fim) - 59 * 86_400_000).toISOString().slice(0, 10);
  const { data: b1, error: e1 } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio, fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora }).select("id").single();
  if (e1) throw e1;
  await adm().from("pagamentos_bloco").insert({ bloco_id: b1.id, contrato_id: c.id, tipo: "aluguel", valor: 6400, data_pagamento: inicio, marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora });
  return c.id as string;
}

async function caixa(usuarioId: string): Promise<{ corpo: string; assunto: string }[]> {
  const { data } = await adm().from("emails_teste").select("corpo, assunto").eq("usuario_id", usuarioId).eq("evento", EVENTO);
  return (data ?? []).map((d) => ({ corpo: String(d.corpo ?? ""), assunto: String(d.assunto ?? "") }));
}

async function codigoDaCaixa(usuarioId: string, depoisDe: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", "contract_signature_code").gt("criado_em", depoisDe).order("criado_em", { ascending: false }).limit(1);
    const m = /":\s*(\d{6})\s*$/m.exec(String(data?.[0]?.corpo ?? "").trim());
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("O código do aditivo não chegou à caixa de testes em 30 s.");
}

/** Pela tela: o morador propõe +1 mês (2 → 3), o dono aceita, os dois assinam com o código. */
async function aditivoMaisUmMes(browser: Browser, contratoId: string, morador: string) {
  const m = await entrar(browser, emails[morador], senha);
  await m.goto(`/dashboard/estadia/${contratoId}/alteracao`, { waitUntil: "domcontentloaded" });
  await m.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await m.getByTestId("alteracao-meses").selectOption("3");
  await m.getByTestId("alteracao-enviar").click();
  await expect(m).toHaveURL(new RegExp(`/dashboard/estadia/${contratoId}$`));
  await expect(m.getByTestId("aditivo-resumo")).toHaveText("Meses: de 2 para 3");

  const d = await entrar(browser, emails.dono, senha);
  await d.goto(`/dashboard/estadia/${contratoId}`, { waitUntil: "domcontentloaded" });
  await d.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await d.getByTestId("aditivo-aceitar").click();
  await expect(d.getByTestId("estadia-ok").or(d.getByTestId("estadia-erro"))).toHaveText("Proposta aceita. Agora as duas partes assinam o aditivo.", { timeout: 30_000 });
  await expect(d.getByTestId("estadia-aditivo")).toHaveAttribute("data-status", "aceito", { timeout: 20_000 });

  for (const [pagina, quem] of [[d, ids.dono], [m, ids[morador]]] as const) {
    await pagina.reload({ waitUntil: "domcontentloaded" });
    await pagina.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const desde = new Date().toISOString();
    await pagina.getByTestId("aditivo-pedir-codigo").click();
    await expect(pagina.getByTestId("estadia-ok").or(pagina.getByTestId("estadia-erro"))).toHaveText("Código enviado para o seu e-mail.", { timeout: 30_000 });
    await pagina.getByTestId("aditivo-codigo").fill(await codigoDaCaixa(quem, desde));
    await pagina.getByTestId("aditivo-aceite").check();
    await pagina.getByTestId("aditivo-assinar").click();
    await expect(pagina.getByTestId("estadia-ok").or(pagina.getByTestId("estadia-erro"))).toHaveText("Assinatura registrada.", { timeout: 30_000 });
  }
  await d.context().close();
  await m.context().close();
}

/** O bloco 2 que o aditivo criou: renovado (aceito pelas duas partes), agendado e sem pagamento. */
async function bloco2(contratoId: string) {
  const { data } = await adm().from("contrato_blocos").select("id, inicio, fim, status, aceite_proprietario_em, aceite_inquilino_em").eq("contrato_id", contratoId).eq("numero_bloco", 2).single();
  expect(data, "o aditivo criou o bloco 2").toBeTruthy();
  expect(data!.status).toBe("agendado");
  expect(data!.aceite_proprietario_em).toBeTruthy();
  expect(data!.aceite_inquilino_em).toBeTruthy();
  const { count } = await adm().from("pagamentos_bloco").select("id", { count: "exact", head: true }).eq("bloco_id", data!.id);
  expect(count, "bloco 2 sem pagamento").toBe(0);
  return data as { id: string; inicio: string; fim: string };
}

test.describe("T595 — E205-B2: o lembrete do bloco sai no aceite da renovação (aditivo assinado)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    ids.dono = await conta("dono", "Dora Aceite", "owner");
    ids.ana = await conta("ana", "Ana Aceite", "tenant");
    ids.beto = await conta("beto", "Beto Aceite", "tenant");
    ids.A = await contrato("A", ids.ana, 1); // bloco 2 do aditivo começa em 2 dias
    ids.B = await contrato("B", ids.beto, 8); // bloco 2 do aditivo começa em 9 dias
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (contratos.length) {
      await adm().from("pagamentos_bloco").delete().in("contrato_id", contratos);
      await adm().from("contrato_eventos").delete().in("contrato_id", contratos);
      await adm().from("contrato_blocos").delete().in("contrato_id", contratos);
      await adm().from("contratos").delete().in("id", contratos);
    }
    await adm().from("automacoes_envios").delete().in("usuario_id", [ids.dono, ids.ana, ids.beto].filter(Boolean));
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.ana, ids.beto]);
  });

  test("A: aditivo assinado com o bloco 2 começando em 2 dias → o lembrete sai na hora, ao morador, uma vez", async ({ browser }) => {
    expect(await caixa(ids.ana)).toHaveLength(0);
    await aditivoMaisUmMes(browser, ids.A, "ana");
    const b = await bloco2(ids.A);
    expect(b.inicio).toBe(emDias(2));
    // Sem cron: o envio vem do aceite (after() da assinatura que completou o aditivo).
    await expect.poll(async () => (await caixa(ids.ana)).length, { timeout: 30_000 }).toBe(1);
    const [e] = await caixa(ids.ana);
    expect(e.assunto).toBe(`O bloco 2 da sua estadia começa em ${ddmm(b.inicio)}`);
    expect(e.corpo).toContain(`Studio aceite A t595 ${sufixo}`);
    expect(e.corpo).toContain("O pagamento é direto ao proprietário; os dados estão na página da estadia.");
    expect(e.corpo).toContain(`/dashboard/estadia/${ids.A}`);
    const { data: chave } = await adm().from("automacoes_envios").select("chave").eq("chave", `${EVENTO}:${ids.A}:2`);
    expect(chave, "a chave do (contrato, bloco) foi gravada no aceite").toHaveLength(1);
    await new Promise((r) => setTimeout(r, 3000));
    expect(await caixa(ids.ana), "uma vez só").toHaveLength(1);
    expect(await caixa(ids.dono), "nunca ao dono").toHaveLength(0);
  });

  test("B: aditivo assinado com o bloco 2 começando em 9 dias → nada na hora", async ({ browser }) => {
    await aditivoMaisUmMes(browser, ids.B, "beto");
    const b = await bloco2(ids.B);
    expect(b.inicio).toBe(emDias(9));
    // O aditivo saiu inteiro (o evento da remarcação foi gravado) e, mesmo assim, nenhum lembrete do bloco.
    const { data: ev } = await adm().from("contrato_eventos").select("tipo").eq("contrato_id", ids.B).eq("tipo", "estadia_remarcada");
    expect(ev).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 8000));
    expect(await caixa(ids.beto)).toHaveLength(0);
    const { data: chave } = await adm().from("automacoes_envios").select("chave").eq("chave", `${EVENTO}:${ids.B}:2`);
    expect(chave, "a chave fica livre para o cron").toHaveLength(0);
  });

  test("B (cont.): quando o bloco chega a 3 dias do início, a rotina diária manda — uma vez", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    // A data simulada: o bloco 2 do contrato B passa a começar em 3 dias (o limite do lembrete).
    const b = await bloco2(ids.B);
    const inicio = emDias(3);
    const fim = new Date(Date.parse(inicio) + 29 * 86_400_000).toISOString().slice(0, 10);
    await adm().from("contrato_blocos").update({ inicio, fim }).eq("id", b.id);
    await adm().from("contrato_blocos").update({ fim: emDias(2) }).eq("contrato_id", ids.B).eq("numero_bloco", 1);

    const log = createWriteStream(`${SAIDA}/t595-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);

    const rodar = async () => {
      const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
      const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      expect(r.status, JSON.stringify(corpo)).toBe(200);
      expect(corpo.simulado).toBe(false);
    };
    await rodar();
    await expect.poll(async () => (await caixa(ids.beto)).length, { timeout: 30_000 }).toBe(1);
    const [e] = await caixa(ids.beto);
    expect(e.assunto).toBe(`O bloco 2 da sua estadia começa em ${ddmm(inicio)}`);
    expect(e.corpo).toContain(`Studio aceite B t595 ${sufixo}`);
    // A chave do aceite do contrato A segura o cron: a Ana continua com um só.
    await rodar();
    await new Promise((r) => setTimeout(r, 3000));
    expect(await caixa(ids.beto), "o cron não repete").toHaveLength(1);
    expect(await caixa(ids.ana), "o cron não repete o que o aceite já mandou").toHaveLength(1);
    expect(await caixa(ids.dono), "nunca ao dono").toHaveLength(0);
  });
});
