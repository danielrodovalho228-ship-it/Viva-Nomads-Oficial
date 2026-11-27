import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2130 — E289 @E289: o e-mail do cron de automações traz os fatos do caso (o lembrete de saída, 3 dias antes).
  Regra decidida (E289; unitário src/lib/automacoes/corpo-automacao.test.ts): o assunto e o corpo dizem o imóvel, a
  data e o horário da saída. O imóvel aparece como título · bairro, cidade, nunca o endereço exato.
    - assunto: "Saída de <título> em DD/MM"
    - corpo: "Olá <primeiro nome>, a saída de <título> é em DD/MM/AAAA (até as HH:MM)."
  O cron sobe num 2º servidor do mesmo build (porta 3130), com um CRON_SECRET só dele e AUTOMACOES_ATIVO=1 (padrão do
  t597 e do t711). Contrato assinado, com o bloco a terminar daqui a 3 dias e saída até as 11:00. A leitura é na caixa de
  testes (emails_teste) do morador e do dono. Os valores esperados estão escritos aqui, pela regra.
*/
const PORTA = 3130;
const SEGREDO = `lab-t2130-${Math.random().toString(36).slice(2)}`;
const SAIDA_LOG = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const RUA = "Rua dos Ipês, 289";
// Sem dígitos no título: o servidor tira sequências de números dos textos dos e-mails (proteção de contato), por isso o
// sufixo do laboratório é só de letras.
const TITULO = `Apto dos Ipês ${sufixo}`;
const ids: Record<string, string> = {};
let servidor: ChildProcess | null = null;
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const emDias = (n: number) => new Date(Date.parse(hojeBRT()) + n * 86_400_000).toISOString().slice(0, 10);
const somar = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  const id = await criarConta({ email: `${quem}.t2130.${sufixo}@lab.vivanomads.test`, nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

async function caixa(usuarioId: string, evento: string): Promise<{ assunto: string; corpo: string }[]> {
  const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuarioId).eq("evento", evento);
  return (data ?? []).map((d) => ({ assunto: String(d.assunto ?? ""), corpo: String(d.corpo ?? "") }));
}

test.describe("T2130 — E289: o lembrete de saída do cron diz o imóvel, a data e o horário @E289", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await conta("dono", "Dalila Dona", "owner");
    ids.inq = await conta("inq", "Murilo Morador", "tenant");
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { ativo: true, preco: 3200 });
    await adm().from("properties").update({ address: "Santa Mônica", city: "Uberlândia", checkout_before: "11:00", checkin_after: "14:00", exact_address: RUA }).eq("id", ids.imovel);
    const lead = await criarLead(ids.dono, ids.inq, ids.imovel, true);
    const agora = new Date().toISOString();
    const { data: c, error } = await adm()
      .from("contratos")
      .insert({ property_id: ids.imovel, tenant_id: ids.inq, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, capacidade_snapshot: 2, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
      .select("id")
      .single();
    if (error) throw error;
    ids.contrato = c.id as string;
    // E1089 (coordenador): o lembrete conta da SAÍDA (o dia seguinte à última noite gravada no bloco). Saída em 3 dias =
    // última noite em 2 dias.
    ids.fim = emDias(2);
    ids.saida = emDias(3);
    const inicio = somar(ids.fim, -59);
    const { data: b1, error: e1 } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio, fim: ids.fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora }).select("id").single();
    if (e1) throw e1;
    await adm().from("pagamentos_bloco").insert({ bloco_id: b1.id, contrato_id: c.id, tipo: "aluguel", valor: 6400, data_pagamento: inicio, marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora });
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (ids.contrato) {
      await adm().from("pagamentos_bloco").delete().eq("contrato_id", ids.contrato);
      await adm().from("contrato_eventos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids.contrato);
      await adm().from("contratos").delete().eq("id", ids.contrato);
    }
    const pessoas = [ids.dono, ids.inq].filter(Boolean);
    await adm().from("automacoes_envios").delete().in("usuario_id", pessoas);
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas(pessoas);
  });

  test("3 dias antes da saída: assunto e corpo com o imóvel, a data e o horário, sem o endereço exato", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const log = createWriteStream(`${SAIDA_LOG}/t2130-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);

    const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
    const corpoCron = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    expect(r.status, JSON.stringify(corpoCron)).toBe(200);
    expect(corpoCron.simulado).toBe(false);

    const ddmm = `${ids.saida.slice(8, 10)}/${ids.saida.slice(5, 7)}`;
    for (const [quem, primeiro] of [[ids.inq, "Murilo"], [ids.dono, "Dalila"]] as const) {
      await expect.poll(async () => (await caixa(quem, "saida_lembrete")).length, { timeout: 30_000, message: `o lembrete de saída chegou a ${primeiro}` }).toBe(1);
      const [email] = await caixa(quem, "saida_lembrete");
      expect(email.assunto, "assunto com o imóvel e a data").toContain(`Saída de ${TITULO} em ${ddmm}`);
      expect(email.corpo, "corpo com a pessoa, o imóvel, a data e o horário").toContain(`Olá ${primeiro}, a saída de ${TITULO} é em ${dataBR(ids.saida)} (até as 11:00).`);
      expect(email.corpo, "o bairro e a cidade, como o título · bairro, cidade").toContain("Santa Mônica, Uberlândia");
      expect(email.corpo, "nunca o endereço exato").not.toContain(RUA);
    }
  });
});
