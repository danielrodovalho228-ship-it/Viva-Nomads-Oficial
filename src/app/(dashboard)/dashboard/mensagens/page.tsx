import { listConversations } from "@/lib/data/messages";
import { MessagesClient } from "./messages-client";

export default async function MessagesPage() {
  const conversations = await listConversations();
  return <MessagesClient initial={conversations} />;
}
