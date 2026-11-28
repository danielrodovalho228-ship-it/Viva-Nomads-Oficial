/*
  E1238 (ORDENS-DUET 1207, 1231 e 1233) — a janela de 48 h da conferência, do lado do servidor.
  - A âncora é a hora das INSTRUÇÕES DE ENTRADA do contrato (contratos_checkin.horario); a coluna do anúncio
    (properties.checkin_after / checkout_before) não entra no prazo. A hora de saída das instruções é o E1240: até lá,
    a saída usa o padrão (23:59 do dia da saída, conferencia.ts).
  - ORDEM-DUET 1269 (o coordenador): a conferência nasce a qualquer momento, mas com prazo_em NULO (abrirConferencia,
    nos quatro pontos de abertura de conferencia-actions.ts). O prazo CONGELA NO MOMENTO DA ENTRADA (ou da saída):
    quando agora passa a âncora calculada com a hora vigente e prazo_em está nulo, grava-se o prazo daquele momento
    (update … where prazo_em is null and fechada_em is null). Quem o faz é a rotina (congelarAbertasNaAncora, na
    automacoes) e a primeira leitura depois da âncora (janelaVigente) — o que vier primeiro. Até lá, o prazo acompanha a
    hora vigente das instruções: o dono costuma preenchê-las depois de assinar.
  - A leitura: com prazo_em gravado, vale o gravado; sem ele, o cálculo vivo pela hora actual (prazoDaJanela).
  contratos_checkin é só do service_role: as leituras usam o cliente admin que o chamador passa.
*/
import { ancoraConferencia, prazoACongelar, type EntradaDoContrato, type TipoConferencia } from "../conferencia.ts";

// O cliente admin do Supabase (só o que se usa aqui).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (tabela: string) => any };

export interface JanelaDoContrato {
  /** "14:00" das instruções de entrada; null = sem hora gravada (a entrada conta das 23:59). */
  hora: string | null;
  /** O prazo gravado de cada conferência (ISO); null = ainda não congelado (antes da âncora), ou sem conferência. */
  gravado: { entrada: string | null; saida: string | null };
  /** Há conferência ABERTA (nascida e não fechada) de cada tipo — só essas recebem o prazo no congelamento. */
  aberta: { entrada: boolean; saida: boolean };
}

/** As datas da janela: o 1.º início e o último fim dos blocos aceites, e a hora das instruções. */
export function datasDaJanela(blocos: { inicio: string | null; fim: string | null; status?: string | null }[], hora: string | null): EntradaDoContrato {
  const aceites = blocos.filter((b) => b.status !== "nao_aceito");
  const inicios = aceites.map((b) => b.inicio).filter((x): x is string => !!x).sort();
  const fins = aceites.map((b) => b.fim).filter((x): x is string => !!x).sort();
  return { inicio: inicios[0] ?? null, checkinAfter: hora, fim: fins.at(-1) ?? null, checkoutBefore: null };
}

/** A hora das instruções e os prazos gravados, por contrato (uma leitura de cada tabela para a lista toda). */
export async function janelasDosContratos(admin: Admin, ids: string[]): Promise<Map<string, JanelaDoContrato>> {
  const m = new Map<string, JanelaDoContrato>(ids.map((id) => [id, { hora: null, gravado: { entrada: null, saida: null }, aberta: { entrada: false, saida: false } }]));
  if (ids.length === 0) return m;
  const [{ data: k }, { data: confs }] = await Promise.all([
    admin.from("contratos_checkin").select("contrato_id, horario").in("contrato_id", ids),
    admin.from("conferencias").select("contrato_id, tipo, prazo_em, fechada_em").in("contrato_id", ids),
  ]);
  for (const r of (k ?? []) as { contrato_id: string; horario: string | null }[]) {
    const j = m.get(r.contrato_id);
    if (j) j.hora = r.horario ?? null;
  }
  for (const r of (confs ?? []) as { contrato_id: string; tipo: string; prazo_em: string | null; fechada_em: string | null }[]) {
    const j = m.get(r.contrato_id);
    if (!j || (r.tipo !== "entrada" && r.tipo !== "saida")) continue;
    j.gravado[r.tipo] = r.prazo_em ?? null;
    j.aberta[r.tipo] = !r.fechada_em;
  }
  return m;
}

/** A janela de UM contrato. */
export async function janelaDoContrato(admin: Admin, contratoId: string): Promise<JanelaDoContrato> {
  return (await janelasDosContratos(admin, [contratoId])).get(contratoId)!;
}

/**
 * Abre a conferência (se ainda não existir), SEM prazo (ORDEM-DUET 1269): a linha nasce com prazo_em nulo, seja quando
 * for; a segunda abertura não muda nada (ignoreDuplicates = on conflict do nothing). Devolve o construtor do upsert,
 * para quem precisa do id encadear `.select("id").maybeSingle()`.
 */
export function abrirConferencia(admin: Admin, p: { contratoId: string; tipo: TipoConferencia; abertaPor: string }) {
  return admin.from("conferencias").upsert({ contrato_id: p.contratoId, tipo: p.tipo, aberta_por: p.abertaPor }, { onConflict: "contrato_id,tipo", ignoreDuplicates: true });
}

/**
 * CONGELA o prazo de uma conferência aberta no momento da entrada (ou da saída): se ainda não há prazo gravado e agora
 * já passou a âncora vigente, grava o prazo daquele momento — update … where prazo_em is null and fechada_em is null, o
 * que torna a escrita única mesmo com a rotina e uma leitura ao mesmo tempo. Devolve o prazo que vale gravado (o
 * escrito agora, o de quem chegou primeiro, ou null se ainda não é a hora).
 */
export async function congelarNaAncora(admin: Admin, p: { contratoId: string; tipo: TipoConferencia; datas: EntradaDoContrato; gravado: string | null; agora: Date }): Promise<string | null> {
  if (p.gravado) return p.gravado;
  const prazo = prazoACongelar(p.tipo, p.datas, null, p.agora);
  if (!prazo) return null;
  await admin.from("conferencias").update({ prazo_em: prazo.toISOString() }).eq("contrato_id", p.contratoId).eq("tipo", p.tipo).is("prazo_em", null).is("fechada_em", null);
  const { data } = await admin.from("conferencias").select("prazo_em").eq("contrato_id", p.contratoId).eq("tipo", p.tipo).maybeSingle();
  return (data as { prazo_em: string | null } | null)?.prazo_em ?? null;
}

/**
 * A janela VIGENTE de um contrato para quem a lê: a hora das instruções, as datas e o prazo gravado de cada
 * conferência — e, sendo a primeira leitura depois da âncora, congela o prazo das abertas que ainda não o têm.
 */
export async function janelaVigente(
  admin: Admin,
  contratoId: string,
  blocos: { inicio: string | null; fim: string | null; status?: string | null }[],
  agora: Date = new Date(),
): Promise<JanelaDoContrato & { datas: EntradaDoContrato }> {
  const janela = await janelaDoContrato(admin, contratoId);
  const datas = datasDaJanela(blocos, janela.hora);
  for (const tipo of ["entrada", "saida"] as const) {
    if (janela.aberta[tipo]) janela.gravado[tipo] = await congelarNaAncora(admin, { contratoId, tipo, datas, gravado: janela.gravado[tipo], agora });
  }
  return { ...janela, datas };
}

/**
 * A rotina (automacoes): congela, de uma vez, o prazo das conferências abertas que já passaram a âncora. Devolve o
 * prazo que vale gravado por `contrato_id:tipo` — o mapa com que a rotina decide o que fechar.
 */
export async function congelarAbertasNaAncora(
  admin: Admin,
  linhas: { contrato_id: string; tipo: TipoConferencia; prazo_em: string | null; datas: EntradaDoContrato }[],
  agora: Date,
): Promise<Map<string, string | null>> {
  const m = new Map<string, string | null>();
  for (const l of linhas) {
    m.set(`${l.contrato_id}:${l.tipo}`, await congelarNaAncora(admin, { contratoId: l.contrato_id, tipo: l.tipo, datas: l.datas, gravado: l.prazo_em, agora }));
  }
  return m;
}

/** E1238 (ORDEM-DUET 1276, palavras do coordenador): a recusa de mudar a hora de entrada depois da entrada. */
export const MSG_HORA_DE_ENTRADA_BLOQUEADA = "A entrada já aconteceu; o horário não pode mais ser alterado.";

/**
 * E1238 (ORDEM-DUET 1276): a hora de entrada das instruções fica BLOQUEADA depois da âncora de entrada vigente (a hora
 * gravada, ou 23:59 sem hora). Sem conferência aberta, o prazo é o cálculo vivo — e mudar a hora depois de o morador
 * entrar encurtaria (ou alargaria) a janela; com a hora fixa, o cálculo vivo fica tão fixo quanto o congelado. Manter a
 * mesma hora não é mudança: as instruções e o plantão seguem editáveis. (A hora de saída, quando existir — E1240 —,
 * segue a mesma regra com a âncora da saída.)
 */
export function horaDeEntradaBloqueada(p: {
  blocos: { inicio: string | null; fim: string | null; status?: string | null }[];
  horaAtual: string | null;
  horaNova: string | null;
  agora: Date;
}): boolean {
  const atual = (p.horaAtual ?? "").trim();
  if (atual === (p.horaNova ?? "").trim()) return false;
  const ancora = ancoraConferencia("entrada", datasDaJanela(p.blocos, atual || null));
  return !!ancora && p.agora.getTime() >= ancora.getTime();
}

/** E1238 (ORDEM-DUET 1284, palavras do coordenador): a hora nova que já passou. */
export const MSG_HORA_DE_ENTRADA_NO_PASSADO = "Esse horário de entrada já passou; informe um horário a partir de agora.";

/**
 * E1238 (ORDEM-DUET 1284) — a regra da âncora é UMA SÓ: "Nenhuma edição de horário pode pôr a âncora no passado. O
 * servidor só aceita uma hora nova se a âncora que ela produz for igual ou posterior a agora." Devolve a recusa, ou null:
 *  1. a mesma hora não é mudança → null;
 *  2. a âncora vigente já passou (a entrada aconteceu) → MSG_HORA_DE_ENTRADA_BLOQUEADA;
 *  3. a âncora que a hora nova produz fica antes de agora → MSG_HORA_DE_ENTRADA_NO_PASSADO;
 *  4. senão (hora nova no futuro, ou igual a agora) → null, e o prazo acompanha.
 * (A hora de saída, quando existir — E1240 —, segue a mesma regra com a âncora da saída.)
 */
export function recusaDaHoraDeEntrada(p: {
  blocos: { inicio: string | null; fim: string | null; status?: string | null }[];
  horaAtual: string | null;
  horaNova: string | null;
  agora: Date;
}): string | null {
  const nova = (p.horaNova ?? "").trim();
  if ((p.horaAtual ?? "").trim() === nova) return null;
  if (horaDeEntradaBloqueada(p)) return MSG_HORA_DE_ENTRADA_BLOQUEADA;
  const ancoraNova = ancoraConferencia("entrada", datasDaJanela(p.blocos, nova || null));
  if (ancoraNova && ancoraNova.getTime() < p.agora.getTime()) return MSG_HORA_DE_ENTRADA_NO_PASSADO;
  return null;
}
