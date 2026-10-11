import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { consumirLimite, ipHash, HORA } from "@/lib/limites";
import { validarInteresse } from "@/lib/parceiros/interesse";

export const dynamic = "force-dynamic";

/** "Quero ser parceiro" (ordem a437a6d6). Rota pública que escreve: valida, limita por IP e grava pela RLS (anon só insere). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const v = validarInteresse(body);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
  if (v.descartar) return NextResponse.json({ ok: true });

  if (!(await consumirLimite(`parceiros:ip:${ipHash(request)}`, 5, HORA))) {
    return NextResponse.json({ error: "Recebemos vários envios seguidos. Tente de novo em alguns minutos." }, { status: 429 });
  }

  const supabase = createPublicClient();
  if (!supabase) return NextResponse.json({ error: "Indisponível agora. Tente de novo mais tarde." }, { status: 503 });
  const { error } = await supabase.from("parceiros_interesse").insert({ ...v.dados, aceite_contato: true });
  if (error) {
    console.error("[parceiros-interesse]", error.code);
    return NextResponse.json({ error: "Não foi possível enviar agora. Tente de novo em instantes." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
