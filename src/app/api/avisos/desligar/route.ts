import { NextResponse } from "next/server";
import { desligarSugestoesPorLink } from "@/lib/data/descadastro-servidor";

/*
  E264-B — descadastro de UM clique (RFC 8058): o provedor de e-mail faz POST nesta URL (List-Unsubscribe +
  List-Unsubscribe-Post: List-Unsubscribe=One-Click). Sem login: vale a assinatura do link. Desliga só a categoria
  "Sugestões e novidades". O GET (alguém abriu o endereço) leva à página com confirmação.
*/

function params(request: Request): { u: string; t: string } {
  const url = new URL(request.url);
  return { u: url.searchParams.get("u") ?? "", t: url.searchParams.get("t") ?? "" };
}

export async function POST(request: Request) {
  const { u, t } = params(request);
  const ok = await desligarSugestoesPorLink(u, t);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

export async function GET(request: Request) {
  const { u, t } = params(request);
  const destino = new URL("/avisos/desligar", request.url);
  destino.searchParams.set("u", u);
  destino.searchParams.set("t", t);
  return NextResponse.redirect(destino, 303);
}
