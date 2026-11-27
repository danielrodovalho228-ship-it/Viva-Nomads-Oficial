/*
  E1079 (ORDEM-DUET-385, tela 4 — mockup morador-servico-avaliador): o cartão "Avaliação do imóvel — Laudo com o nível
  do imóvel" na grade de Serviços. Quem pede a avaliação é o DONO, na página Nível de cada imóvel. A avaliação NÃO vira
  categoria contratável do catálogo (segue só de credenciamento).
  E1104 (ORDEM-DUET-470): o cartão é a PORTA de descoberta, de todo dono — já não depende de a avaliação estar aberta
  para a conta. Sem avaliação em curso, leva à porta (/dashboard/servicos/avaliacao: escolher o imóvel e começar o
  pedido); com avaliação em curso, leva ao pedido. Fora do piloto, a porta diz o estado honesto e NADA da avaliação é
  lido (o piloto continua fechado: nenhum pedido, nenhum avaliador). O morador não ganha o cartão.
  E1093 (ORDENS 446 e 565): leitura que falha NÃO é "sem cartão". Antes, qualquer leitura falhada (a sessão por
  confirmar, o perfil, os imóveis, o modo) devolvia null e o cartão sumia da grade sem aviso — reaparecia na carga
  seguinte. Agora a falha LANÇA e a tela mostra "Não conseguimos abrir esta tela" com "Tentar de novo". "Sem cartão"
  fica só para quem não é dono ou não está no papel de dono.
  E1125 (ORDEM-DUET-539): o cartão só existe no papel de PROPRIETÁRIO. O papel em uso é lido aqui pelas mesmas duas
  leituras do painel (o modo: resolveInitialMode; a parceria escolhida: papelInicialDoServidor) — a conta de dono a usar o
  painel como moradora, ou como parceira, não ganha o cartão. A porta guarda também quando cada pedido em curso foi
  feito, para listar os pedidos do mais recente para o mais antigo.
*/
import { createClient } from "@/lib/supabase/server";
import { usuarioExigido } from "@/lib/supabase/usuario-da-leitura";
import { createAdminClient } from "@/lib/supabase/admin";
import { vistoriaAtiva } from "./chave";
import { resolveInitialMode } from "@/lib/data/mode-actions";
import { papelInicialDoServidor } from "@/lib/papel/papel-inicial-servidor";
import { STATUS_PEDIDO_EM_CURSO, ehDonoParaAPorta, hrefDoCartaoDaAvaliacao, papelEmUso, podeVerOCartao, type ImovelNaPorta, type PapelNaPorta } from "./porta-da-avaliacao";

export interface PortaDaAvaliacao {
  /** A avaliação está aberta para esta conta (chave global, laboratório ou piloto). */
  chaveAberta: boolean;
  /** A cidade do imóvel mais recente da conta (para o estado honesto); null sem imóvel. */
  cidade: string | null;
  /** Os imóveis da conta, do mais recente para o mais antigo. Com a chave fechada, `emCurso` é sempre false. */
  imoveis: ImovelNaPorta[];
}

const MSG_PORTA_NAO_LIDA = "Não foi possível ler a avaliação do imóvel agora.";

/**
 * A porta da avaliação para a conta da sessão. Devolve null quando não há sessão ou quando a conta não é de dono (o
 * morador não tem porta). E1093: uma leitura que falha LANÇA — não é "sem porta".
 */
export async function portaDaAvaliacao(): Promise<PortaDaAvaliacao | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const user = await usuarioExigido(supabase);
  if (!user) return null;
  const [{ data: props, error: erroProps }, { data: perfil, error: erroPerfil }] = await Promise.all([
    supabase.from("properties").select("id, title, city").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);
  if (erroProps || erroPerfil) throw new Error(MSG_PORTA_NAO_LIDA);
  const linhas = (props ?? []) as { id: string; title: string | null; city: string | null }[];
  if (!ehDonoParaAPorta({ imoveis: linhas.length, role: (perfil as { role?: string | null } | null)?.role ?? null })) return null;
  const chaveAberta = await vistoriaAtiva();
  // E1125: de cada imóvel, quando foi feito o pedido em curso (o mais recente, se houver mais de um).
  const emCurso = new Map<string, string>();
  if (chaveAberta && linhas.length) {
    const admin = createAdminClient();
    if (!admin) throw new Error(MSG_PORTA_NAO_LIDA);
    const { data: pedidos, error: erroPedidos } = await admin
      .from("vistoria_pedidos")
      .select("property_id, criado_em")
      .eq("owner_id", user.id)
      .in("property_id", linhas.map((l) => l.id))
      .in("status", [...STATUS_PEDIDO_EM_CURSO])
      .order("criado_em", { ascending: false });
    if (erroPedidos) throw new Error(MSG_PORTA_NAO_LIDA);
    for (const p of (pedidos ?? []) as { property_id: string; criado_em: string }[]) if (!emCurso.has(p.property_id)) emCurso.set(p.property_id, p.criado_em);
  }
  return {
    chaveAberta,
    cidade: linhas.find((l) => l.city)?.city ?? null,
    imoveis: linhas.map((l) => ({ id: l.id, titulo: (l.title ?? "").trim() || "Imóvel sem título", cidade: l.city, emCurso: emCurso.has(l.id), pedidoEm: emCurso.get(l.id) ?? null })),
  };
}

/**
 * E1125: o papel que a conta da sessão está a usar, lido como o painel o lê. E1093: as duas leituras lançam na falha e
 * a falha SOBE (antes virava "papel não lido" e o cartão sumia em silêncio).
 */
async function papelEmUsoNoServidor(): Promise<PapelNaPorta> {
  const [modo, inicial] = await Promise.all([resolveInitialMode(), papelInicialDoServidor()]);
  return papelEmUso({ modo, parceiro: inicial?.parceiro === true });
}

/**
 * O cartão da grade de Serviços: do dono, no papel de proprietário (E1125). O destino é decidido pela regra pura (uma
 * avaliação em curso → o pedido; nenhuma ou várias → a porta).
 */
export async function avaliacaoNaGrade(): Promise<{ href: string } | null> {
  // E1093: as duas leituras lançam na falha, e a falha sobe (a tela mostra "Não conseguimos abrir esta tela" com
  // "Tentar de novo"). null aqui é só "não é dono" ou "não está no papel de dono" — nunca "não consegui ler".
  const [porta, papel] = await Promise.all([portaDaAvaliacao(), papelEmUsoNoServidor()]);
  // portaDaAvaliacao só devolve a porta a quem é dono; o papel em uso decide se o cartão aparece.
  if (!porta || !podeVerOCartao({ dono: true, papel })) return null;
  return { href: hrefDoCartaoDaAvaliacao({ chaveAberta: porta.chaveAberta, imoveis: porta.imoveis }) };
}
