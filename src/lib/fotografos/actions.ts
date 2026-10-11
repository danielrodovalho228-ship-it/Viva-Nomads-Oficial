"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { consumirLimite } from "@/lib/limites";
import { ehUuid, portfolioSeguro, taxaValida, validarPedido } from "./regras";

export type ResultadoAcao = { ok: boolean; erro?: string; mensagem?: string };

const hojeISO = () => new Date().toISOString().slice(0, 10);

/** Pedido do dono ao fotógrafo. O dono vem da SESSÃO (nunca do formulário); o contato dele fica mascarado até a taxa ser paga. */
export async function criarPedidoFotografo(_: ResultadoAcao | null, form: FormData): Promise<ResultadoAcao> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, erro: "Indisponível no modo demonstração." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre na sua conta para pedir um fotógrafo." };

  const v = validarPedido(
    {
      fotografoId: form.get("fotografoId"),
      cep: form.get("cep"),
      cidade: form.get("cidade"),
      uf: form.get("uf"),
      data: form.get("data"),
      observacao: form.get("observacao"),
    },
    hojeISO()
  );
  if (!v.ok) return { ok: false, erro: v.erro };

  // Texto livre não pode carregar telefone/e-mail: o contato só sai depois do aceite.
  if (v.dados.observacao && /(\d[\s.\-()]*){8,}|@|https?:\/\/|www\./i.test(v.dados.observacao))
    return { ok: false, erro: "Não coloque telefone, e-mail ou link na observação. O contato é liberado depois que o fotógrafo aceitar." };

  if (!(await consumirLimite(`fotografo-pedido:${user.id}`, 10, 3600)))
    return { ok: false, erro: "Muitos pedidos em pouco tempo. Tente de novo mais tarde." };

  // RLS confere: dono = sessão, status 'enviado', fotógrafo aprovado.
  const { error } = await supabase.from("fotografo_pedidos").insert(v.dados);
  if (error) {
    if (error.code === "23505") return { ok: false, erro: "Você já tem um pedido aberto com este fotógrafo." };
    console.error("[criarPedidoFotografo]", error.code);
    return { ok: false, erro: "Não foi possível enviar o pedido agora. Tente de novo em instantes." };
  }
  return { ok: true, mensagem: "Pedido enviado. O fotógrafo responde pela Viva; seu contato só é liberado depois que ele aceitar." };
}

async function exigirAdmin() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return perfil?.role === "admin" ? { supabase, userId: user.id } : null;
}

const inteiro = (v: FormDataEntryValue | null, min: number, max: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Admin cadastra um fotógrafo (já aprovado ou como pendente). Contato fica em tabela só do admin. */
export async function cadastrarFotografo(_: ResultadoAcao | null, form: FormData): Promise<ResultadoAcao> {
  const adm = await exigirAdmin();
  if (!adm) return { ok: false, erro: "Sem permissão." };
  const nome = String(form.get("nome") ?? "").trim();
  const cidades = String(form.get("cidades") ?? "").split(/[,;\n]/).map((c) => c.trim()).filter(Boolean).slice(0, 30);
  const preco = taxaValida(form.get("preco"));
  const fotos = inteiro(form.get("fotos"), 1, 200);
  const prazo = inteiro(form.get("prazo"), 1, 30);
  const portfolioBruto = String(form.get("portfolio") ?? "").trim();
  const portfolio = portfolioBruto ? portfolioSeguro(portfolioBruto) : null;
  if (nome.length < 2 || nome.length > 80) return { ok: false, erro: "Nome comercial: 2 a 80 caracteres." };
  if (!cidades.length || cidades.some((c) => c.length > 80)) return { ok: false, erro: "Informe ao menos uma cidade atendida." };
  if (preco === null || fotos === null || prazo === null) return { ok: false, erro: "Confira preço, nº de fotos (1–200) e prazo (1–30 dias)." };
  if (portfolioBruto && !portfolio) return { ok: false, erro: "O portfólio precisa ser um link https." };

  const aprovado = form.get("aprovado") === "on";
  const { data, error } = await adm.supabase
    .from("fotografos")
    .insert({
      nome_comercial: nome, cidades, portfolio_url: portfolio, pacote_fotos: fotos, pacote_prazo_dias: prazo,
      pacote_preco: preco, aprovado, aprovado_em: aprovado ? new Date().toISOString() : null, criado_por: adm.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[cadastrarFotografo]", error?.code);
    return { ok: false, erro: "Não foi possível cadastrar agora." };
  }
  const email = String(form.get("email") ?? "").trim().slice(0, 200);
  const whatsapp = String(form.get("whatsapp") ?? "").trim().slice(0, 30);
  if (email || whatsapp) await adm.supabase.from("fotografos_contato").insert({ fotografo_id: data.id, email: email || null, whatsapp: whatsapp || null });
  revalidatePath("/admin/fotografos");
  revalidatePath("/parceiros/fotografos");
  return { ok: true, mensagem: "Fotógrafo cadastrado." };
}

export async function alternarAprovacaoFotografo(id: string, aprovar: boolean): Promise<ResultadoAcao> {
  const adm = await exigirAdmin();
  if (!adm) return { ok: false, erro: "Sem permissão." };
  if (!ehUuid(id)) return { ok: false, erro: "Fotógrafo inválido." };
  const { error } = await adm.supabase.from("fotografos").update({ aprovado: aprovar, aprovado_em: aprovar ? new Date().toISOString() : null }).eq("id", id);
  if (error) return { ok: false, erro: "Não foi possível atualizar." };
  revalidatePath("/admin/fotografos");
  revalidatePath("/parceiros/fotografos");
  return { ok: true };
}

export async function salvarTaxaParceria(_: ResultadoAcao | null, form: FormData): Promise<ResultadoAcao> {
  const adm = await exigirAdmin();
  if (!adm) return { ok: false, erro: "Sem permissão." };
  const valor = taxaValida(form.get("taxa"));
  if (valor === null) return { ok: false, erro: "Informe um valor entre R$ 0 e R$ 10.000." };
  const { error } = await adm.supabase.from("config_parceria").upsert({ chave: "taxa_parceria_fotografo", valor });
  if (error) return { ok: false, erro: "Não foi possível salvar." };
  revalidatePath("/admin/fotografos");
  return { ok: true, mensagem: "Taxa de parceria atualizada (vale para os próximos pedidos)." };
}
