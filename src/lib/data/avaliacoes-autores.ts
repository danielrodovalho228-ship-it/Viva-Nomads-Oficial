import "server-only";
/*
  Prompt 61-A, item 3 — cidade e "na Viva desde" de quem avaliou, para a página pública do imóvel. Lê com a chave de
  serviço só a cidade do perfil e a data da conta (nada de nome, foto ou contato) das avaliações já publicadas do
  imóvel. Sem banco ou com erro: nada (a avaliação aparece sem a linha).
*/
import { createAdminClient } from "@/lib/supabase/admin";
import { linkedinConectados } from "@/lib/linkedin/servidor";

export async function autoresDasAvaliacoes(propertyId: string): Promise<Map<string, { cidade: string | null; desde: string | null; linkedinConectado: boolean }>> {
  const m = new Map<string, { cidade: string | null; desde: string | null; linkedinConectado: boolean }>();
  const admin = createAdminClient();
  if (!admin || !/^[0-9a-f-]{36}$/i.test(propertyId)) return m;
  try {
    const { data: av } = await admin
      .from("avaliacoes")
      .select("id, autor_id")
      .eq("imovel_id", propertyId)
      .eq("papel_autor", "inquilino")
      .eq("status", "publicada")
      .limit(200);
    const linhas = (av ?? []) as { id: string; autor_id: string }[];
    if (!linhas.length) return m;
    const { data: perfis } = await admin.from("profiles").select("id, cidade, created_at").in("id", [...new Set(linhas.map((l) => l.autor_id))]);
    const linkedin = await linkedinConectados(linhas.map((l) => l.autor_id), admin);
    const porId = new Map(((perfis ?? []) as { id: string; cidade: string | null; created_at: string | null }[]).map((p) => [p.id, p]));
    for (const l of linhas) {
      const p = porId.get(l.autor_id);
      m.set(l.id, { cidade: p?.cidade ?? null, desde: p?.created_at ?? null, linkedinConectado: linkedin.has(l.autor_id) });
    }
  } catch {
    /* sem a linha do autor */
  }
  return m;
}
