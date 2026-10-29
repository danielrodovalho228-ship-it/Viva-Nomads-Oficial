import "server-only";
import { createClient } from "@/lib/supabase/server";
import { renovacaoPossivel, type Renovacao } from "@/lib/estadia/renovacao";

/*
  E222-B — a renovação na página do contrato: só com contrato ativo e assinado pelas duas partes. Lê pela sessão (RLS:
  só as partes leem o contrato e os blocos). Sem "use server": leitura interna da página, nunca chamada do navegador.
*/
export type SituacaoRenovacao = { cabe: true; renovacao: Renovacao } | { cabe: false };

export async function situacaoDaRenovacao(contratoId: string): Promise<SituacaoRenovacao | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("contratos")
    .select("status, tamanho_bloco_meses, assinado_proprietario_em, assinado_inquilino_em, contrato_blocos(meses, status)")
    .eq("id", contratoId)
    .maybeSingle();
  const c = data as {
    status: string;
    tamanho_bloco_meses: number | null;
    assinado_proprietario_em: string | null;
    assinado_inquilino_em: string | null;
    contrato_blocos: { meses: number; status: string }[] | null;
  } | null;
  if (!c || c.status !== "ativo" || !c.assinado_proprietario_em || !c.assinado_inquilino_em) return null;
  // Proposta antiga que caducou sem os dois aceites (0063) não conta nos meses do contrato.
  const blocos = (c.contrato_blocos ?? []).filter((b) => b.status !== "nao_aceito");
  const renovacao = renovacaoPossivel(blocos, Number(c.tamanho_bloco_meses) || 2);
  return renovacao ? { cabe: true, renovacao } : { cabe: false };
}
