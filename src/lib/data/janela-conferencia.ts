/*
  E1238 (ORDENS-DUET 1207, 1231 e 1233) — a janela de 48 h da conferência, do lado do servidor.
  - A âncora é a hora das INSTRUÇÕES DE ENTRADA do contrato (contratos_checkin.horario); a coluna do anúncio
    (properties.checkin_after / checkout_before) não entra no prazo. A hora de saída das instruções é o E1240: até lá,
    a saída usa o padrão (23:59 do dia da saída, conferencia.ts).
  - congelarJanelaDeConferencia grava o prazo quando a linha da conferência NASCE (o upsert com ignoreDuplicates das
    quatro ações de conferencia-actions.ts): editar a hora depois não mexe num prazo já aberto.
  - A leitura: com a conferência aberta, o prazo gravado; sem ela, calcula pela mesma regra (prazoDaJanela).
  contratos_checkin é só do service_role: as leituras usam o cliente admin que o chamador passa.
*/
import { prazoConferencia, type EntradaDoContrato, type TipoConferencia } from "../conferencia.ts";

// O cliente admin do Supabase (só o que se usa aqui).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = { from: (tabela: string) => any };

export interface JanelaDoContrato {
  /** "14:00" das instruções de entrada; null = sem hora gravada (a entrada conta das 00:00). */
  hora: string | null;
  /** O prazo gravado de cada conferência já aberta (ISO); null = ainda não aberta, ou de antes da 0369. */
  gravado: { entrada: string | null; saida: string | null };
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
  const m = new Map<string, JanelaDoContrato>(ids.map((id) => [id, { hora: null, gravado: { entrada: null, saida: null } }]));
  if (ids.length === 0) return m;
  const [{ data: k }, { data: confs }] = await Promise.all([
    admin.from("contratos_checkin").select("contrato_id, horario").in("contrato_id", ids),
    admin.from("conferencias").select("contrato_id, tipo, prazo_em").in("contrato_id", ids),
  ]);
  for (const r of (k ?? []) as { contrato_id: string; horario: string | null }[]) {
    const j = m.get(r.contrato_id);
    if (j) j.hora = r.horario ?? null;
  }
  for (const r of (confs ?? []) as { contrato_id: string; tipo: string; prazo_em: string | null }[]) {
    const j = m.get(r.contrato_id);
    if (j && (r.tipo === "entrada" || r.tipo === "saida")) j.gravado[r.tipo] = r.prazo_em ?? null;
  }
  return m;
}

/** A janela de UM contrato. */
export async function janelaDoContrato(admin: Admin, contratoId: string): Promise<JanelaDoContrato> {
  return (await janelasDosContratos(admin, [contratoId])).get(contratoId)!;
}

/**
 * Abre a conferência (se ainda não existir) e CONGELA o prazo dela: grava-o só quando a linha nasce — a segunda
 * abertura não muda nada (ignoreDuplicates = on conflict do nothing). Devolve o construtor do upsert, para quem precisa
 * do id encadear `.select("id").maybeSingle()`.
 */
export function congelarJanelaDeConferencia(admin: Admin, p: { contratoId: string; tipo: TipoConferencia; abertaPor: string; datas: EntradaDoContrato }) {
  const prazo = prazoConferencia(p.tipo, p.datas);
  return admin
    .from("conferencias")
    .upsert({ contrato_id: p.contratoId, tipo: p.tipo, aberta_por: p.abertaPor, prazo_em: prazo ? prazo.toISOString() : null }, { onConflict: "contrato_id,tipo", ignoreDuplicates: true });
}
