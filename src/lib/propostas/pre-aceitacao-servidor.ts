import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notifications";
import { ASSUNTOS } from "@/lib/notifications/assuntos";
import { PRE_ACEITACAO_72H_ATIVA } from "@/lib/flags";
import { conflitoNoImovel } from "@/lib/data/periodo-servidor";
import { periodoEmDias } from "@/lib/contrato-periodo";
import { diasDosTermos } from "./regras";
import { COLUNAS_VERSAO, termosDaLinha, type LinhaVersao } from "@/lib/data/propostas-servidor";
import { encerraNaExpiracao, lembretesDaPreAceitacao, linhaDeContexto, PRAZO_PRE_ACEITACAO_HORAS, prazoDoDono, reabrirPreAceitacao, textoDoPrazo, TEXTO_ENCERRADA, TEXTO_ENCERRADA_DONO, TEXTO_JANELA_TERMINOU, TEXTO_PERDEU_A_VEZ, TEXTO_PERDEU_A_VEZ_DONO, TEXTO_REGRA_CORRIDA, TEXTO_SEM_PUNICAO } from "./pre-aceitacao";

/*
  E722 — roda a pré-aceitação de 72 h. ATRÁS DA CHAVE PRE_ACEITACAO_72H_ATIVA (desligada): sem ela, não faz nada.
    • lembretes de 24 h e 6 h antes do fim (uma vez cada; nunca no silêncio de 22h às 7h, pela regra pura);
    • vencida sem contrato: a proposta expira SEM punição (status "expirada" + pre_aceitacao_expirou_em), avisa os dois; a candidatura volta ao dono com o
      relógio dele (1 dia útil, recomeça a cada volta). A 3ª expiração (depois de 2 reaberturas) ENCERRA a candidatura e avisa o morador;
    • perdeu a corrida: expira com a mensagem clara e NADA volta sozinho para a fila; só o dono reabre, à mão.
  Nada aqui recalcula taxa: taxa_congelada nunca é escrita por este arquivo.
*/
export interface ResumoPreAceitacao {
  ativa: boolean;
  lembretes: number;
  expiradas: number;
  /** Pré-aceites que perderam a corrida (outro concluiu o contrato antes). */
  perderamAVez: number;
  /** Candidaturas encerradas na 3ª expiração (já contadas em `expiradas`). */
  encerradas: number;
}

interface Linha {
  id: string;
  numero: string;
  owner_id: string;
  tenant_id: string;
  lead_id: string;
  property_id: string;
  versao_atual: number;
  aceita_em: string | null;
  pre_aceitacao_reaberturas: number | null;
  pre_aceitacao_ate: string;
  pre_aceitacao_lembrete_24h_em: string | null;
  pre_aceitacao_lembrete_6h_em: string | null;
  properties: { title?: string | null } | null;
}

/** `textoDono` diferente do `texto`: o dono recebe a versão dele (ex.: a candidatura voltou para a fila dele). */
async function avisarOsDois(admin: SupabaseClient, l: Linha, assunto: string, texto: string, textoDono?: string) {
  const imovel = l.properties?.title ?? "o imóvel";
  for (const [uid, href, corpo] of [[l.tenant_id, `/dashboard/propostas/${l.id}`, texto], [l.owner_id, `/dashboard/propostas/${l.id}`, textoDono ?? texto]] as const) {
    const { data } = await admin.from("profiles").select("email, full_name").eq("id", uid).maybeSingle();
    const pf = data as { email?: string | null; full_name?: string | null } | null;
    if (!pf?.email) continue;
    await notify({
      event: "contract_status", email: pf.email, name: pf.full_name ?? undefined, userId: uid, pushUrl: href, subject: assunto, ctaLabel: "Ver a proposta",
      body: (n) => `Olá${n ? " " + n : ""}, ${corpo} (${imovel}, proposta ${l.numero}).`,
    });
  }
}

/** Há um contrato ativo de outra pessoa nas datas desta proposta? (o mesmo cálculo de datas do aceite). Falha de leitura NÃO conta como perda. */
async function perdeuACorrida(admin: SupabaseClient, l: Pick<Linha, "id" | "versao_atual" | "property_id">): Promise<boolean> {
  const { data, error } = await admin.from("proposta_versoes").select(COLUNAS_VERSAO).eq("proposta_id", l.id).eq("versao", l.versao_atual).maybeSingle();
  if (error || !data) return false;
  const v = data as unknown as LinhaVersao;
  const periodo = periodoEmDias(String(v.data_entrada).slice(0, 10), diasDosTermos(termosDaLinha(v)));
  const conflito = await conflitoNoImovel(admin, l.property_id, periodo).catch(() => null);
  // MSG_DATAS_SEM_CONFERIR (não conseguiu ler) também é string: só vale como perda a mensagem de conflito real.
  return !!conflito && !conflito.startsWith("Não foi possível");
}

/** Data de entrada da versão vigente (para o teto do relógio do dono); null se não deu para ler. */
async function dataEntradaDa(admin: SupabaseClient, l: Pick<Linha, "id" | "versao_atual">): Promise<string | null> {
  const { data } = await admin.from("proposta_versoes").select("data_entrada").eq("proposta_id", l.id).eq("versao", l.versao_atual).maybeSingle();
  const d = (data as { data_entrada?: string } | null)?.data_entrada;
  return d ? String(d).slice(0, 10) : null;
}

export async function rodarPreAceitacao(admin: SupabaseClient, agora: Date = new Date()): Promise<ResumoPreAceitacao> {
  if (!PRE_ACEITACAO_72H_ATIVA) return { ativa: false, lembretes: 0, expiradas: 0, perderamAVez: 0, encerradas: 0 };
  const resumo: ResumoPreAceitacao = { ativa: true, lembretes: 0, expiradas: 0, perderamAVez: 0, encerradas: 0 };
  const { data, error } = await admin
    .from("propostas")
    .select("id, numero, owner_id, tenant_id, lead_id, property_id, versao_atual, aceita_em, pre_aceitacao_reaberturas, pre_aceitacao_ate, pre_aceitacao_lembrete_24h_em, pre_aceitacao_lembrete_6h_em, properties(title)")
    .eq("status", "aceita")
    .not("pre_aceitacao_ate", "is", null);
  if (error || !data) return resumo;
  for (const l of data as unknown as Linha[]) {
    const prazo = new Date(l.pre_aceitacao_ate);
    if (prazo.getTime() <= agora.getTime()) {
      // A 3ª expiração (depois de 2 reaberturas) encerra a candidatura; antes disso ela volta ao dono, com o relógio dele recomeçando.
      const encerra = encerraNaExpiracao(Number(l.pre_aceitacao_reaberturas ?? 0));
      const donoAte = encerra ? null : prazoDoDono(agora, await dataEntradaDa(admin, l));
      const { data: ok } = await admin
        .from("propostas")
        .update({ status: "expirada", pre_aceitacao_expirou_em: agora.toISOString(), pre_aceitacao_encerrada_em: encerra ? agora.toISOString() : null, pre_aceitacao_dono_ate: donoAte?.toISOString() ?? null, atualizada_em: agora.toISOString() })
        .eq("id", l.id)
        .eq("status", "aceita")
        .select("id")
        .maybeSingle();
      if (ok) {
        resumo.expiradas++;
        if (encerra) {
          resumo.encerradas++;
          await avisarOsDois(admin, l, ASSUNTOS.preAceitacaoEncerrada, TEXTO_ENCERRADA, TEXTO_ENCERRADA_DONO);
        } else {
          const janela = textoDoPrazo(prazo);
          const dono = textoDoPrazo(donoAte!);
          await avisarOsDois(
            admin, l, ASSUNTOS.preAceitacaoExpirou,
            `${TEXTO_JANELA_TERMINOU} ${TEXTO_SEM_PUNICAO} ${linhaDeContexto("tenant", "expirada", janela, dono)}`,
            `a pré-aceitação do morador terminou sem o contrato concluído e a candidatura voltou para você. O seu prazo para decidir termina em ${dono}. ${linhaDeContexto("owner", "expirada", janela, dono)} Você pode reabri-la.`,
          );
        }
      }
      continue;
    }
    // Regra de corrida: outro contrato ativo nas mesmas datas = alguém concluiu antes. A candidatura perde a vez (sem punição); só o dono a reabre.
    if (await perdeuACorrida(admin, l)) {
      const donoAteCorrida = prazoDoDono(agora, await dataEntradaDa(admin, l));
      const { data: ok } = await admin
        .from("propostas")
        .update({ status: "expirada", pre_aceitacao_expirou_em: agora.toISOString(), pre_aceitacao_perdeu_em: agora.toISOString(), pre_aceitacao_dono_ate: donoAteCorrida.toISOString(), atualizada_em: agora.toISOString() })
        .eq("id", l.id)
        .eq("status", "aceita")
        .select("id")
        .maybeSingle();
      if (ok) {
        resumo.perderamAVez++;
        // Nada volta sozinho para a fila: quem perdeu a vez só volta se o dono reabrir à mão. O lead NÃO é mexido aqui.
        await avisarOsDois(admin, l, ASSUNTOS.preAceitacaoPerdeuVez, TEXTO_PERDEU_A_VEZ, TEXTO_PERDEU_A_VEZ_DONO);
      }
      continue;
    }
    const inicio = new Date(prazo.getTime() - PRAZO_PRE_ACEITACAO_HORAS * 3_600_000);
    for (const lem of lembretesDaPreAceitacao(inicio, prazo)) {
      const col = lem.horasAntes === 24 ? "pre_aceitacao_lembrete_24h_em" : "pre_aceitacao_lembrete_6h_em";
      if (l[col] || agora.getTime() < lem.enviarEm.getTime()) continue;
      if (l.aceita_em && lem.enviarEm.getTime() < Date.parse(l.aceita_em)) continue;
      const { data: marcou } = await admin.from("propostas").update({ [col]: agora.toISOString() }).eq("id", l.id).is(col, null).select("id").maybeSingle();
      if (!marcou) continue;
      resumo.lembretes++;
      await avisarOsDois(admin, l, ASSUNTOS.preAceitacaoLembrete, `faltam ${lem.horasAntes} horas para concluir o contrato: o prazo termina em ${textoDoPrazo(prazo)}. ${TEXTO_REGRA_CORRIDA}`, `faltam ${lem.horasAntes} horas para a janela do morador terminar (${textoDoPrazo(prazo)}). ${linhaDeContexto("owner", "vigente", textoDoPrazo(prazo), null)}`);
    }
  }
  return resumo;
}

/**
 * Reabre uma pré-aceitação expirada (no máximo 2 vezes). A taxa congelada NÃO é tocada. Devolve o motivo de recusa, ou o novo prazo.
 * Quem perdeu a corrida só volta por reabertura MANUAL DO DONO (`quem` = "owner"), e só se as datas já estiverem livres.
 */
export async function reabrirNoBanco(admin: SupabaseClient, propostaId: string, quem: "owner" | "tenant", agora: Date = new Date()): Promise<{ ok: true; prazo: Date; reaberturas: number } | { ok: false; error: string }> {
  const { data, error } = await admin.from("propostas").select("id, status, versao_atual, property_id, pre_aceitacao_reaberturas, pre_aceitacao_expirou_em, pre_aceitacao_perdeu_em, pre_aceitacao_encerrada_em").eq("id", propostaId).maybeSingle();
  if (error) return { ok: false, error: "Não foi possível ler a proposta agora. Tente de novo em instantes." };
  const p = data as { id: string; status: string; versao_atual: number; property_id: string; pre_aceitacao_reaberturas: number; pre_aceitacao_expirou_em: string | null; pre_aceitacao_perdeu_em: string | null; pre_aceitacao_encerrada_em: string | null } | null;
  if (!p) return { ok: false, error: "Proposta não encontrada." };
  if (p.status !== "expirada" || !p.pre_aceitacao_expirou_em) return { ok: false, error: "Só uma pré-aceitação que expirou pode ser reaberta." };
  if (p.pre_aceitacao_encerrada_em) return { ok: false, error: "Esta candidatura foi encerrada na 3ª expiração do prazo. Envie uma nova proposta." };
  if (p.pre_aceitacao_perdeu_em) {
    if (quem !== "owner") return { ok: false, error: "Outra pessoa concluiu o contrato deste imóvel antes (regra de corrida). Só o proprietário pode reabrir esta candidatura." };
    if (await perdeuACorrida(admin, p)) return { ok: false, error: "O contrato de outra pessoa ainda ocupa estas datas: não dá para reabrir agora." };
  }
  const { data: v, error: erroV } = await admin.from("proposta_versoes").select("data_entrada").eq("proposta_id", p.id).eq("versao", p.versao_atual).maybeSingle();
  if (erroV || !v) return { ok: false, error: "Não foi possível ler a data de entrada agora. Tente de novo em instantes." };
  const { data: tx, error: erroTx } = await admin.from("propostas").select("taxa_congelada").eq("id", p.id).maybeSingle();
  if (erroTx) return { ok: false, error: "Não foi possível ler a proposta agora. Tente de novo em instantes." };
  const taxa = (tx as { taxa_congelada: number | null } | null)?.taxa_congelada ?? null;
  const r = reabrirPreAceitacao({ reaberturas: p.pre_aceitacao_reaberturas, taxaCongelada: taxa == null ? null : Number(taxa), dataEntrada: String((v as { data_entrada: string }).data_entrada), agora });
  if (!r) return { ok: false, error: p.pre_aceitacao_reaberturas >= 2 ? "Esta pré-aceitação já foi reaberta 2 vezes, o máximo permitido." : "A data de entrada já passou: não dá para reabrir." };
  // Só muda o prazo, o contador e o status; taxa_congelada fica como está (a taxa congelada continua valendo).
  const { data: ok } = await admin
    .from("propostas")
    .update({
      status: "aceita", pre_aceitacao_ate: r.prazo.toISOString(), pre_aceitacao_reaberturas: r.reaberturas, pre_aceitacao_expirou_em: null,
      pre_aceitacao_lembrete_24h_em: null, pre_aceitacao_lembrete_6h_em: null, pre_aceitacao_perdeu_em: null, pre_aceitacao_dono_ate: null, atualizada_em: agora.toISOString(),
    })
    .eq("id", p.id)
    .eq("status", "expirada")
    .eq("pre_aceitacao_reaberturas", p.pre_aceitacao_reaberturas)
    .select("id")
    .maybeSingle();
  if (!ok) return { ok: false, error: "A proposta mudou enquanto você respondia. Abra de novo." };
  return { ok: true, prazo: r.prazo, reaberturas: r.reaberturas };
}
