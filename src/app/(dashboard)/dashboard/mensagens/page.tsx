import { contratosParaConversa, listConversations, type Conversation } from "@/lib/data/messages";
import { resolverConversaPedida } from "@/lib/mensagens/conversa-pedida";
import { conversationId } from "@/lib/messages/conversation-id";
import { MessagesClient } from "./messages-client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MessagesPage({ searchParams }: { searchParams?: Promise<{ conversa?: string }> }) {
  const sp = (await searchParams) ?? {};
  const conversations = await listConversations();
  // "Mensagem" da página da estadia abre a conversa daquele contrato. E200: se ela ainda não tem mensagem, abre vazia
  // (só para quem é parte do contrato); se não é da pessoa, a tela diz que não encontrou — nunca abre a de outra pessoa.
  const pedida = sp.conversa && UUID_RE.test(sp.conversa) ? sp.conversa : undefined;
  let lista: Conversation[] = conversations;
  if (pedida && !conversations.some((c) => c.id === pedida)) {
    const partes = await contratosParaConversa();
    const r = partes ? resolverConversaPedida(pedida, conversations.map((c) => c.id), partes.contratos, partes.userId, conversationId) : null;
    if (r?.tipo === "nova") {
      const nova: Conversation = {
        id: pedida,
        name: r.papel === "proprietario" ? "Morador" : "Proprietário",
        property: r.contrato.titulo,
        preview: "",
        otherId: r.outroId,
        propertyId: r.contrato.propertyId,
        papel: r.papel,
        contratoId: r.contrato.id,
        messages: [],
      };
      lista = [nova, ...conversations];
    }
  }
  return <MessagesClient initial={lista} abrir={pedida} />;
}
