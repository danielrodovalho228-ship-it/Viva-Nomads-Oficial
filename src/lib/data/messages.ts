import { createClient } from "@/lib/supabase/server";
import { linkedinConectados } from "@/lib/linkedin/servidor";
import { vinculosConfirmados } from "@/lib/vinculo/servidor";
import { createAdminClient } from "@/lib/supabase/admin";
import { relacaoAceitaEntreServidor } from "@/lib/data/avatar-url";
import { nomeNaConversa } from "@/lib/perfil/perfil-publico";
import { contratoAssinadoEntrePartes, type ContratoParaAlerta } from "@/lib/seguranca/antigolpe";
import { papelDaConversa, formatarPeriodo, type PapelConversa } from "@/lib/mensagens-filtros";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { urlMidiaParceiro } from "@/lib/data/parceiros-publico";

export interface ChatMessage {
  id: string;
  from: "me" | "them";
  text: string;
  /** Prompt 17: mensagem que é o cartão de uma proposta (link para /dashboard/propostas/<id>). */
  propostaId?: string;
}

export interface Conversation {
  id: string;
  name: string;
  property: string;
  preview: string;
  otherId?: string;
  propertyId?: string;
  /** Chips da caixa (UX6-b, Prompt 32): como proprietário, como morador, parceiros ou falar com a Viva. */
  papel?: PapelConversa;
  /** Contrato entre as duas partes desta conversa, no imóvel (link "Abrir a página da estadia"). */
  contratoId?: string;
  /** Foto de capa do imóvel e período da estadia (quando há contrato). */
  foto?: string;
  periodo?: string;
  /** Contrato ASSINADO pelas duas partes desta conversa (o alerta antigolpe só vale antes disso). */
  contratoFechado?: boolean;
  /** Conversa de pedido de serviço de parceiro (Prompt 31b): a resposta vai pela rota do pedido. */
  pedidoParceiroId?: string;
  /** 63-B: a outra parte tem o selo "LinkedIn conectado" (só o sim). */
  linkedinConectado?: boolean;
  /** E174-B: domínio do vínculo profissional confirmado da outra parte (só o domínio). */
  vinculoDominio?: string | null;
  messages: ChatMessage[];
}

/** Conversas de exemplo (fallback do modo demonstração). */
export const SAMPLE_CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    name: "Ana Carvalho",
    property: "Apto Santa Mônica",
    preview: "O imóvel está disponível em agosto?",
    messages: [
      { id: "a1", from: "them", text: "Olá! O imóvel está disponível a partir de agosto?" },
      { id: "a2", from: "me", text: "Olá, Ana! Sim, disponível a partir de 1º de agosto." },
      { id: "a3", from: "them", text: "Ótimo. Tem home office? Trabalho remoto." },
    ],
  },
  {
    id: "2",
    name: "Rafael Lima",
    property: "Studio Centro",
    preview: "Posso agendar uma visita?",
    messages: [{ id: "b1", from: "them", text: "Bom dia! Posso agendar uma visita esta semana?" }],
  },
];

interface MsgRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  property_id: string | null;
  body: string;
  created_at: string;
  proposta_id?: string | null;
  parceiro_pedido_id?: string | null;
  property: { title: string | null; owner_id: string | null } | null;
}

/**
 * Lista as conversas do usuário logado. Modo demonstração (sem Supabase) mostra
 * exemplos; modo REAL nunca inventa conversas — sem sessão, erro ou banco vazio
 * devolve lista vazia (a página mostra o estado "sem mensagens").
 */
export async function listConversations(): Promise<Conversation[]> {
  const supabase = await createClient();
  if (!supabase) return SAMPLE_CONVERSATIONS;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("messages")
    .select(
      `id, conversation_id, sender_id, receiver_id, property_id, body, created_at, proposta_id, parceiro_pedido_id,
       property:properties!messages_property_id_fkey ( title, owner_id )`
    )
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  const byConv = new Map<string, Conversation>();
  for (const m of data as unknown as MsgRow[]) {
    const mine = m.sender_id === user.id;
    const otherId = mine ? m.receiver_id : m.sender_id;
    if (!byConv.has(m.conversation_id)) {
      byConv.set(m.conversation_id, {
        id: m.conversation_id,
        name: "Conversa",
        property: m.property?.title ?? "",
        preview: "",
        otherId,
        propertyId: m.property_id ?? undefined,
        papel: papelDaConversa(
          { propertyId: m.property_id ?? undefined, donoDoImovelId: m.property?.owner_id ?? undefined, pedidoParceiroId: m.parceiro_pedido_id },
          user.id
        ),
        ...(m.parceiro_pedido_id ? { pedidoParceiroId: m.parceiro_pedido_id, property: "Pedido de serviço" } : {}),
        messages: [],
      });
    }
    const conv = byConv.get(m.conversation_id)!;
    // Mesmo filtro do envio: mensagem antiga com CPF/RG ou contato nunca aparece crua (nem na prévia da caixa).
    const texto = guardContactInfo(m.body).text;
    conv.messages.push({ id: m.id, from: mine ? "me" : "them", text: texto, ...(m.proposta_id ? { propostaId: m.proposta_id } : {}) });
    conv.preview = texto;
  }

  // Nome do outro lado (prompt 6, mesma regra do cartão do candidato): o proprietário vê
  // "Candidato(a)" até aceitar e o nome curto depois; o inquilino vê o nome curto do
  // proprietário. Nome completo e aceite vêm do servidor (service role); sem ele, o
  // proprietário continua vendo "Candidato(a)". Suporte segue com o primeiro nome (RPC 0057).
  const conversas = [...byConv.values()];
  const outros = [...new Set(conversas.map((c) => c.otherId).filter(Boolean))] as string[];
  if (outros.length > 0) {
    const { data: nomes } = await supabase.rpc("primeiros_nomes", { ids: outros });
    const primeiro = new Map(
      ((nomes ?? []) as { id: string; primeiro_nome: string | null }[]).map((n) => [n.id, n.primeiro_nome])
    );
    const completo = new Map<string, string | null>();
    const aceito = new Map<string, boolean>();
    const admin = createAdminClient();
    if (admin) {
      const { data: perfis } = await admin.from("profiles").select("id, full_name").in("id", outros);
      for (const p of (perfis ?? []) as { id: string; full_name: string | null }[]) completo.set(p.id, p.full_name);
      const comLinkedin = await linkedinConectados(outros, admin);
      for (const c of conversas) if (c.otherId && comLinkedin.has(c.otherId)) c.linkedinConectado = true;
      const comVinculo = await vinculosConfirmados(outros, admin);
      for (const c of conversas) if (c.otherId && comVinculo.has(c.otherId)) c.vinculoDominio = comVinculo.get(c.otherId)!;
      const candidatos = [...new Set(conversas.filter((c) => c.papel === "proprietario" && c.otherId).map((c) => c.otherId!))];
      await Promise.all(candidatos.map(async (id) => aceito.set(id, await relacaoAceitaEntreServidor(user.id, id))));
    }
    for (const conv of conversas) {
      const id = conv.otherId ?? "";
      conv.name = nomeNaConversa({
        // Conversa de pedido de serviço (Parceiros): o nome curto da outra parte, como na conversa do morador.
        papel: conv.papel === "parceiros" ? "inquilino" : (conv.papel ?? "suporte"),
        nomeCompleto: completo.get(id) ?? null,
        aceito: aceito.get(id) === true,
        primeiroNome: primeiro.get(id) ?? null,
      });
    }
  }
  await enriquecer(supabase, [...byConv.values()], user.id);
  return [...byConv.values()];
}

type Supa = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/**
 * Foto de capa (do imóvel; na conversa de pedido, a do parceiro), datas do contrato entre as DUAS partes da conversa
 * ("13/11 – 15/02") e o id dele para o link da página da estadia. Best-effort: se falhar, a conversa fica sem eles.
 */
async function enriquecer(supabase: Supa, conversas: Conversation[], eu: string) {
  const ids = [...new Set(conversas.map((c) => c.propertyId).filter(Boolean))] as string[];
  const pedidos = [...new Set(conversas.map((c) => c.pedidoParceiroId).filter(Boolean))] as string[];
  try {
    const [{ data: fotos }, { data: contratos }, { data: parceiros }] = await Promise.all([
      ids.length
        ? supabase.from("property_photos").select("property_id, url, sort_order").in("property_id", ids).order("sort_order")
        : Promise.resolve({ data: [] }),
      ids.length
        ? supabase
            .from("contratos")
            .select("id, property_id, tenant_id, status, created_at, assinado_proprietario_em, assinado_inquilino_em, contrato_blocos(inicio, fim)")
            .in("property_id", ids)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      pedidos.length
        ? supabase.from("parceiro_pedidos").select("id, parceiro:parceiros(avatar_path)").in("id", pedidos)
        : Promise.resolve({ data: [] }),
    ]);
    const capa = new Map<string, string>();
    for (const f of (fotos ?? []) as { property_id: string; url: string }[]) {
      if (!capa.has(f.property_id)) capa.set(f.property_id, f.url);
    }
    const fotoParceiro = new Map<string, string>();
    for (const p of (parceiros ?? []) as unknown as { id: string; parceiro: { avatar_path: string | null } | null }[]) {
      const url = urlMidiaParceiro(p.parceiro?.avatar_path ?? null);
      if (url) fotoParceiro.set(p.id, url);
    }
    type LinhaContrato = ContratoParaAlerta & { id: string; contrato_blocos: { inicio: string; fim: string }[] | null };
    const lista = (contratos ?? []) as unknown as LinhaContrato[];
    for (const c of conversas) {
      if (c.pedidoParceiroId) {
        c.foto = fotoParceiro.get(c.pedidoParceiroId) ?? (c.propertyId ? capa.get(c.propertyId) : undefined);
        continue;
      }
      if (!c.propertyId) continue;
      c.foto = capa.get(c.propertyId);
      // O contrato desta conversa: no imóvel, com o morador sendo eu ou a outra parte (o mais recente).
      const doPar = lista.find((ct) => ct.property_id === c.propertyId && (ct.tenant_id === eu || ct.tenant_id === c.otherId));
      const bl = doPar?.contrato_blocos ?? [];
      c.periodo = bl.length ? formatarPeriodo(bl.map((b) => b.inicio).sort()[0], bl.map((b) => b.fim).sort().at(-1)) || undefined : undefined;
      if (doPar) c.contratoId = doPar.id;
      c.contratoFechado = contratoAssinadoEntrePartes(lista, { propertyId: c.propertyId, eu, outroId: c.otherId });
    }
  } catch {
    /* sem foto/período: a conversa continua utilizável */
  }
}
