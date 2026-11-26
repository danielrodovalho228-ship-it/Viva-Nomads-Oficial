import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { devolverAVezDaRotinaDaVistoria, pegarAVezDaRotinaDaVistoria } from "../fixtures/vez-da-rotina-da-vistoria";

/*
  T1778 — E1182 @E1182 (ORDENS-DUET 791, 794 e 796; item da Central). A rotina do laudo gravava o item na fila da equipe
  sem olhar o erro: quando o banco recusou, marcou o pedido, não gravou o item e não disse nada.
  A cura: cada gravação é lida. A rotina passa a dizer na resposta quantas gravações falharam (`laudos.falhasNaFila`) e
  responde `ok: false` se alguma falhou; item que já existia não é falha, não duplica e não desfaz a marca.
  Massa própria, só contas de teste; a rotina corre num 2º servidor do mesmo build (porta própria).
   1. Um laudo fora do prazo, sem item: a rotina grava o item, marca o pedido e responde `ok: true`, com
      `laudos.falhasNaFila` igual a 0 — o campo existe e é número.
   2. Um laudo fora do prazo cujo item JÁ existe na fila: a rotina não duplica o item, a marca fica, e isso não conta
      como falha.
  A recusa de verdade (o banco a recusar a gravação) não cabe numa spec: pede uma regra no banco. Está na trava de
  unidade e na prova manual descrita no PR.
  Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Cascalho Rico";
const PORTA = 3158;
const SEGREDO = `lab-t1778-${Math.random().toString(36).slice(2)}`;
const MOTIVO = "Laudo não enviado no prazo combinado: 3 dias úteis depois da visita.";
const MOTIVO_ANTIGO = "Item que já estava na fila (t1778).";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1778.${sufixo}@lab.vivanomads.test`, nome: "Dina Gravação", role: "owner" as const };
const ids: Record<string, string> = {};
const ha = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString();
let servidor: ChildProcess | null = null;

type Resposta = { ok?: boolean; laudos?: { atrasados?: number; falhasNaFila?: number } };
async function tique(): Promise<Resposta> {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/vistoria`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const corpo = (await r.json().catch(() => ({}))) as Resposta;
  expect(r.status, JSON.stringify(corpo)).toBe(200);
  return corpo;
}
const itens = async (pedido: string) => {
  const { data, error } = await adm().from("vistoria_fila_admin").select("id, motivo").eq("tipo", "laudo_atrasado").eq("pedido_id", pedido).is("resolvido_em", null);
  if (error) throw error;
  return (data ?? []) as { id: string; motivo: string | null }[];
};
const marca = async (pedido: string) => (await adm().from("vistoria_pedidos").select("laudo_atrasado_em").eq("id", pedido).single()).data?.laudo_atrasado_em as string | null;
/** Um pedido com a visita feita há 20 dias e o prazo combinado de 3 dias úteis: laudo fora do prazo, ainda sem marca. */
async function pedidoAtrasado(chave: string, imovel: string): Promise<string> {
  const { data, error } = await adm()
    .from("vistoria_pedidos")
    .insert({ property_id: imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, teste: true, status: "realizada", agendado_para: ha(20), visita_concluida_em: ha(20), prazo_laudo_dias_uteis: 3 })
    .select("id")
    .single();
  if (error) throw error;
  ids[chave] = data.id as string;
  return ids[chave];
}

test.describe("T1778 — E1182: a gravação na fila da equipe é lida, e a rotina diz quando falha @E1182", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    // A rotina corre sobre o banco inteiro: esta spec só monta a massa quando nenhuma outra spec de rotina está a meio.
    await pegarAVezDaRotinaDaVistoria("t1778");
    ids.dono = await criarConta(dono, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    if (t.error) throw t.error;
    ids.imovelNovo = await criarImovelPronto(ids.dono, `Casa nova t1778 ${sufixo}`, { ativo: true });
    ids.imovelRepetido = await criarImovelPronto(ids.dono, `Casa repetida t1778 ${sufixo}`, { ativo: true });
    await pedidoAtrasado("pedidoNovo", ids.imovelNovo);
    await pedidoAtrasado("pedidoRepetido", ids.imovelRepetido);
    // O segundo pedido já tem o item aberto na fila (como ficaria se a marca se tivesse perdido): o índice único
    // deixa um só item aberto por tipo e pedido.
    const ja = await adm().from("vistoria_fila_admin").insert({ tipo: "laudo_atrasado", pedido_id: ids.pedidoRepetido, motivo: MOTIVO_ANTIGO });
    if (ja.error) throw ja.error;
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const pedidos = [ids.pedidoNovo, ids.pedidoRepetido].filter(Boolean);
    const imoveis = [ids.imovelNovo, ids.imovelRepetido].filter(Boolean);
    if (pedidos.length) {
      await adm().from("vistoria_fila_admin").delete().in("pedido_id", pedidos);
      await adm().from("vistoria_pedidos").delete().in("id", pedidos);
    }
    if (imoveis.length) await adm().from("properties").delete().in("id", imoveis);
    if (ids.dono) {
      await adm().from("emails_teste").delete().eq("usuario_id", ids.dono);
      await adm().from("avisos").delete().eq("usuario_id", ids.dono);
    }
    await apagarContas([ids.dono].filter(Boolean));
    devolverAVezDaRotinaDaVistoria();
  });

  test("1. a rotina grava o item, marca o pedido e diz na resposta que nenhuma gravação falhou", async () => {
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    expect(await itens(ids.pedidoNovo)).toHaveLength(0);
    expect(await marca(ids.pedidoNovo)).toBeNull();

    const log = createWriteStream(`${SAIDA}/t1778-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/vistoria`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);

    const r = await tique();
    // O campo existe e é número: a rotina passou a contar as gravações que o banco recusa.
    expect(typeof r.laudos?.falhasNaFila, JSON.stringify(r)).toBe("number");
    expect(r.laudos?.falhasNaFila, "nenhuma gravação recusada neste tique").toBe(0);
    expect(r.ok, "sem falha, a rotina responde ok").toBe(true);
    expect((await itens(ids.pedidoNovo)).map((i) => i.motivo), "o item do laudo fora do prazo entrou na fila").toEqual([MOTIVO]);
    expect(await marca(ids.pedidoNovo), "o pedido ficou marcado").not.toBeNull();
  });

  test("2. item que já existia na fila: a rotina não duplica, a marca fica, e isso não conta como falha", async () => {
    // O mesmo tique do caso 1 passou por este pedido: o item antigo continua a ser o único.
    const depois = await itens(ids.pedidoRepetido);
    expect(depois.map((i) => i.motivo), "um item só, e é o que já lá estava").toEqual([MOTIVO_ANTIGO]);
    expect(await marca(ids.pedidoRepetido), "a marca fica: o item existe").not.toBeNull();
    // Um segundo tique não muda nada, e continua a não ser falha.
    const r = await tique();
    expect(r.laudos?.falhasNaFila).toBe(0);
    expect(r.ok).toBe(true);
    expect(await itens(ids.pedidoRepetido)).toHaveLength(1);
    expect(await itens(ids.pedidoNovo)).toHaveLength(1);
  });
});
