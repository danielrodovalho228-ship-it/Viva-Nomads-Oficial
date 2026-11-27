import { createClient } from "@/lib/supabase/server";
import { usuarioExigido } from "@/lib/supabase/usuario-da-leitura";
import { parceiroInicialDoServidor, type PapelInicialServidor } from "./papel-inicial";

/**
 * E1026 — o papel ativo da conta, lido NO SERVIDOR ao montar o painel (o layout chama, com o limite da casca). Devolve
 * `null` quando não há sessão ou não há Supabase (demo): a casca fica com o que o navegador guarda. Uma falha de leitura
 * LANÇA, e o layout a trata como "sem leitura" — nunca como "não é parceiro".
 * Nunca escreve no store global (E793, risco H1): o valor desce por prop + contexto.
 */
export async function papelInicialDoServidor(): Promise<PapelInicialServidor | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const user = await usuarioExigido(supabase);
  if (!user) return null;

  const { data: perfil, error: erroPerfil } = await supabase.from("profiles").select("papel_ativo, papel_ativo_escolhido_em").eq("id", user.id).maybeSingle();
  if (erroPerfil) throw new Error("Não foi possível ler o papel agora.");
  const papelAtivo = (perfil as { papel_ativo?: string | null } | null)?.papel_ativo ?? null;
  const escolhidoEm = (perfil as { papel_ativo_escolhido_em?: string | null } | null)?.papel_ativo_escolhido_em ?? null;
  // Só pergunta pela parceria quando o papel gravado pode valer como parceiro: a maioria das contas para aqui.
  if (!parceiroInicialDoServidor({ papelAtivo, escolhidoEm, parceriaAtiva: true })) return { conta: user.id, parceiro: false };

  // A mesma leitura de ehParceiroAprovado: a linha em parceiros nasce na aprovação; suspensa não conta.
  const { count, error: erroParceria } = await supabase.from("parceiros").select("id", { count: "exact", head: true }).eq("user_id", user.id).neq("status", "suspenso");
  if (erroParceria) throw new Error("Não foi possível ler o papel agora.");
  return { conta: user.id, parceiro: parceiroInicialDoServidor({ papelAtivo, escolhidoEm, parceriaAtiva: (count ?? 0) > 0 }) };
}
