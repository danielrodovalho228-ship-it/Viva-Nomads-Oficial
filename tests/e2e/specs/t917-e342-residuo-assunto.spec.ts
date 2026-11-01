import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T917 — E342 resíduo (#1975, Pista B): quando o título do imóvel não cabe inteiro nem na forma compacta com a data,
  o assunto real mandado pelo cron leva o NOME INTEIRO e deixa a data para o corpo:
   - renovação (bloco que termina em 15 dias), título de 40 caracteres: "Renovar <título inteiro>? · Viva Nomads";
   - proposta vencendo, título de 35 caracteres: "Proposta vencendo: <título inteiro> · Viva Nomads".
  Nos dois, até 70 caracteres e sem "…". A t885 (#1935) cobre o caso que cabe na compacta com a hora.
  Como a t597/t712/t885: um 2º servidor do MESMO build (porta 3190), com CRON_SECRET e AUTOMACOES_ATIVO=1 só no processo
  dele — nenhuma configuração de ambiente muda. Contas marcadas como de teste: o e-mail cai em emails_teste.
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3190;
const SEGREDO = `lab-t917-${Math.random().toString(36).slice(2)}`;
const senha = novaSenha();
const sufixo = novoSufixo();
const TITULO_RENOVA = `Apartamento mobiliado Centro t917 ${sufixo}`; // 40
const TITULO_PROPOSTA = `Studio mobiliado Centro t917 ${sufixo}`; // 35
const ids: { dono?: string; inq?: string; contrato?: string; proposta?: string } = {};
let servidor: ChildProcess | null = null;

const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const somar = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  const id = await criarConta({ email: `${quem}.t917.${sufixo}@lab.vivanomads.test`, nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}
async function caixa(usuarioId: string, evento: string): Promise<{ assunto: string; corpo: string }[]> {
  const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuarioId).eq("evento", evento).order("criado_em");
  return (data ?? []).map((d) => ({ assunto: String(d.assunto ?? ""), corpo: String(d.corpo ?? "") }));
}
async function emailSobre(usuarioId: string, evento: string, titulo: string) {
  await expect.poll(async () => (await caixa(usuarioId, evento)).filter((m) => m.corpo.includes(titulo)).length, { timeout: 30_000, message: `${evento} sobre ${titulo}` }).toBeGreaterThanOrEqual(1);
  return (await caixa(usuarioId, evento)).filter((m) => m.corpo.includes(titulo)).at(-1)!;
}

test.describe("T917 — E342 resíduo (#1975): renovação e proposta com o nome inteiro no assunto real", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    expect(TITULO_RENOVA.length).toBe(40);
    expect(TITULO_PROPOSTA.length).toBe(35);
    ids.dono = await conta("dono", "Dora Residuo", "owner");
    ids.inq = await conta("inq", "Ivo Residuo", "tenant");
    // Renovação: contrato ativo e assinado, bloco ativo que termina em exatamente 15 dias.
    const imR = await criarImovelPronto(ids.dono, TITULO_RENOVA, { ativo: true, preco: 3200 });
    const leadR = await criarLead(ids.dono, ids.inq, imR, true);
    const agora = new Date().toISOString();
    const fim = somar(hojeBRT(), 15);
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({ property_id: imR, tenant_id: ids.inq, lead_id: leadR, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, capacidade_snapshot: 3, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    const { error: eb } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio: somar(fim, -59), fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora });
    if (eb) throw eb;
    // Proposta: aberta, vence em ~5 h; a vez é do morador.
    const imP = await criarImovelPronto(ids.dono, TITULO_PROPOSTA, { ativo: true, preco: 3200 });
    const leadP = await criarLead(ids.dono, ids.inq, imP);
    const prazo = new Date(Date.now() + 5 * 3_600_000);
    prazo.setUTCMinutes(0, 0, 0);
    const { data: numero } = await adm().rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
    const { data: p, error: ep } = await adm()
      .from("propostas")
      .insert({ numero, lead_id: leadP, property_id: imP, owner_id: ids.dono, tenant_id: ids.inq, status: "enviada", versao_atual: 1, validade_dias: 7, valida_ate: prazo.toISOString() })
      .select("id")
      .single();
    if (ep) throw ep;
    ids.proposta = p.id as string;
    const { error: ev } = await adm().from("proposta_versoes").insert({ proposta_id: p.id, versao: 1, autor: "owner", valor_base: 3200, valor_mensal: 3200, meses: 4, data_entrada: somar(hojeBRT(), 20), total_mensal: 3200, total_contrato: 12800 });
    if (ev) throw ev;
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (ids.proposta) {
      await adm().from("proposta_versoes").delete().eq("proposta_id", ids.proposta);
      await adm().from("propostas").delete().eq("id", ids.proposta);
    }
    if (ids.contrato) {
      for (const t of ["pagamentos_bloco", "contrato_eventos", "contrato_blocos"]) await adm().from(t).delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    const pessoas = [ids.dono, ids.inq].filter(Boolean) as string[];
    if (pessoas.length) {
      await adm().from("automacoes_envios").delete().in("usuario_id", pessoas);
      await adm().from("emails_teste").delete().in("usuario_id", pessoas);
    }
    await apagarContas(pessoas);
  });

  test("o cron manda os dois assuntos com o nome inteiro (data no corpo)", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    mkdirSync(SAIDA, { recursive: true });
    const log = createWriteStream(`${SAIDA}/t917-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
    const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
    const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    expect(r.status, JSON.stringify(corpo)).toBe(200);
    expect(corpo.simulado).toBe(false);

    const renova = await emailSobre(ids.dono!, "renovacao_aviso", TITULO_RENOVA);
    const proposta = await emailSobre(ids.inq!, "proposta_vencendo", TITULO_PROPOSTA);
    console.log(`t917|renovacao|${renova.assunto}`);
    console.log(`t917|proposta|${proposta.assunto}`);
    expect(renova.assunto).toBe(`Renovar ${TITULO_RENOVA}? · Viva Nomads`);
    expect(proposta.assunto).toBe(`Proposta vencendo: ${TITULO_PROPOSTA} · Viva Nomads`);
    for (const a of [renova.assunto, proposta.assunto]) {
      expect(a.length, a).toBeLessThanOrEqual(70);
      expect(a, "sem corte com reticências").not.toContain("…");
    }
    // A data saiu do assunto e está no corpo.
    expect(renova.corpo).toMatch(/termina em \d{2}\/\d{2}\/\d{4}/);
    expect(proposta.corpo).toContain("(horário de Brasília)");
  });
});
