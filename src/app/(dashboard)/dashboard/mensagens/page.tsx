import { listConversations } from "@/lib/data/messages";
import { MessagesClient } from "./messages-client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MessagesPage({ searchParams }: { searchParams?: Promise<{ conversa?: string }> }) {
  const sp = (await searchParams) ?? {};
  // "Mensagem" da página da estadia abre a conversa daquele contrato. E200: a lista já traz a conversa de todo contrato
  // em que a pessoa é parte (vazia se ainda não há mensagem, com o nome do outro lado); conversa que não está na lista
  // a tela diz que não encontrou — nunca abre a de outra pessoa.
  const pedida = sp.conversa && UUID_RE.test(sp.conversa) ? sp.conversa : undefined;
  return <MessagesClient initial={await listConversations()} abrir={pedida} />;
}
