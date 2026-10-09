import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumirLimite, HORA } from "@/lib/limites";
import { destinoPonteValido, emitirTokenPonte } from "@/lib/app/ponte";

/**
 * Ponte app → navegador (ordem bc09134e, parte 1: EMISSÃO). Só quem está logado pede; o destino é
 * um caminho interno da lista de src/lib/app/ponte.ts; o token vale 60 s e uma vez. A troca do
 * token pela sessão no navegador é a parte 2. Resposta sem detalhes internos; token nunca vai a log.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { destino?: unknown };
  const destino = destinoPonteValido(body.destino);
  if (!destino) return NextResponse.json({ error: "Destino inválido." }, { status: 400 });

  // Rota pública que escreve (consome limite): no máximo 20 por hora por conta.
  if (!(await consumirLimite(`ponte-emitir:${user.id}`, 20, HORA))) {
    return NextResponse.json({ error: "Muitas tentativas. Tente de novo em instantes." }, { status: 429 });
  }

  const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const emitido = emitirTokenPonte(user.id, destino, new Date(), segredo);
  if (!emitido) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });

  return NextResponse.json({ token: emitido.token, expira: emitido.expira }, { headers: { "Cache-Control": "no-store" } });
}
