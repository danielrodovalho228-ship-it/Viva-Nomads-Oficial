"use server";

/*
  61-B — o morador convida quem vai morar junto (só leitura) e remove quando quiser. Só o morador do contrato, com a
  estadia assinada pelas duas partes. O convite sai por e-mail (evento estadia_convite_ocupante da matriz); remover
  corta o acesso na hora (a visão do convidado confere removido_em a cada abertura).
*/
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notifications";
import { primeiroNome } from "@/lib/display-name";
import { HREF_ESTADIA } from "@/lib/estadia/estadia";
import { entradaDoConvidado, podeConvidar } from "@/lib/anuncio/chegada-e-pedido";
import { assinadoPelasDuas, contextoDaEstadia } from "@/lib/data/estadia";
import { convidadosAtivos, type ConvidadoView } from "@/lib/data/estadia-convidados";

type Res<T = undefined> = { ok: true; valor: T } | { ok: false; erro: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function convidarOcupante(contratoId: string, email: string): Promise<Res<ConvidadoView>> {
  const ctx = await contextoDaEstadia(contratoId);
  if ("erro" in ctx) return { ok: false, erro: ctx.erro };
  if (ctx.papel !== "inquilino") return { ok: false, erro: "Quem convida é o morador." };
  if (!assinadoPelasDuas(ctx.c) || ctx.c.status !== "ativo") return { ok: false, erro: "O convite fica disponível depois da assinatura das duas partes." };
  const ativos = await convidadosAtivos(ctx.admin, ctx.c.id);
  const v = podeConvidar({ qtdOcupantes: ctx.c.qtd_ocupantes, ativos: ativos.length, email, jaConvidados: ativos.map((a) => a.email), emailDoMorador: ctx.email });
  if (!v.ok) return v;
  const alvo = email.trim().toLowerCase();
  const { data: novo, error } = await ctx.admin
    .from("estadia_convidados")
    .insert({ contrato_id: ctx.c.id, email: alvo, convidado_por: ctx.userId })
    .select("id, criado_em")
    .single();
  // O gatilho da 0225 repete o teto no banco; o índice único barra o mesmo e-mail duas vezes.
  if (error || !novo) {
    const msg = error?.code === "23514" ? "O contrato não tem mais vaga para convidar." : error?.code === "23505" ? "Essa pessoa já foi convidada." : "Não foi possível enviar o convite.";
    return { ok: false, erro: msg };
  }
  await ctx.admin.from("contrato_eventos").insert({ contrato_id: ctx.c.id, autor_id: ctx.userId, tipo: "convidado_adicionado", dados: { convite_id: novo.id } }).then(undefined, () => {});
  const { data: perfil } = await ctx.admin.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle();
  const quem = primeiroNome((perfil as { full_name?: string | null } | null)?.full_name ?? undefined) || "O morador";
  const destino = entradaDoConvidado(ctx.c.id);
  after(async () => {
    try {
      // Sem valor, contrato nem endereço no e-mail: só quem convidou e o caminho para entrar com o código.
      await notify({
        event: "estadia_convite_ocupante",
        email: alvo,
        pushUrl: destino,
        body: () => `${quem} incluiu você como morador da estadia em ${ctx.c.properties?.city ?? "um imóvel da Viva"}. Entre com este e-mail para ver as datas, o endereço e, perto da entrada, as instruções de chegada.`,
      });
    } catch {
      /* aviso é best-effort */
    }
  });
  revalidatePath(HREF_ESTADIA(ctx.c.id));
  return { ok: true, valor: { id: novo.id as string, email: alvo, entrou: false, criadoEm: novo.criado_em as string } };
}

export async function removerConvidado(contratoId: string, conviteId: string): Promise<Res> {
  if (!UUID_RE.test(String(conviteId))) return { ok: false, erro: "Convite inválido." };
  const ctx = await contextoDaEstadia(contratoId);
  if ("erro" in ctx) return { ok: false, erro: ctx.erro };
  if (ctx.papel !== "inquilino") return { ok: false, erro: "Quem remove é o morador." };
  const { data } = await ctx.admin
    .from("estadia_convidados")
    .update({ removido_em: new Date().toISOString() })
    .eq("id", conviteId)
    .eq("contrato_id", ctx.c.id)
    .is("removido_em", null)
    .select("id");
  if (!data?.length) return { ok: false, erro: "Convite não encontrado." };
  await ctx.admin.from("contrato_eventos").insert({ contrato_id: ctx.c.id, autor_id: ctx.userId, tipo: "convidado_removido", dados: { convite_id: conviteId } }).then(undefined, () => {});
  revalidatePath(HREF_ESTADIA(ctx.c.id));
  revalidatePath(`${HREF_ESTADIA(ctx.c.id)}/convidado`);
  return { ok: true, valor: undefined };
}
