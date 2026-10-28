import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { blocoDados } from "@/lib/notifications/modelo-email";
import { escaparHtml } from "@/lib/escapar-html";
import { hojeEmBrasilia } from "@/lib/checkin";
import { HREF_ESTADIA } from "./estadia";
import { chaveLembreteBloco, emailLembreteBloco, precisaLembreteDoBloco, type BlocoParaLembrete } from "./lembrete-bloco";

/*
  E205-B2 — envio do lembrete do bloco renovado ainda não pago. Duas portas, a mesma regra:
    • o cron de automações (todos os contratos ativos);
    • o aceite da renovação (renovarBloco e o aditivo assinado), para a renovação aceita a menos de 3 dias do início.
  Só ao morador, sem push. Uma vez por (contrato, bloco): grava a chave antes de enviar.
*/

type Admin = SupabaseClient;

interface LinhaContrato {
  id: string;
  tenant_id: string;
  aluguel_mensal: number | string | null;
  properties: { title: string | null } | null;
  contrato_blocos: { id: string; numero_bloco: number; inicio: string; fim: string; meses: number; valor: number | string; status: string; aceite_proprietario_em: string | null; aceite_inquilino_em: string | null }[] | null;
  pagamentos_bloco: { bloco_id: string | null; anulado_em: string | null }[] | null;
}

const COLUNAS =
  "id, tenant_id, aluguel_mensal, properties(title), contrato_blocos(id, numero_bloco, inicio, fim, meses, valor, status, aceite_proprietario_em, aceite_inquilino_em), pagamentos_bloco(bloco_id, anulado_em)";

/** Os blocos de um contrato que precisam do lembrete hoje. */
function pendentes(c: LinhaContrato, hoje: string): BlocoParaLembrete[] {
  const pagos = new Map<string, number>();
  for (const p of c.pagamentos_bloco ?? []) if (p.bloco_id && !p.anulado_em) pagos.set(p.bloco_id, (pagos.get(p.bloco_id) ?? 0) + 1);
  return (c.contrato_blocos ?? [])
    .map((b) => ({
      id: b.id,
      b: {
        numero: Number(b.numero_bloco),
        inicio: b.inicio,
        fim: b.fim,
        meses: Number(b.meses),
        valor: Number(b.valor),
        status: b.status,
        aceiteProprietario: b.aceite_proprietario_em,
        aceiteInquilino: b.aceite_inquilino_em,
      },
    }))
    .filter((x) => precisaLembreteDoBloco(x.b, hoje, pagos.get(x.id) ?? 0))
    .map((x) => x.b);
}

async function enviar(admin: Admin, c: LinhaContrato, b: BlocoParaLembrete): Promise<boolean> {
  const { data: p } = await admin.from("profiles").select("email, full_name, notif_email, pausada_em").eq("id", c.tenant_id).maybeSingle();
  const perfil = p as { email: string | null; full_name: string | null; notif_email: boolean | null; pausada_em: string | null } | null;
  if (!perfil?.email || perfil.notif_email === false || perfil.pausada_em) return false;
  // Marca ANTES de enviar: chave repetida = já saiu.
  const { error } = await admin.from("automacoes_envios").insert({ chave: chaveLembreteBloco(c.id, b.numero), tipo: "bloco_inicio_lembrete", usuario_id: c.tenant_id });
  if (error) return false;
  const e = emailLembreteBloco(b, { imovel: c.properties?.title, valorMensal: c.aluguel_mensal == null ? null : Number(c.aluguel_mensal) });
  await notify({
    event: "bloco_inicio_lembrete",
    email: perfil.email,
    name: perfil.full_name ?? undefined,
    userId: c.tenant_id,
    pushUrl: HREF_ESTADIA(c.id),
    subject: e.assunto,
    body: e.abertura,
    ctaLabel: e.cta,
    semPush: true,
    detailsHtml: blocoDados(e.linhas.map((l) => ({ rotulo: escaparHtml(l.rotulo), valor: escaparHtml(l.valor) }))) + `<p>${escaparHtml(e.rodape)}</p>`,
    detailsText: [...e.linhas.map((l) => `${l.rotulo}: ${l.valor}`), e.rodape].join("\n"),
  }).catch(() => null);
  return true;
}

/** Cron: todos os contratos ativos. `simular`: só conta (não marca nem envia). */
export async function lembretesDeBloco(admin: Admin, agora: Date, simular: boolean): Promise<number> {
  const hoje = hojeEmBrasilia(agora);
  const { data } = await admin.from("contratos").select(COLUNAS).eq("status", "ativo").limit(1000);
  let n = 0;
  for (const c of (data ?? []) as unknown as LinhaContrato[]) {
    for (const b of pendentes(c, hoje)) {
      if (simular) n += 1;
      else if (await enviar(admin, c, b)) n += 1;
    }
  }
  return n;
}

/** No aceite da renovação: o mesmo lembrete, se o bloco já começa em até 3 dias. Best-effort. */
export async function lembreteDeBlocoNoAceite(admin: Admin, contratoId: string, agora: Date = new Date()): Promise<number> {
  try {
    const { data } = await admin.from("contratos").select(COLUNAS).eq("id", contratoId).eq("status", "ativo").maybeSingle();
    if (!data) return 0;
    const c = data as unknown as LinhaContrato;
    let n = 0;
    for (const b of pendentes(c, hojeEmBrasilia(agora))) if (await enviar(admin, c, b)) n += 1;
    return n;
  } catch {
    return 0;
  }
}
