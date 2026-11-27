import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2151 — E642 @E642 (e E707 @E707): com os prazos da caução LIGADOS, contrato com seguro-fiança não entra na maquinaria da caução.
  Regra decidida (E642; unitário src/lib/caucao/e642-garantia-unica.test.ts): garantia ÚNICA (Lei 8.245/91, art. 37) — caução
  OU seguro-fiança. A rotina diária dos prazos (E637, src/lib/caucao/prazos-servidor.ts) só cria a linha em caucao_prazos
  (migração 0310) para contrato com caução (contratoTemCaucao); com seguro-fiança não há prazo de devolução, nem aviso de
  liberação, nem pendência do dia 30.
  Regra decidida (E707 (a); unitário src/lib/caucao/e707-composicao-prazos.test.ts): silêncio no 7.º dia = devolução DEVIDA DE
  IMEDIATO (liberação integral registrada já no dia 8); os 30 dias são só o TETO EXTERNO do check-out, que o aviso cita.
  O simulador de /dashboard/reembolsos (a outra metade do E707) só renderiza no modo demonstração, por isso não entra aqui.
  A prova: quatro contratos encerrados, iguais em tudo menos na garantia e no check-out — caução e seguro-fiança com saída há
  10 dias (passou o dia 7, não o dia 30) e há 40 dias (passou o dia 30). A rota /api/cron/caucao-prazos corre num 2.º
  servidor do mesmo build (porta 3140, padrão do t2146), com CRON_SECRET só dele; o build tem de ter
  NEXT_PUBLIC_CAUCAO_PRAZOS_ATIVA=on (chave de build: só corre no job @chave-build). A leitura é pela chave de serviço:
  caucao_prazos e a caixa de testes (emails_teste) das partes.
*/
const PORTA = 3140;
const SEGREDO = `lab-t2151-${Math.random().toString(36).slice(2)}`;
const SAIDA_LOG = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
let servidor: ChildProcess | null = null;
let resumo: { ativa?: boolean; contratos?: number; liberacoes?: number; pendencias?: number } = {};
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const somar = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);
const brasil = (d: string) => d.split("-").reverse().join("/");
const saidas: Record<string, string> = {};

async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  const id = await criarConta({ email: `${quem}.t2151.${sufixo}@lab.vivanomads.test`, nome, role }, senha);
  ids[`pessoa_${quem}`] = id;
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

/** Contrato já encerrado (encerrado_sem_renovacao), assinado, com um bloco encerrado que terminou há `diasAtras` dias. */
async function contratoEncerrado(chave: string, garantia: "caucao" | "seguro_fianca", diasAtras: number): Promise<string> {
  const dono = await conta(`dono${chave}`, "Olga Dona", "owner");
  const inq = await conta(`inq${chave}`, "Paulo Morador", "tenant");
  const imovel = await criarImovelPronto(dono, `Apto da garantia ${chave} ${sufixo}`, { ativo: true, preco: 3200 });
  const lead = await criarLead(dono, inq, imovel, true);
  const agora = new Date().toISOString();
  const fim = somar(hojeBRT(), -diasAtras);
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: inq, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, capacidade_snapshot: 2, status: "encerrado_sem_renovacao", encerrado_em: `${somar(fim, 1)}T03:00:00Z`, garantia, assinado_proprietario_em: agora, assinado_inquilino_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  // Seguro-fiança não tem caução no bloco (trava da 0076).
  const { error: e1 } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio: somar(fim, -59), fim, meses: 2, valor: 6400, caucao: garantia === "caucao" ? 3200 : 0, status: "encerrado", aceite_proprietario_em: agora, aceite_inquilino_em: agora });
  if (e1) throw e1;
  ids[`contrato_${chave}`] = c.id as string;
  ids[`dono_${chave}`] = dono;
  ids[`inq_${chave}`] = inq;
  saidas[chave] = fim;
  return c.id as string;
}

const linhaDePrazos = async (contratoId: string) =>
  (await adm().from("caucao_prazos").select("saida_em, liberacao_integral_em, liberacao_motivo, avisou_liberacao_em, pendencia_em").eq("contrato_id", contratoId).maybeSingle()).data as {
    saida_em: string;
    liberacao_integral_em: string | null;
    liberacao_motivo: string | null;
    avisou_liberacao_em: string | null;
    pendencia_em: string | null;
  } | null;

const caixa = async (usuarioId: string, assunto: string) => {
  const { data } = await adm().from("emails_teste").select("assunto, corpo").eq("usuario_id", usuarioId).ilike("assunto", `%${assunto}%`);
  return (data ?? []).map((d) => String(d.corpo ?? ""));
};

test.describe("T2151 — E642/E707: com os prazos da caução ligados, seguro-fiança fica fora e a caução é devida de imediato @E642 @E707 @chave-build", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (chave de serviço e banco local).");
  test.skip(process.env.NEXT_PUBLIC_CAUCAO_PRAZOS_ATIVA !== "on", "Só no job do laboratório com as chaves de build ligadas.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    await contratoEncerrado("cau10", "caucao", 10);
    await contratoEncerrado("seg10", "seguro_fianca", 10);
    await contratoEncerrado("cau40", "caucao", 40);
    await contratoEncerrado("seg40", "seguro_fianca", 40);

    const log = createWriteStream(`${SAIDA_LOG}/t2151-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/caucao-prazos`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);

    const r = await fetch(`http://localhost:${PORTA}/api/cron/caucao-prazos?agora=${encodeURIComponent(new Date().toISOString())}`, { headers: { authorization: `Bearer ${SEGREDO}` } });
    expect(r.status, await r.clone().text()).toBe(200);
    resumo = await r.json();
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    for (const k of Object.keys(ids).filter((k) => k.startsWith("contrato_"))) {
      await adm().from("caucao_prazos").delete().eq("contrato_id", ids[k]);
      await adm().from("contrato_eventos").delete().eq("contrato_id", ids[k]);
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids[k]);
      await adm().from("contratos").delete().eq("id", ids[k]);
    }
    const pessoas = Object.keys(ids).filter((k) => k.startsWith("pessoa_")).map((k) => ids[k]);
    await adm().from("emails_teste").delete().in("usuario_id", pessoas);
    for (const p of pessoas) await adm().from("leads").delete().eq("owner_id", p);
    await apagarContas(pessoas);
  });

  test("1. E642: a rotina diária cria a linha de prazos só para o contrato com caução; seguro-fiança fica sem linha", async () => {
    expect(resumo.ativa, "o build tem a chave dos prazos ligada").toBe(true);
    for (const chave of ["cau10", "cau40"]) {
      const l = await linhaDePrazos(ids[`contrato_${chave}`]);
      expect(l, `o contrato com caução (${chave}) ganhou a linha de prazos`).not.toBeNull();
      expect(l?.saida_em, `com o dia do check-out (${chave})`).toBe(saidas[chave]);
    }
    for (const chave of ["seg10", "seg40"]) {
      expect(await linhaDePrazos(ids[`contrato_${chave}`]), `o contrato com seguro-fiança (${chave}) não tem prazo de caução`).toBeNull();
    }
  });

  test("2. E642: passou o dia 30 — pendência e aviso de atraso só para o dono com caução; o de seguro-fiança não recebe nada", async () => {
    const l = await linhaDePrazos(ids.contrato_cau40);
    expect(l?.pendencia_em, "a caução passou do dia 30 sem devolução: pendência registrada").not.toBeNull();
    await expect.poll(async () => (await caixa(ids.dono_cau40, "devolução em atraso")).length, { timeout: 30_000, message: "o dono com caução recebeu o aviso de atraso" }).toBe(1);
    for (const chave of ["seg10", "seg40"]) {
      for (const quem of [ids[`dono_${chave}`], ids[`inq_${chave}`]]) {
        expect(await caixa(quem, "Caução"), `nenhum aviso de caução às partes do seguro-fiança (${chave})`).toHaveLength(0);
      }
    }
  });

  test("3. E707 (a): silêncio no dia 7 — liberação integral já registrada (devida de imediato), sem pendência; o aviso cita o teto de 30 dias", async () => {
    const l = await linhaDePrazos(ids.contrato_cau10);
    expect(l?.liberacao_motivo, "silêncio do dono no 7.º dia vira liberação integral").toBe("silencio");
    expect(l?.liberacao_integral_em, "registrada já agora, no dia 10, não no dia 30").not.toBeNull();
    expect(l?.avisou_liberacao_em, "os dois foram avisados").not.toBeNull();
    expect(l?.pendencia_em ?? null, "o teto de 30 dias ainda não passou: sem pendência").toBeNull();
    const teto = brasil(somar(saidas.cau10, 30));
    for (const [quem, nome] of [[ids.dono_cau10, "a dona"], [ids.inq_cau10, "o morador"]] as const) {
      await expect.poll(async () => (await caixa(quem, "liberação integral")).length, { timeout: 30_000, message: `o aviso de liberação chegou a ${nome}` }).toBe(1);
      const [corpo] = await caixa(quem, "liberação integral");
      expect(corpo, `a devolução é devida agora (${nome})`).toContain("a devolução é devida agora");
      expect(corpo, `os 30 dias são só o teto externo do check-out (${nome})`).toContain(`O teto externo é ${teto} (30 dias do check-out)`);
    }
  });
});
