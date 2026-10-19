import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cartaoPeloCurto, urlAssinada } from "@/lib/data/cartoes-servidor";
import { curtoValido } from "@/lib/cartoes/compartilhar";
import { SITE_URL } from "@/lib/site";

/** Link curto da legenda do WhatsApp (/c/<curto>) → página do imóvel com ref + UTM + assinatura (meio "link"). */
export async function GET(_request: Request, { params }: { params: Promise<{ curto: string }> }) {
  const { curto } = await params;
  const admin = createAdminClient();
  const cartao = admin && curtoValido(curto) ? await cartaoPeloCurto(admin, curto) : null;
  if (!admin || !cartao) return NextResponse.redirect(new URL("/buscar", SITE_URL), 302);
  return NextResponse.redirect(await urlAssinada(admin, cartao, "link"), 302);
}
