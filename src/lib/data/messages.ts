import { createClient } from "@/lib/supabase/server";

export interface ChatMessage {
  id: string;
  from: "me" | "them";
  text: string;
}

export interface Conversation {
  id: string;
  name: string;
  property: string;
  preview: string;
  otherId?: string;
  propertyId?: string;
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
  sender: { full_name: string | null } | null;
  property: { title: string | null } | null;
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
      `id, conversation_id, sender_id, receiver_id, property_id, body, created_at,
       sender:profiles!messages_sender_id_fkey ( full_name ),
       property:properties!messages_property_id_fkey ( title )`
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
        name: mine ? "Conversa" : (m.sender?.full_name ?? "Conversa"),
        property: m.property?.title ?? "",
        preview: "",
        otherId,
        propertyId: m.property_id ?? undefined,
        messages: [],
      });
    }
    const conv = byConv.get(m.conversation_id)!;
    conv.messages.push({ id: m.id, from: mine ? "me" : "them", text: m.body });
    conv.preview = m.body;
    if (!mine && m.sender?.full_name) conv.name = m.sender.full_name;
  }
  return [...byConv.values()];
}
