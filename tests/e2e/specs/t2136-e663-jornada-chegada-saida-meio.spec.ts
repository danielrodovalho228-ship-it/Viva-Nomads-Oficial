import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, TELEFONE_LAB, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2136 — E663 @E663: a jornada de mensagens da estadia chega na data certa (chegada, semana da saída, meio).
  Regra decidida (E663; unitário src/lib/estadia/jornada-mensagens.test.ts): as datas saem dos blocos atuais do
  contrato. Os envios exigem o contrato assinado pelas duas partes e o 1º pagamento confirmado:
    - chegada (no dia da entrada) → morador e dono: "Hoje é o dia da entrada (DD/MM/AAAA, a partir das HH:MM)…";
    - semana da saída (7 dias antes da SAÍDA, o dia seguinte ao fim gravado; E1089) → morador e dono: "A saída é em DD/MM/AAAA, até as HH:MM: falta uma semana…";
    - meio da estadia (só estadia de 60 dias ou mais, no dia entrada + metade) → só o morador: "Vocês estão na metade
      da estadia (entrada DD/MM/AAAA, saída DD/MM/AAAA)…".
  Nenhum dado pessoal nem contato no texto (E441). Controle: contrato que entra hoje SEM o 1º pagamento → nada.
  O cron das automações sobe num 2º servidor do mesmo build (porta 3132), com um CRON_SECRET só dele e
  AUTOMACOES_ATIVO=1 (padrão do t597 e do t2130). Leitura na caixa de testes. Datas e textos esperados escritos aqui.
*/
const PORTA = 3132;
const SEGREDO = `lab-t2136-${Math.random().toString(36).slice(2)}`;
const SAIDA_LOG = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
const contratos: string[] = [];
let servidor: ChildProcess | null = null;
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const somar = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  const id = await criarConta({ email: `${quem}.t2136.${sufixo}@lab.vivanomads.test`, nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

/** Contrato assinado há semanas, bloco único de `entrada` a `fim`, com ou sem o 1º pagamento confirmado. */
async function estadia(letra: string, inquilino: string, entrada: string, fim: string, pago: boolean) {
  const imovel = await criarImovelPronto(ids.dono, `Casa Jornada ${letra} ${sufixo}`, { ativo: true, preco: 3200 });
  await adm().from("properties").update({ address: "Centro", city: "Uberlândia", checkin_after: "14:00", checkout_before: "11:00" }).eq("id", imovel);
  const lead = await criarLead(ids.dono, inquilino, imovel, true);
  const assinado = new Date(Date.now() - 40 * 86_400_000).toISOString();
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: inquilino, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, capacidade_snapshot: 2, status: "ativo", garantia: "caucao", assinado_proprietario_em: assinado, assinado_inquilino_em: assinado })
    .select("id")
    .single();
  if (error) throw error;
  contratos.push(c.id as string);
  const { data: b1, error: e1 } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio: entrada, fim, meses: 2, valor: 6400, caucao: 3200, status: "ativo", aceite_proprietario_em: assinado, aceite_inquilino_em: assinado }).select("id").single();
  if (e1) throw e1;
  if (pago) await adm().from("pagamentos_bloco").insert({ bloco_id: b1.id, contrato_id: c.id, tipo: "aluguel", valor: 6400, data_pagamento: entrada, marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: assinado });
  return c.id as string;
}

async function caixa(usuarioId: string, evento: string): Promise<string[]> {
  const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", evento);
  return (data ?? []).map((d) => String(d.corpo ?? ""));
}

test.describe("T2136 — E663: a jornada da estadia chega na data (chegada, semana da saída, meio), só com o 1º pagamento @E663", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    ids.dono = await conta("dono", "Dalva Jornada", "owner");
    for (const k of ["chegada", "saida", "meio", "semp"]) ids[k] = await conta(k, `${k[0].toUpperCase()}${k.slice(1)} Morador`, "tenant");
    const hoje = hojeBRT();
    ids.datasChegada = `${hoje}|${somar(hoje, 59)}`;
    ids.cChegada = await estadia("chegada", ids.chegada, hoje, somar(hoje, 59), true);
    // E1089 (coordenador): a "semana da saída" conta da SAÍDA (o dia seguinte à última noite do bloco). Saída em 7 dias =
    // última noite em 6 dias.
    ids.datasSaida = `${somar(hoje, -52)}|${somar(hoje, 6)}`;
    ids.cSaida = await estadia("saida", ids.saida, somar(hoje, -52), somar(hoje, 6), true);
    ids.datasMeio = `${somar(hoje, -30)}|${somar(hoje, 30)}`; // 60 dias: o meio é entrada + 30 = hoje
    ids.cMeio = await estadia("meio", ids.meio, somar(hoje, -30), somar(hoje, 30), true);
    ids.cSemPagamento = await estadia("sempagar", ids.semp, hoje, somar(hoje, 59), false);
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (contratos.length) {
      await adm().from("pagamentos_bloco").delete().in("contrato_id", contratos);
      await adm().from("contrato_eventos").delete().in("contrato_id", contratos);
      await adm().from("contrato_blocos").delete().in("contrato_id", contratos);
      await adm().from("contratos").delete().in("id", contratos);
    }
    const pessoas = ["dono", "chegada", "saida", "meio", "semp"].map((k) => ids[k]).filter(Boolean);
    await adm().from("automacoes_envios").delete().in("usuario_id", pessoas);
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas(pessoas);
  });

  test("o cron do dia manda chegada e semana da saída (morador e dono) e o meio (só morador); sem pagamento, nada", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const log = createWriteStream(`${SAIDA_LOG}/t2136-servidor-cron.log`);
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

    const [entC] = ids.datasChegada.split("|");
    const [, fimS] = ids.datasSaida.split("|");
    const [entM, fimM] = ids.datasMeio.split("|");
    const CASOS = [
      { quem: ids.chegada, evento: "jornada_chegada", frase: `Hoje é o dia da entrada (${dataBR(entC)}, a partir das 14:00).` },
      { quem: ids.dono, evento: "jornada_chegada", frase: `Hoje é o dia da entrada (${dataBR(entC)}, a partir das 14:00).` },
      { quem: ids.saida, evento: "jornada_semana_saida", frase: `A saída é em ${dataBR(somar(fimS, 1))}, até as 11:00: falta uma semana.` },
      { quem: ids.dono, evento: "jornada_semana_saida", frase: `A saída é em ${dataBR(somar(fimS, 1))}, até as 11:00: falta uma semana.` },
      { quem: ids.meio, evento: "jornada_meio_estadia", frase: `Vocês estão na metade da estadia (entrada ${dataBR(entM)}, saída ${dataBR(somar(fimM, 1))}).` },
    ];
    for (const c of CASOS) {
      await expect.poll(async () => (await caixa(c.quem, c.evento)).some((t) => t.includes(c.frase)), { timeout: 30_000, message: `${c.evento}: "${c.frase}"` }).toBe(true);
      // E441: nenhum dado pessoal das partes no e-mail (o telefone das contas do laboratório e o e-mail delas). O rodapé
      // e o remetente oficial da Viva fazem parte do modelo de todo e-mail e não são dado das partes.
      for (const t of await caixa(c.quem, c.evento)) {
        expect(t, `${c.evento}: sem o telefone das partes`).not.toContain(TELEFONE_LAB);
        expect(t, `${c.evento}: sem o e-mail das partes`).not.toMatch(/\.t2136\.[a-z]+@lab\.vivanomads\.test/);
      }
    }
    // O meio é só do morador; o dono não recebe.
    expect((await caixa(ids.dono, "jornada_meio_estadia")).some((t) => t.includes(`(entrada ${dataBR(entM)}, saída ${dataBR(somar(fimM, 1))})`)), "o meio da estadia não vai ao dono").toBe(false);
    // Sem o 1º pagamento: nada da jornada para esse morador.
    expect(await caixa(ids.semp, "jornada_chegada"), "sem o 1º pagamento, não há mensagem de chegada").toHaveLength(0);
  });
});
