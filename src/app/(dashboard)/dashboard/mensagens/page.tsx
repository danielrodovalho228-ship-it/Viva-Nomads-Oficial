import { listConversations } from "@/lib/data/messages";
import { MessagesClient } from "./messages-client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MessagesPage({ searchParams }: { searchParams?: Promise<{ conversa?: string }> }) {
  const sp = (await searchParams) ?? {};
  const conversations = await listConversations();
  // "Mensagem" da página da estadia abre a conversa daquele contrato (só se ela é da pessoa: está na lista dela).
  return <MessagesClient initial={conversations} abrir={sp.conversa && UUID_RE.test(sp.conversa) ? sp.conversa : undefined} />;
}
