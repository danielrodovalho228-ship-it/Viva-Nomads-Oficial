import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { avisarAdminsDocumentoRecebido } from "@/lib/data/aviso-documento-recebido";
import {
  chaveOrfao,
  documentosOrfaos,
  textoAvisoOrfaos,
  ORFAO_MAX_DIAS,
  type ArquivoDoBucket,
} from "@/lib/documento/orfaos";

const BUCKET = "property-docs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGINA = 1000;
const LOTE = 100;

/**
 * Rede de segurança do Prompt 35A (item 1), no cron diário: arquivos de property-docs com mais de 2 h que não
 * estão em nenhuma linha (qualification_checklists, property_ownership_checks — arquivo e caso — nem na
 * autorização do imóvel) viram UM aviso à equipe, com o dono e a data. Cada arquivo é avisado uma vez
 * (automacoes_envios). Somente leitura no bucket: NÃO apaga nada. `simular` só conta.
 */
export async function avisarDocumentosOrfaos(admin: SupabaseClient, agora: Date, simular: boolean): Promise<number> {
  try {
    const desde = agora.getTime() - ORFAO_MAX_DIAS * 86_400_000;
    const arquivos: ArquivoDoBucket[] = [];
    const bucket = admin.storage.from(BUCKET);
    // Pastas = donos. Paginado; só pastas com cara de id de usuário.
    for (let offset = 0; offset < PAGINA * 20; offset += PAGINA) {
      const { data: pastas, error } = await bucket.list("", { limit: PAGINA, offset });
      if (error || !pastas?.length) break;
      for (const p of pastas) {
        if (p.id !== null || !UUID_RE.test(p.name)) continue;
        const { data: itens } = await bucket.list(p.name, { limit: PAGINA, sortBy: { column: "created_at", order: "desc" } });
        for (const it of itens ?? []) {
          if (!it.id || !it.created_at) continue;
          if (Date.parse(it.created_at) < desde) break; // em ordem decrescente: o resto é mais antigo
          arquivos.push({ path: `${p.name}/${it.name}`, ownerId: p.name, criadoEm: it.created_at });
        }
      }
      if (pastas.length < PAGINA) break;
    }
    if (!arquivos.length) return 0;

    // Quais desses caminhos aparecem em algum registro.
    const referenciados = new Set<string>();
    const caminhos = arquivos.map((a) => a.path);
    for (let i = 0; i < caminhos.length; i += LOTE) {
      const lote = caminhos.slice(i, i + LOTE);
      const [q, m, c, p] = await Promise.all([
        admin.from("qualification_checklists").select("document_path").in("document_path", lote),
        admin.from("property_ownership_checks").select("arquivo_path").in("arquivo_path", lote),
        admin.from("property_ownership_checks").select("caso_documento_path").in("caso_documento_path", lote),
        admin.from("properties").select("sublease_doc_url").in("sublease_doc_url", lote), // consistency-ignore: service role do cron; só compara caminhos, nada sai daqui
      ]);
      // Leitura falhou? Trata o lote inteiro como referenciado: melhor não avisar do que avisar errado.
      if (q.error || m.error || c.error || p.error) {
        for (const x of lote) referenciados.add(x);
        continue;
      }
      for (const r of q.data ?? []) if (r.document_path) referenciados.add(r.document_path as string);
      for (const r of m.data ?? []) if (r.arquivo_path) referenciados.add(r.arquivo_path as string);
      for (const r of c.data ?? []) if (r.caso_documento_path) referenciados.add(r.caso_documento_path as string);
      for (const r of p.data ?? []) if (r.sublease_doc_url) referenciados.add(r.sublease_doc_url as string);
    }

    const orfaos = documentosOrfaos(arquivos, referenciados, agora);
    if (simular || !orfaos.length) return orfaos.length;

    // Uma vez por arquivo: marca ANTES de avisar (chave repetida = já avisado).
    const novos: ArquivoDoBucket[] = [];
    for (const o of orfaos) {
      const { error } = await admin.from("automacoes_envios").insert({ chave: chaveOrfao(o.path), tipo: "documento_orfao", usuario_id: o.ownerId });
      if (!error) novos.push(o);
    }
    if (!novos.length) return 0;
    const ids = [...new Set(novos.map((o) => o.ownerId))];
    const { data: perfis } = await admin.from("profiles").select("id, full_name").in("id", ids);
    const nome = new Map((perfis ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? ""]));
    await avisarAdminsDocumentoRecebido(textoAvisoOrfaos(novos.map((o) => ({ dono: nome.get(o.ownerId) ?? "", criadoEm: o.criadoEm }))));
    return novos.length;
  } catch (e) {
    console.error("[documentos-orfaos] falha:", e instanceof Error ? e.message : "desconhecido");
    return 0;
  }
}
