"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { erroBancoPT } from "@/lib/erros-banco";
import { dentroDoLimite, DIA } from "@/lib/limites";
import {
  donoPodeDecidir,
  ehDecisaoDono,
  ehStatusAjuda,
  MAX_ABERTOS_POR_DONO,
  transicaoValida,
  validarPedidoAjuda,
  type EntradaAjuda,
  type StatusAjuda,
} from "@/lib/ajuda-publicacao/ajuda";

type Resultado = { ok: boolean; demo?: boolean; error?: string };

export type PedidoAjuda = {
  id: string;
  status: StatusAjuda;
  criado_em: string;
  atualizado_em: string;
  link_anuncio?: string | null;
  texto_anuncio?: string | null;
  observacao?: string | null;
  owner_nome?: string | null;
  /** URLs públicas das fotos que o dono enviou (só a equipe vê, na fila do /admin). */
  fotos?: string[];
};

const PEDIDOS_POR_DIA = 5;

/** O dono pede ajuda da equipe para montar o rascunho do anúncio (ordem 65e999b2). */
export async function pedirAjudaParaPublicar(entrada: EntradaAjuda): Promise<Resultado> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta para pedir ajuda." };
  const v = validarPedidoAjuda(entrada ?? {}, user.id);
  if (!v.ok) return { ok: false, error: v.erro };
  if (!(await dentroDoLimite(`ajuda-publicacao:${user.id}`, PEDIDOS_POR_DIA, DIA))) {
    return { ok: false, error: "Você já enviou vários pedidos hoje. Tente novamente amanhã." };
  }
  const { count } = await supabase
    .from("pedidos_ajuda_publicacao")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .in("status", ["recebido", "em_montagem", "ajustes_pedidos"]);
  if ((count ?? 0) >= MAX_ABERTOS_POR_DONO) {
    return { ok: false, error: "Você já tem pedidos em andamento. Aguarde a equipe concluir." };
  }
  const { error } = await supabase.from("pedidos_ajuda_publicacao").insert({
    owner_id: user.id,
    link_anuncio: v.valor.link,
    texto_anuncio: v.valor.texto,
    observacao: v.valor.observacao,
    fotos: v.valor.fotos,
  });
  if (error) return { ok: false, error: erroBancoPT(error) };
  revalidatePath("/dashboard/imoveis");
  revalidatePath("/admin/ajuda-publicacao");
  return { ok: true };
}

/** Andamento dos pedidos do próprio dono (a RLS devolve só os dele). Sem link/texto: só o status. */
export async function meusPedidosDeAjuda(): Promise<PedidoAjuda[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("pedidos_ajuda_publicacao")
    .select("id, status, criado_em, atualizado_em")
    .eq("owner_id", user.id)
    .neq("status", "cancelado")
    .order("criado_em", { ascending: false })
    .limit(5);
  return (data ?? []).filter((p) => ehStatusAjuda(p.status)) as PedidoAjuda[];
}

/** Fila da equipe — só admin com 2FA concluído. */
export async function filaAjudaPublicacaoAdmin(): Promise<PedidoAjuda[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return [];
  const { data } = await supabase
    .from("pedidos_ajuda_publicacao")
    .select("id, status, criado_em, atualizado_em, link_anuncio, texto_anuncio, observacao, fotos, owner_id")
    .order("criado_em", { ascending: false })
    .limit(200);
  const linhas = data ?? [];
  const ids = [...new Set(linhas.map((l) => l.owner_id as string))];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data: perfis } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    for (const p of perfis ?? []) nomes.set(p.id as string, ((p.full_name as string) ?? "").trim());
  }
  return linhas
    .filter((l) => ehStatusAjuda(l.status))
    .map((l) => ({
      id: l.id as string,
      status: l.status as StatusAjuda,
      criado_em: l.criado_em as string,
      atualizado_em: l.atualizado_em as string,
      link_anuncio: l.link_anuncio as string | null,
      texto_anuncio: l.texto_anuncio as string | null,
      observacao: l.observacao as string | null,
      fotos: ((l.fotos as string[] | null) ?? []).map((f) => supabase.storage.from("property-photos").getPublicUrl(f).data.publicUrl),
      owner_nome: nomes.get(l.owner_id as string) || null,
    }));
}

/** A equipe move o pedido na fila (recebido → em montagem → enviado para aprovação do dono). */
export async function mudarStatusAjudaPublicacao(id: string, para: string): Promise<Resultado> {
  if (!/^[0-9a-f-]{36}$/i.test(id ?? "") || !ehStatusAjuda(para)) return { ok: false, error: "Pedido inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  if (!(await ehAdmin(supabase, user.id))) return { ok: false, error: "Sem permissão." };
  const { data: atual } = await supabase.from("pedidos_ajuda_publicacao").select("status").eq("id", id).maybeSingle();
  if (!atual || !ehStatusAjuda(atual.status)) return { ok: false, error: "Pedido não encontrado." };
  if (!transicaoValida(atual.status, para)) return { ok: false, error: "Essa mudança de etapa não é permitida." };
  const { data: feito, error } = await supabase
    .from("pedidos_ajuda_publicacao")
    .update({ status: para, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", atual.status)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: erroBancoPT(error) };
  if (!feito) return { ok: false, error: "O pedido mudou enquanto você olhava. Atualize a página." };
  revalidatePath("/admin/ajuda-publicacao");
  revalidatePath("/dashboard/imoveis");
  return { ok: true };
}

/** O DONO aprova o rascunho montado pela equipe ou pede ajustes (só quando está "enviado para aprovação"). */
export async function decidirRascunhoAjuda(id: string, decisao: string): Promise<Resultado> {
  if (!/^[0-9a-f-]{36}$/i.test(id ?? "") || !ehDecisaoDono(decisao)) return { ok: false, error: "Pedido inválido." };
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta." };
  const { data: atual } = await supabase
    .from("pedidos_ajuda_publicacao")
    .select("status")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!atual || !ehStatusAjuda(atual.status)) return { ok: false, error: "Pedido não encontrado." };
  if (!donoPodeDecidir(atual.status)) return { ok: false, error: "Este pedido não está esperando a sua aprovação." };
  const { data: feito, error } = await supabase
    .from("pedidos_ajuda_publicacao")
    .update({ status: decisao, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("status", "enviado_dono")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: erroBancoPT(error) };
  if (!feito) return { ok: false, error: "O pedido mudou enquanto você olhava. Atualize a página." };
  revalidatePath("/dashboard/imoveis");
  revalidatePath("/admin/ajuda-publicacao");
  return { ok: true };
}
