import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { INVENTARIO } from "@/config/retencao";
import { contarGuardados } from "@/lib/data/admin-contagens";
import { LIMPEZA_MATRICULA_ELIMINADA } from "@/lib/documento/conferencia-matricula";
import { planoDoItem, textoPrazo, type Candidato, type ItemInventario } from "@/lib/minimizacao/regras";
import { diaBRT } from "@/lib/datas-brasilia";

type Admin = SupabaseClient;
const DOCS_INQUILINO = "inquilino-docs";
const DOCS_IMOVEL = "property-docs";

/*
  Rotina única de eliminação (Prompt 58, fase 1), chamada pelo cron diário. Lê o inventário: para os itens de fase 1
  (prazo proposto †, sem depender do jurídico) apaga de verdade o que venceu e grava no LIVRO; para o resto, só conta
  (relatório "o que seria apagado hoje"). Falha num item não para os outros: vira alerta no admin.
*/

interface Coletor {
  candidatos: (admin: Admin) => Promise<(Candidato & { extra?: Record<string, string> })[]>;
  eliminar: (admin: Admin, c: Candidato & { extra?: Record<string, string> }, agora: Date) => Promise<void>;
}

async function contasDeTeste(admin: Admin, ids: string[]): Promise<Set<string>> {
  const u = [...new Set(ids.filter(Boolean))];
  if (!u.length) return new Set();
  const { data } = await admin.from("profiles").select("id").in("id", u).eq("is_teste", true);
  return new Set(((data ?? []) as { id: string }[]).map((p) => p.id));
}

/** Caminho do property-docs que ainda tem decisão pendente em alguma das duas tabelas (o arquivo é compartilhado). */
async function caminhosPendentes(admin: Admin, caminhos: string[]): Promise<Set<string>> {
  if (!caminhos.length) return new Set();
  const [{ data: q }, { data: m }] = await Promise.all([
    admin.from("qualification_checklists").select("document_path").in("document_path", caminhos).in("document_status", ["pending", "none"]),
    admin.from("property_ownership_checks").select("arquivo_path").in("arquivo_path", caminhos).in("resultado", ["em_revisao", "provavel"]),
  ]);
  return new Set([...((q ?? []) as { document_path: string }[]).map((x) => x.document_path), ...((m ?? []) as { arquivo_path: string }[]).map((x) => x.arquivo_path)]);
}

async function apagarArquivo(admin: Admin, bucket: string, caminho: string) {
  const { error } = await admin.storage.from(bucket).remove([caminho]);
  if (error && !/not.?found/i.test(error.message)) throw new Error(`${bucket}: ${error.message}`);
}

const COLETORES: Record<string, Coletor> = {
  // a) documento da candidatura RECUSADA: 30 dias † depois da recusa; fica o veredito do lead + tipo e data de envio.
  "inquilino-docs/recusado": {
    async candidatos(admin) {
      const { data } = await admin
        .from("documentos_inquilino")
        .select("id, caminho, tenant_id, leads!inner(status, rejected_at)")
        .not("caminho", "is", null)
        .eq("leads.status", "rejected")
        .limit(1000);
      const linhas = (data ?? []) as unknown as { id: string; caminho: string; tenant_id: string; leads: { rejected_at: string | null } }[];
      const teste = await contasDeTeste(admin, linhas.map((l) => l.tenant_id));
      return linhas.map((l) => ({ ref: l.caminho, desde: l.leads.rejected_at, teste: teste.has(l.tenant_id), extra: { id: l.id } }));
    },
    async eliminar(admin, c, agora) {
      await apagarArquivo(admin, DOCS_INQUILINO, c.ref);
      const { error } = await admin.from("documentos_inquilino").update({ caminho: null, arquivo_eliminado_em: agora.toISOString() }).eq("id", c.extra!.id);
      if (error) throw new Error(error.message);
    },
  },
  // b) documento de /qualificar: 30 dias † depois da decisão da equipe; fica o veredito (status, motivo, data, quem).
  "qualificacao/documento": {
    async candidatos(admin) {
      const { data } = await admin
        .from("qualification_checklists")
        .select("id, owner_id, document_path, document_reviewed_at")
        .not("document_path", "is", null)
        .in("document_status", ["approved", "rejected"])
        .not("document_reviewed_at", "is", null)
        .limit(1000);
      const linhas = (data ?? []) as { id: string; owner_id: string; document_path: string; document_reviewed_at: string }[];
      const pendentes = await caminhosPendentes(admin, linhas.map((l) => l.document_path));
      const teste = await contasDeTeste(admin, linhas.map((l) => l.owner_id));
      return linhas.filter((l) => !pendentes.has(l.document_path)).map((l) => ({ ref: l.document_path, desde: l.document_reviewed_at, teste: teste.has(l.owner_id), extra: { id: l.id } }));
    },
    async eliminar(admin, c, agora) {
      await apagarArquivo(admin, DOCS_IMOVEL, c.ref);
      const { error } = await admin.from("qualification_checklists").update({ document_path: null, document_eliminado_em: agora.toISOString() }).eq("document_path", c.ref);
      if (error) throw new Error(error.message);
    },
  },
  // b) matrícula / documento do caso especial: 30 dias † depois da revisão; fica o veredito e os campos conferidos.
  "matricula/arquivo": {
    async candidatos(admin) {
      const { data } = await admin
        .from("property_ownership_checks")
        .select("id, user_id, arquivo_path, caso_documento_path, revisado_em")
        .not("arquivo_path", "is", null)
        .in("resultado", ["conferido", "recusado"])
        .not("revisado_em", "is", null)
        .limit(1000);
      const linhas = (data ?? []) as { id: string; user_id: string; arquivo_path: string; caso_documento_path: string | null; revisado_em: string }[];
      const pendentes = await caminhosPendentes(admin, linhas.map((l) => l.arquivo_path));
      const teste = await contasDeTeste(admin, linhas.map((l) => l.user_id));
      return linhas
        .filter((l) => !pendentes.has(l.arquivo_path))
        .map((l) => ({ ref: l.arquivo_path, desde: l.revisado_em, teste: teste.has(l.user_id), extra: { id: l.id, caso: l.caso_documento_path ?? "" } }));
    },
    async eliminar(admin, c, agora) {
      await apagarArquivo(admin, DOCS_IMOVEL, c.ref);
      if (c.extra?.caso) await apagarArquivo(admin, DOCS_IMOVEL, c.extra.caso);
      const { error } = await admin
        .from("property_ownership_checks")
        .update({ ...LIMPEZA_MATRICULA_ELIMINADA, arquivo_path: null, caso_documento_path: null, arquivo_eliminado_em: agora.toISOString() })
        .eq("id", c.extra!.id);
      if (error) throw new Error(error.message);
    },
  },
  // E293 P7: registro técnico da IA, 90 dias † desde a criação. Fase 2: o relatório só conta (não apaga) até a fase 2.
  ia_chamadas: {
    async candidatos(admin) {
      const { data } = await admin.from("ia_chamadas").select("id, criada_em").order("criada_em", { ascending: true }).limit(1000);
      return ((data ?? []) as { id: string; criada_em: string }[]).map((l) => ({ ref: l.id, desde: l.criada_em }));
    },
    async eliminar(admin, c) {
      const { error } = await admin.from("ia_chamadas").delete().eq("id", c.ref);
      if (error) throw new Error(error.message);
    },
  },
};

/*
  E293 (relatório honesto): itens de FASE 2 com prazo já declarado. Sem coletor, o relatório mostrava "0 vencidos" — um
  zero falso. Estes coletores SÓ CONTAM: a fase 2 nunca apaga (eliminaDeVerdade = false), e o `eliminar` daqui recusa
  por garantia. Passar algum para a fase 1 é decisão do Daniel (e, nos de prazo pendente, do item 13).
*/
const LIMITE_CONTAGEM = 5000;

function prazoDe(id: string): number {
  const p = INVENTARIO.find((x) => x.id === id)?.prazoDias;
  if (p === null || p === undefined) throw new Error(`${id}: sem prazo declarado`);
  return p;
}

/** Corte grosso (o plano refaz a conta exata em dias inteiros): só lê o que pode ter vencido. */
function corte(id: string): string {
  return new Date(Date.now() - prazoDe(id) * 86_400_000).toISOString();
}

async function soContar(): Promise<void> {
  throw new Error("fase 2: este item só entra na contagem do relatório; nada é apagado");
}

type LinhaContagem = { id: string; desde: string | null; teste?: boolean | null; dono?: string | null };

async function candidatosDe(admin: Admin, linhas: LinhaContagem[], testePorConta: boolean): Promise<Candidato[]> {
  const teste = testePorConta ? await contasDeTeste(admin, linhas.map((l) => l.dono ?? "")) : new Set<string>();
  return linhas.map((l) => ({ ref: l.id, desde: l.desde, teste: l.teste === true || (!!l.dono && teste.has(l.dono)) }));
}

function lerOuFalhar<T>(r: { data: T[] | null; error: { message: string } | null }, item: string): T[] {
  if (r.error) throw new Error(`${item}: ${r.error.message}`);
  return r.data ?? [];
}

const COLETORES_FASE_2: Record<string, Coletor> = {
  // Medição do morador: o sinal sai no aviso ao dono na hora da medição; a linha deveria sair logo depois (prazo 0 †).
  "internet_medicoes/morador": {
    async candidatos(admin) {
      const r = await admin.from("internet_medicoes").select("id, medido_em, user_id").eq("papel", "morador").lt("medido_em", corte("internet_medicoes/morador")).limit(LIMITE_CONTAGEM);
      const linhas = lerOuFalhar(r, "internet_medicoes/morador") as { id: string; medido_em: string; user_id: string }[];
      return candidatosDe(admin, linhas.map((l) => ({ id: l.id, desde: l.medido_em, dono: l.user_id })), true);
    },
    eliminar: soContar,
  },
  // Motivo da saída: anonimizar aos 12 meses † (fica papel, motivo e data).
  saidas_motivos: {
    async candidatos(admin) {
      const r = await admin.from("saidas_motivos").select("id, criado_em, teste").lt("criado_em", corte("saidas_motivos")).limit(LIMITE_CONTAGEM);
      const linhas = lerOuFalhar(r, "saidas_motivos") as { id: string; criado_em: string; teste: boolean }[];
      return candidatosDe(admin, linhas.map((l) => ({ id: l.id, desde: l.criado_em, teste: l.teste })), false);
    },
    eliminar: soContar,
  },
  // Denúncia de anúncio: 12 meses † depois de resolvida (o gatilho é a decisão; a última mudança de estado marca a data).
  denuncias_anuncio: {
    async candidatos(admin) {
      const r = await admin.from("denuncias_anuncio").select("id, atualizado_em, teste").eq("status", "resolvida").lt("atualizado_em", corte("denuncias_anuncio")).limit(LIMITE_CONTAGEM);
      const linhas = lerOuFalhar(r, "denuncias_anuncio") as { id: string; atualizado_em: string; teste: boolean }[];
      return candidatosDe(admin, linhas.map((l) => ({ id: l.id, desde: l.atualizado_em, teste: l.teste })), false);
    },
    eliminar: soContar,
  },
  // Os dois abaixo têm rotina que já apaga (pg_cron da 0067, rotina de atendimento): a contagem
  // confere que a rotina está em dia — o esperado é zero.
  eventos: {
    async candidatos(admin) {
      const r = await admin.from("eventos").select("id, criado_em").lt("criado_em", corte("eventos")).limit(LIMITE_CONTAGEM);
      const linhas = lerOuFalhar(r, "eventos") as { id: number | string; criado_em: string }[];
      return linhas.map((l) => ({ ref: String(l.id), desde: l.criado_em }));
    },
    eliminar: soContar,
  },
  push_envios: {
    async candidatos(admin) {
      const r = await admin.from("push_envios").select("id, criado_em, user_id").lt("criado_em", corte("push_envios")).limit(LIMITE_CONTAGEM);
      const linhas = lerOuFalhar(r, "push_envios") as { id: string; criado_em: string; user_id: string | null }[];
      return candidatosDe(admin, linhas.map((l) => ({ id: l.id, desde: l.criado_em, dono: l.user_id })), true);
    },
    eliminar: soContar,
  },
};

/** Quanto existe hoje numa tabela do inventário (para o relatório simulado). Bucket: não conta (null). */
async function guardados(admin: Admin, item: ItemInventario): Promise<number | null> {
  // E334: a mesma contagem da caixa de e-mails de teste e da coluna "Guardados agora" da Retenção.
  return item.origem.startsWith("public.") ? contarGuardados(admin, item.origem.slice(7)) : null;
}

export interface ResultadoEliminacao {
  eliminados: number;
  simulados: number;
  falhas: number;
}

/**
 * Roda o inventário. `simular`: nada sai, nem os itens de fase 1 (só conta) — é o padrão fora do laboratório até a
 * chave `ELIMINACAO_ATIVA=1`. Grava o relatório do dia (eliminacoes_simulado) e, no real, o livro.
 */
export async function rodarEliminacao(admin: Admin, agora: Date, simular: boolean): Promise<ResultadoEliminacao> {
  // E333: o dia do relatório é o do calendário de Brasília (uma rodada manual às 22h não cai no dia seguinte do UTC).
  const dia = diaBRT(agora)!;
  const r: ResultadoEliminacao = { eliminados: 0, simulados: 0, falhas: 0 };
  for (const item of INVENTARIO) {
    try {
      const col = COLETORES[item.id] ?? COLETORES_FASE_2[item.id];
      const candidatos = col ? await col.candidatos(admin) : [];
      const plano = planoDoItem(item, candidatos, agora);
      const real = plano.real && !simular && !!col;
      let saiu = 0;
      if (real) {
        for (const c of candidatos.filter((x) => plano.eliminar.includes(x.ref))) {
          try {
            await col!.eliminar(admin, c, agora);
            await admin.from("eliminacoes_registro").insert({ origem: item.origem, ref_id: c.ref, tipo: item.id, motivo: "prazo", modo: item.modo === "anonimizar" ? "anonimizado" : "apagado", teste: c.teste === true });
            saiu += 1;
          } catch (e) {
            r.falhas += 1;
            await admin.from("eliminacoes_alertas").insert({ item: item.id, erro: String((e as Error).message ?? e).slice(0, 500) });
          }
        }
        r.eliminados += saiu;
      } else {
        r.simulados += plano.quantidade + plano.quantidadeTeste;
      }
      await admin.from("eliminacoes_simulado").upsert(
        {
          dia,
          item: item.id,
          guardados: await guardados(admin, item),
          vencidos: plano.quantidade,
          vencidos_teste: plano.quantidadeTeste,
          real,
          prazo: textoPrazo(item),
          base: item.base === "pendente" ? "pendente – item 13" : item.base === "proposta" ? "proposta †" : "legal",
          gerado_em: agora.toISOString(),
        },
        { onConflict: "dia,item" },
      );
    } catch (e) {
      r.falhas += 1;
      await admin.from("eliminacoes_alertas").insert({ item: item.id, erro: String((e as Error).message ?? e).slice(0, 500) });
    }
  }
  return r;
}
