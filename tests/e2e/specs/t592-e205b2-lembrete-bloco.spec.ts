import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T592 — E205-B2: lembrete do bloco renovado ainda não pago (bloco_inicio_lembrete), pela rotina diária de verdade.
    A. bloco 2 renovado pelas duas partes, começa em 2 dias, sem pagamento → o morador recebe (caixa de QA), UMA vez;
    B. bloco 2 renovado, começa em 2 dias, JÁ pago → nada;
    C. bloco 2 sem o aceite do morador (pendente) → nada;
    D. só o bloco 1, começando em 2 dias, sem pagamento → nada (bloco 1 fica de fora);
    E. rodar de novo não repete.
  O laboratório não tem CRON_SECRET: como a t586, o teste sobe um 2º servidor do MESMO build (porta 3125) com um
  segredo só dele e AUTOMACOES_ATIVO=1 — mesmo banco local, mesmas integrações simuladas.
*/
const SAIDA = "tests/laboratorio/saida";
const PORTA = 3125;
const SEGREDO = `lab-t592-${Math.random().toString(36).slice(2)}`;
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
const contratos: string[] = [];
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const emDias = (n: number) => new Date(Date.parse(hojeBRT()) + n * 86_400_000).toISOString().slice(0, 10);
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const EVENTO = "bloco_inicio_lembrete";
let servidor: ChildProcess | null = null;

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  const id = await criarConta({ email: `${quem}.t592.${sufixo}@lab.vivanomads.test`, nome, role }, senha);
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

/** Contrato ativo com o bloco 1 (pago) e, se pedido, o bloco 2 começando em 2 dias. */
async function contrato(o: { letra: string; inquilino: string; bloco2: "renovado" | "pendente" | null; bloco2Pago?: boolean; bloco1ComecaEm?: number }) {
  const imovel = await criarImovelPronto(ids.dono, `Studio bloco ${o.letra} t592 ${sufixo}`, { ativo: true });
  const lead = await criarLead(ids.dono, o.inquilino, imovel, true);
  const agora = new Date().toISOString();
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: o.inquilino, lead_id: lead, owner_plan: "essential", faixa: "temporada", prazo_total_dias: 120, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 1024, qtd_ocupantes: 1, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  contratos.push(c.id);
  const ini1 = o.bloco1ComecaEm != null ? emDias(o.bloco1ComecaEm) : emDias(-58);
  const fim1 = new Date(Date.parse(ini1) + 59 * 86_400_000).toISOString().slice(0, 10);
  const { data: b1, error: e1 } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio: ini1, fim: fim1, meses: 2, valor: 6400, caucao: 3200, status: "ativo", aceite_proprietario_em: agora, aceite_inquilino_em: agora }).select("id").single();
  if (e1) throw e1;
  if (o.bloco1ComecaEm == null) {
    await adm().from("pagamentos_bloco").insert({ bloco_id: b1.id, contrato_id: c.id, tipo: "aluguel", valor: 6400, data_pagamento: ini1, marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora });
  }
  if (o.bloco2) {
    const ini2 = emDias(2);
    const fim2 = new Date(Date.parse(ini2) + 59 * 86_400_000).toISOString().slice(0, 10);
    const { data: b2, error: e2 } = await adm()
      .from("contrato_blocos")
      .insert({ contrato_id: c.id, numero_bloco: 2, inicio: ini2, fim: fim2, meses: 2, valor: 6400, caucao: 0, status: o.bloco2 === "renovado" ? "agendado" : "pendente_aceite", aceite_proprietario_em: agora, aceite_inquilino_em: o.bloco2 === "renovado" ? agora : null })
      .select("id")
      .single();
    if (e2) throw e2;
    if (o.bloco2Pago) await adm().from("pagamentos_bloco").insert({ bloco_id: b2.id, contrato_id: c.id, tipo: "aluguel", valor: 6400, data_pagamento: hojeBRT(), marcado_por: ids.dono, confirmado_pelo_inquilino: true, confirmado_em: agora });
  }
  return c.id as string;
}

async function rodar() {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/automacoes`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const corpo = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  expect(r.status, JSON.stringify(corpo)).toBe(200);
  expect(corpo.simulado).toBe(false);
  return corpo;
}

async function caixa(usuarioId: string): Promise<string[]> {
  const { data } = await adm().from("emails_teste").select("corpo").eq("usuario_id", usuarioId).eq("evento", EVENTO);
  return (data ?? []).map((d) => String(d.corpo ?? ""));
}

test.describe("T592 — E205-B2: lembrete do bloco renovado ainda não pago", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    ids.dono = await conta("dono", "Dora Bloco", "owner");
    for (const k of ["ana", "beto", "caio", "duda"]) ids[k] = await conta(k, `${k[0].toUpperCase()}${k.slice(1)} Bloco`, "tenant");
    ids.A = await contrato({ letra: "A", inquilino: ids.ana, bloco2: "renovado" });
    ids.B = await contrato({ letra: "B", inquilino: ids.beto, bloco2: "renovado", bloco2Pago: true });
    ids.C = await contrato({ letra: "C", inquilino: ids.caio, bloco2: "pendente" });
    ids.D = await contrato({ letra: "D", inquilino: ids.duda, bloco2: null, bloco1ComecaEm: 2 });
    const log = createWriteStream(`${SAIDA}/t592-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, AUTOMACOES_ATIVO: "1", PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/automacoes`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (contratos.length) {
      await adm().from("pagamentos_bloco").delete().in("contrato_id", contratos);
      await adm().from("contrato_eventos").delete().in("contrato_id", contratos);
      await adm().from("contrato_blocos").delete().in("contrato_id", contratos);
      await adm().from("contratos").delete().in("id", contratos);
    }
    await adm().from("automacoes_envios").delete().in("usuario_id", Object.values(ids));
    await adm().from("leads").delete().eq("owner_id", ids.dono ?? "");
    await apagarContas([ids.dono, ids.ana, ids.beto, ids.caio, ids.duda]);
  });

  test("A–D: só o bloco 2 renovado e sem pagamento recebe; o texto segue o desenho", async () => {
    await rodar();
    await expect.poll(async () => (await caixa(ids.ana)).length, { timeout: 30_000 }).toBe(1);
    const [corpo] = await caixa(ids.ana);
    expect(corpo).toContain(`O bloco 2 da sua estadia começa em ${ddmm(emDias(2))}`);
    expect(corpo).toContain(`Studio bloco A t592 ${sufixo}`);
    expect(corpo).toMatch(/Valor do bloco: Bloco 2 \(2 meses: [^)]*\) — R\$\s?6\.400/);
    expect(corpo).toContain("O pagamento é direto ao proprietário; os dados estão na página da estadia.");
    expect(corpo).toContain("Ver a estadia");
    expect(corpo).toContain(`/dashboard/estadia/${ids.A}`);
    // Só a mensagem (antes do rodapé padrão, que traz a linha antigolpe "nunca pede Pix…").
    const mensagem = corpo.slice(0, corpo.indexOf("— Viva Nomads"));
    expect(mensagem.length, "o rodapé padrão está lá").toBeGreaterThan(0);
    expect(mensagem).not.toMatch(/venc|atras|aluguel|pix|ag[êe]ncia|conta corrente/i);
    expect(await caixa(ids.beto), "B: já pago").toHaveLength(0);
    expect(await caixa(ids.caio), "C: sem o aceite do morador").toHaveLength(0);
    expect(await caixa(ids.duda), "D: bloco 1 fica de fora").toHaveLength(0);
    expect(await caixa(ids.dono), "nunca ao dono").toHaveLength(0);
  });

  test("E: rodar de novo não repete", async () => {
    await rodar();
    await new Promise((r) => setTimeout(r, 3000));
    expect(await caixa(ids.ana)).toHaveLength(1);
  });
});
