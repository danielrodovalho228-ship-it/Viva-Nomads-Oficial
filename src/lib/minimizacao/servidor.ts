import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { INVENTARIO } from "@/config/retencao";
import { planoDoItem, textoPrazo, type Candidato, type ItemInventario } from "@/lib/minimizacao/regras";

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
        .update({ arquivo_path: null, caso_documento_path: null, arquivo_eliminado_em: agora.toISOString() })
        .eq("id", c.extra!.id);
      if (error) throw new Error(error.message);
    },
  },
};

/** Quanto existe hoje numa tabela do inventário (para o relatório simulado). Bucket: não conta (null). */
async function guardados(admin: Admin, item: ItemInventario): Promise<number | null> {
  if (!item.origem.startsWith("public.")) return null;
  const { count, error } = await admin.from(item.origem.slice(7)).select("*", { count: "exact", head: true });
  return error ? null : (count ?? 0);
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
  const dia = agora.toISOString().slice(0, 10);
  const r: ResultadoEliminacao = { eliminados: 0, simulados: 0, falhas: 0 };
  for (const item of INVENTARIO) {
    try {
      const col = COLETORES[item.id];
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
