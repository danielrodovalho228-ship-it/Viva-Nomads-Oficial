import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA } from "@/lib/limites";
import { conversationId } from "@/lib/messages/conversation-id";
import { BUCKET_ANEXOS, caminhoAnexo, corpoDoAnexo, erroDoAnexo, tipoDoAnexo } from "@/lib/messages/anexos";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * E445 item 5 (backend): envia uma foto ou um PDF no chat.
 * - A mensagem do anexo é gravada com o cliente DO USUÁRIO: a RLS de messages decide quem pode falar com quem (a
 *   mesma regra do texto). Sem permissão para escrever, não há anexo.
 * - O arquivo vai para o bucket PRIVADO pelo servidor (sem política para o navegador); tipo real pelos primeiros
 *   bytes, até 10 MB, hash guardado. O nome original não é guardado (pode ter contato ou dado pessoal).
 * - Qualquer falha depois da mensagem desfaz tudo (mensagem e arquivo): nada fica órfão.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return NextResponse.json({ error: "Indisponível no momento." }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const receiverId = String(form?.get("receiverId") ?? "");
  const propertyRaw = form?.get("propertyId");
  const propertyId = propertyRaw ? String(propertyRaw) : undefined;
  const file = form?.get("file");
  if (!UUID_RE.test(receiverId) || receiverId === user.id || (propertyId && !UUID_RE.test(propertyId))) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });

  // Antes de ler o arquivo inteiro: o tamanho declarado já barra o grande demais.
  if (file.size > 0) {
    const cedo = erroDoAnexo(file.size, "application/pdf");
    if (cedo) return NextResponse.json({ error: cedo }, { status: 413 });
  }
  if (!(await consumirLimite(`msg-anexo:${user.id}`, 40, DIA))) {
    return NextResponse.json({ error: "Muitos anexos hoje. Tente novamente amanhã." }, { status: 429 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const tipo = tipoDoAnexo(bytes);
  const erro = erroDoAnexo(bytes.length, tipo);
  if (erro || !tipo) return NextResponse.json({ error: erro ?? "Arquivo inválido." }, { status: bytes.length > 0 && !tipo ? 415 : 400 });

  const conversa = conversationId(user.id, receiverId, propertyId);
  const { data: msg, error: eMsg } = await supabase
    .from("messages")
    .insert({ conversation_id: conversa, sender_id: user.id, receiver_id: receiverId, property_id: propertyId ?? null, body: corpoDoAnexo(tipo) })
    .select("id, receiver_id")
    .single();
  if (eMsg || !msg) return NextResponse.json({ error: "Não foi possível enviar o anexo nesta conversa." }, { status: 403 });
  const msgId = msg.id as string;

  const hashBuf = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(hashBuf)).map((x) => x.toString(16).padStart(2, "0")).join("");
  const anexoId = crypto.randomUUID();
  const caminho = caminhoAnexo(conversa, anexoId, tipo);

  const { error: eUp } = await admin.storage.from(BUCKET_ANEXOS).upload(caminho, bytes, { contentType: tipo, upsert: false });
  if (eUp) {
    await admin.from("messages").delete().eq("id", msgId);
    return NextResponse.json({ error: "Não foi possível salvar o anexo agora." }, { status: 500 });
  }
  const { error: eReg } = await admin.from("mensagens_anexos").insert({
    id: anexoId,
    message_id: msgId,
    conversation_id: conversa,
    sender_id: user.id,
    // Destinatário pela LINHA GRAVADA (que passou na RLS), não pelo parâmetro.
    receiver_id: msg.receiver_id as string,
    caminho,
    mime: tipo,
    tamanho: bytes.length,
    hash_sha256: hash,
  });
  if (eReg) {
    await admin.storage.from(BUCKET_ANEXOS).remove([caminho]);
    await admin.from("messages").delete().eq("id", msgId);
    return NextResponse.json({ error: "Não foi possível registrar o anexo agora." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, anexoId, messageId: msgId, mime: tipo });
}
