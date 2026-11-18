import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, criarLead, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2148 — E627 @E627: o ciclo diário fecha o contrato cujos blocos acabaram, também quando o bloco já estava "encerrado".
  Regra decidida (E627, migração 0306; unitário src/lib/e627-ciclo-fecha-contrato.test.ts): o passo (e) do ciclo
  (avancar_ciclo_blocos) passa a "encerrado_sem_renovacao" o contrato "ativo" cujo último bloco está "encerrado" (o
  caminho manual e a massa antiga) ou "encerrado_sem_renovacao", sem nenhum bloco agendado, ativo ou pendente, e cujo
  último dia já passou. O encerrado_em é o fim real da estadia: o dia seguinte ao último dia, 00h de Brasília. Antes, o
  ciclo só fechava o contrato quando ele próprio encerrava o bloco, e o contrato ficava "Em vigência" para sempre.
  O t182 já prova o caminho em que o bloco ainda está "ativo" e o próprio ciclo o encerra; esta spec prova o caso do E627.
  O ciclo é chamado pela chave de serviço (rpc avancar_ciclo_blocos), como o app faz ao abrir Contratos (0070).
    1. Bloco já "encerrado", com o último dia ontem → o contrato passa a "encerrado_sem_renovacao", com encerrado_em =
       hoje 00h de Brasília.
    2. Bloco já "encerrado", com o último dia HOJE → o contrato segue "ativo" (o dia ainda não passou).
  Nota: um bloco "encerrado_sem_renovacao" é fechado pelo passo (d) da 0063 sem olhar para a data (é o estado que o passo
  (c) dá ao bloco DEPOIS do último dia), por isso a regra do último dia prova-se com o bloco "encerrado" do caminho manual.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const ids: Record<string, string> = {};
const hojeBRT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const somar = (d: string, n: number) => new Date(Date.parse(d) + n * 86_400_000).toISOString().slice(0, 10);

// Contas por teste: os testes do arquivo correm em paralelo (fullyParallel).
async function conta(quem: string, nome: string, role: "owner" | "tenant") {
  const id = await criarConta({ email: `${quem}.t2148.${sufixo}@lab.vivanomads.test`, nome, role }, senha);
  ids[`pessoa_${quem}`] = id;
  await adm().from("profiles").update({ is_teste: true }).eq("id", id);
  return id;
}

/** Contrato "ativo", assinado, com um bloco já encerrado (`statusBloco`) que termina em `fim`. */
async function contratoComBlocoEncerrado(chave: string, fim: string, statusBloco: "encerrado" | "encerrado_sem_renovacao" = "encerrado"): Promise<string> {
  const dono = await conta(`dono${chave}`, "Xênia Dona", "owner");
  const inq = await conta(`inq${chave}`, "Yuri Morador", "tenant");
  const imovel = await criarImovelPronto(dono, `Apto do ciclo ${chave} ${sufixo}`, { ativo: true, preco: 3200 });
  const lead = await criarLead(dono, inq, imovel, true);
  const agora = new Date().toISOString();
  const { data: c, error } = await adm()
    .from("contratos")
    .insert({ property_id: imovel, tenant_id: inq, lead_id: lead, owner_plan: "essential", faixa: "media_estadia", prazo_total_dias: 60, aluguel_mensal: 3200, tamanho_bloco_meses: 2, comissao_percent: 0.08, comissao_valor: 512, qtd_ocupantes: 1, capacidade_snapshot: 2, status: "ativo", garantia: "caucao", assinado_proprietario_em: agora, assinado_inquilino_em: agora })
    .select("id")
    .single();
  if (error) throw error;
  const { error: e1 } = await adm().from("contrato_blocos").insert({ contrato_id: c.id, numero_bloco: 1, inicio: somar(fim, -59), fim, meses: 2, valor: 6400, caucao: 3200, status: statusBloco, aceite_proprietario_em: agora, aceite_inquilino_em: agora });
  if (e1) throw e1;
  ids[`contrato_${chave}`] = c.id as string;
  return c.id as string;
}

const lerContrato = async (id: string) =>
  (await adm().from("contratos").select("status, encerrado_em").eq("id", id).single()).data as { status: string; encerrado_em: string | null } | null;

test.describe("T2148 — E627: o ciclo fecha o contrato cujo bloco já estava encerrado @E627", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (chave de serviço e banco local).");
  test.describe.configure({ mode: "default", timeout: 120_000 });

  test.afterAll(async () => {
    for (const k of Object.keys(ids).filter((k) => k.startsWith("contrato_"))) {
      await adm().from("contrato_eventos").delete().eq("contrato_id", ids[k]);
      await adm().from("contrato_blocos").delete().eq("contrato_id", ids[k]);
      await adm().from("contratos").delete().eq("id", ids[k]);
    }
    const pessoas = Object.keys(ids).filter((k) => k.startsWith("pessoa_")).map((k) => ids[k]);
    for (const p of pessoas) await adm().from("leads").delete().eq("owner_id", p);
    await apagarContas(pessoas);
  });

  test("1. bloco já 'encerrado' com o último dia ontem: o ciclo encerra o contrato, com encerrado_em hoje 00h de Brasília", async () => {
    const hoje = hojeBRT();
    const id = await contratoComBlocoEncerrado("ontem", somar(hoje, -1));
    expect((await lerContrato(id))?.status, "antes do ciclo, o contrato está ativo").toBe("ativo");
    const { error } = await adm().rpc("avancar_ciclo_blocos");
    expect(error, "o ciclo diário corre").toBeNull();
    const depois = await lerContrato(id);
    expect(depois?.status, "o contrato cujos blocos acabaram fica encerrado").toBe("encerrado_sem_renovacao");
    // O fim real da estadia: o dia seguinte ao último dia (hoje), às 00h de Brasília (03:00 UTC).
    expect(depois?.encerrado_em && new Date(depois.encerrado_em).toISOString(), "encerrado_em no fim real da estadia").toBe(new Date(`${hoje}T03:00:00Z`).toISOString());
  });

  test("2. bloco já 'encerrado' com o último dia HOJE: o contrato segue ativo (o dia ainda não passou)", async () => {
    const id = await contratoComBlocoEncerrado("hoje", hojeBRT());
    const { error } = await adm().rpc("avancar_ciclo_blocos");
    expect(error, "o ciclo diário corre").toBeNull();
    const depois = await lerContrato(id);
    expect(depois?.status, "o contrato só fecha depois do último dia").toBe("ativo");
    expect(depois?.encerrado_em ?? null).toBeNull();
  });
});
