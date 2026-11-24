import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarAdmin, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { devolverAVezDaRotinaDaVistoria, pegarAVezDaRotinaDaVistoria } from "../fixtures/vez-da-rotina-da-vistoria";

/*
  T1761 — E1149 @E1149 (ORDENS-DUET 638 e 678; linha Parceiros, classe B): o e-mail "Avaliação sem avaliador elegível"
  saía para os admins em CADA tique da rotina (de hora em hora), por cada pedido parado. Passa a sair só quando o item
  da fila do admin é NOVO ou o MOTIVO muda.
  Um pedido de teste numa cidade própria do spec, sem nenhum avaliador. A rotina corre num 2º servidor do mesmo build
  (porta 3154, CRON_SECRET só dele; padrão da t1750) e, por correr sobre o banco inteiro, esta spec pega a vez da rotina.
   1. Primeiro tique: nasce o item do pedido na fila do admin, com o motivo, e o admin recebe o e-mail.
   2. Segundo e terceiro tiques, sem nada ter mudado: o item é o mesmo e NENHUM e-mail novo sai por este pedido.
   3. Um avaliador suspenso passa a atender a cidade: o motivo do item muda e o admin recebe UM e-mail; o tique
      seguinte não repete.
  O e-mail não diz de que pedido é, e o aviso vai para todos os admins. Outras specs correm ao mesmo tempo no portão
  e podem pôr na fila um pedido delas, que também manda e-mail. Por isso a conta de cada tique é um TETO: os e-mails
  novos ao admin não passam do que esta spec provocou (0 ou 1) mais os itens que OUTROS pedidos puseram na fila à
  volta do tique. Sem nada de fora, o teto é exato.
  A caixa de teste só guarda e-mails de contas de teste, e o admin do laboratório não é uma: a spec cria um admin de
  teste só para ela (o aviso vai para todos os admins) e lê a caixa dele.
  Só contas de teste. Laboratório; não é prova ao vivo no site. Sem tela: o defeito é de envio.
*/
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Romaria";
const PORTA = 3154;
const SEGREDO = `lab-t1761-${Math.random().toString(36).slice(2)}`;
const EVENTO = "vistoria_sem_avaliador";
const SEM_NINGUEM = `Nenhum avaliador disponível para o dono escolher em ${CIDADE}. Nenhum avaliador credenciado atende esta cidade.`;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1761.${sufixo}@lab.vivanomads.test`, nome: "Dora Espera", role: "owner" as const };
const suspenso = { email: `aval.t1761.${sufixo}@lab.vivanomads.test`, nome: "Sílvio Suspenso", role: "tenant" as const };
const adminDeTeste = { email: `admin.t1761.${sufixo}@lab.vivanomads.test`, nome: "Ada Admin" };
const ids: Record<string, string> = {};
let numeroDoSuspenso = "";
let servidor: ChildProcess | null = null;

type Item = { id: string; motivo: string | null; resolvido_em: string | null; criado_em: string };
const itensDoPedido = async () =>
  ((await adm().from("vistoria_fila_admin").select("id, motivo, resolvido_em, criado_em").eq("tipo", "sem_avaliador").eq("pedido_id", ids.pedido).order("criado_em")).data ?? []) as Item[];
/** Os e-mails "sem avaliador" gravados para o admin de teste desta spec (a caixa de teste). */
const emailsAoAdmin = async () => {
  const { data, error } = await adm().from("emails_teste").select("id, assunto, criado_em").eq("evento", EVENTO).eq("usuario_id", ids.admin);
  if (error) throw error;
  return (data ?? []) as { id: string; assunto: string; criado_em: string }[];
};
/** Folga para trás: o e-mail de um item de OUTRO pedido pode ser gravado uns segundos depois de o item nascer. */
const FOLGA_MS = 60_000;
/** Quantos itens "sem avaliador" de OUTROS pedidos nasceram na fila desde `desde` (cada um manda um e-mail ao admin). */
const itensDeOutrosDesde = async (desde: string) => {
  const { data, error } = await adm().from("vistoria_fila_admin").select("id").eq("tipo", "sem_avaliador").neq("pedido_id", ids.pedido).gte("criado_em", desde);
  if (error) throw error;
  return (data ?? []).length;
};

async function rodar() {
  const r = await fetch(`http://localhost:${PORTA}/api/cron/vistoria`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  const corpo = (await r.json().catch(() => ({}))) as { ok?: boolean };
  expect(r.status, JSON.stringify(corpo)).toBe(200);
  expect(corpo.ok).toBe(true);
}
/**
 * Um tique da rotina e a conta dele: quantos e-mails novos saíram para o admin de teste, e quantos itens de OUTROS
 * pedidos nasceram na fila à volta do tique (o que pode ter mandado e-mail sem ser por esta spec).
 * O envio é feito dentro do pedido da rotina (não fica para depois): quando ela responde, os e-mails já estão gravados.
 */
async function tique() {
  const antes = new Set((await emailsAoAdmin()).map((e) => e.id));
  const desde = new Date(Date.now() - FOLGA_MS).toISOString();
  await rodar();
  const novos = (await emailsAoAdmin()).filter((e) => !antes.has(e.id));
  return { emailsNovos: novos.length, deOutros: await itensDeOutrosDesde(desde), assuntos: novos.map((e) => e.assunto) };
}

test.describe("T1761 — E1149: o e-mail 'sem avaliador' sai uma vez por item, e de novo só quando o motivo muda @E1149", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    // A rotina corre sobre o banco inteiro: esta spec só monta a massa quando nenhuma outra spec de rotina está a meio.
    await pegarAVezDaRotinaDaVistoria("t1761");
    ids.admin = await criarAdmin(adminDeTeste.email, adminDeTeste.nome, senha);
    for (const [k, c] of [["dono", dono], ["suspenso", suspenso]] as const) ids[k] = await criarConta(c, senha);
    const t = await adm().from("profiles").update({ is_teste: true }).in("id", [ids.admin, ids.dono, ids.suspenso]);
    if (t.error) throw t.error;
    ids.imovel = await criarImovelPronto(ids.dono, `Lar sem avaliador ${sufixo}`, { ativo: true });
    const cid = await adm().from("properties").update({ city: CIDADE }).eq("id", ids.imovel);
    if (cid.error) throw cid.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: porte === "q1_2" ? 350 : 300 })));
    if (eT) throw eT;
    // O pedido parado, como a criação o deixa quando não há ninguém para escolher; ainda sem item na fila do admin.
    const { data: ped, error: ePed } = await adm()
      .from("vistoria_pedidos")
      .insert({ property_id: ids.imovel, owner_id: ids.dono, cidade: CIDADE, porte: "q1_2", valor_tabela: 350, status: "pedido", teste: true, aguardando_avaliador: true })
      .select("id")
      .single();
    if (ePed) throw ePed;
    ids.pedido = ped.id as string;

    const log = createWriteStream(`${SAIDA}/t1761-servidor-cron.log`);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, CRON_SECRET: SEGREDO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`http://localhost:${PORTA}/api/cron/vistoria`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(401);
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    if (ids.admin) await adm().from("emails_teste").delete().eq("usuario_id", ids.admin);
    if (ids.pedido) {
      await adm().from("vistoria_fila_admin").delete().eq("pedido_id", ids.pedido);
      await adm().from("vistoria_designacoes").delete().eq("pedido_id", ids.pedido);
    }
    if (ids.imovel) await adm().from("vistoria_pedidos").delete().eq("property_id", ids.imovel);
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    if (ids.cred) await adm().from("avaliadores_credenciamento").delete().eq("id", ids.cred);
    if (ids.parc) await adm().from("parceiros").delete().eq("id", ids.parc);
    if (ids.imovel) await adm().from("properties").delete().eq("id", ids.imovel);
    await apagarContas([ids.admin, ids.dono, ids.suspenso].filter(Boolean));
    devolverAVezDaRotinaDaVistoria();
  });

  test("1. primeiro tique: nasce o item do pedido, com o motivo, e o admin recebe o e-mail", async () => {
    expect((await adm().from("profiles").select("role, is_teste").eq("id", ids.admin).single()).data, "a massa: o admin de teste").toEqual({ role: "admin", is_teste: true });
    expect(await itensDoPedido(), "a massa: ainda sem item na fila").toHaveLength(0);
    const t = await tique();
    const itens = await itensDoPedido();
    expect(itens).toHaveLength(1);
    expect(itens[0].resolvido_em).toBeNull();
    expect(itens[0].motivo).toBe(SEM_NINGUEM);
    ids.item = itens[0].id;
    // O item novo deste pedido manda o e-mail ao admin.
    expect(t.emailsNovos, "o item novo manda o e-mail").toBeGreaterThanOrEqual(1);
    expect(t.emailsNovos, "e um só por este pedido").toBeLessThanOrEqual(1 + t.deOutros);
    expect(t.assuntos[0]).toMatch(/^Avaliação sem avaliador elegível/);
    expect((await adm().from("vistoria_pedidos").select("status, aguardando_avaliador").eq("id", ids.pedido).single()).data).toEqual({ status: "pedido", aguardando_avaliador: true });
  });

  test("2. segundo e terceiro tiques, sem nada ter mudado: o mesmo item, nenhum e-mail novo por este pedido", async () => {
    for (const n of [2, 3]) {
      const t = await tique();
      const itens = await itensDoPedido();
      expect(itens, `tique ${n}: um item só`).toHaveLength(1);
      expect(itens[0].id, `tique ${n}: o mesmo item`).toBe(ids.item);
      expect(itens[0].motivo).toBe(SEM_NINGUEM);
      // O pedido parado não repete: só pode ter saído e-mail por item de OUTRO pedido que nasceu à volta do tique.
      expect(t.emailsNovos, `tique ${n}: o pedido parado não manda outro e-mail`).toBeLessThanOrEqual(t.deOutros);
    }
  });

  test("3. o motivo muda (um avaliador suspenso passa a atender a cidade): UM e-mail; o tique seguinte não repete", async () => {
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.suspenso, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: suspenso.nome, slug: `aval-t1761-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    numeroDoSuspenso = n as string;
    const { data: cred, error: eC } = await adm()
      .from("avaliadores_credenciamento")
      .insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: numeroDoSuspenso, status: "suspenso", experiencia_link: "https://portfolio.lab.vivanomads.test/t1761", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" })
      .select("id")
      .single();
    if (eC) throw eC;
    ids.cred = cred.id as string;

    const t = await tique();
    const itens = await itensDoPedido();
    expect(itens).toHaveLength(1);
    expect(itens[0].id, "o mesmo item, com o motivo novo").toBe(ids.item);
    expect(itens[0].motivo).toContain(`Avaliador nº ${numeroDoSuspenso}:`);
    expect(itens[0].motivo).not.toBe(SEM_NINGUEM);
    // A mudança de motivo deste pedido manda um e-mail — um só.
    expect(t.emailsNovos, "o motivo mudou: sai o e-mail").toBeGreaterThanOrEqual(1);
    expect(t.emailsNovos, "e um só por este pedido").toBeLessThanOrEqual(1 + t.deOutros);

    const motivoNovo = itens[0].motivo;
    const depois = await tique();
    expect((await itensDoPedido())[0].motivo).toBe(motivoNovo);
    expect(depois.emailsNovos, "com o motivo novo já gravado, a rotina não repete").toBeLessThanOrEqual(depois.deOutros);
  });
});
