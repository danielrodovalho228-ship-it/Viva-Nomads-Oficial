import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chaveServidor, codigoAtivo, registrarMetrica } from "@/lib/data/cartoes-servidor";
import { lerRef, REF_COOKIE, REF_DIAS, valorCookieRef } from "@/lib/cartoes/compartilhar";
import { consumirLimite, ipHash, HORA } from "@/lib/limites";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Visita à página do imóvel vinda de um cartão (QR ou link). Sem login. Só atribui com assinatura certa e código
 * ativo de OUTRA conta: conta qr_scans (QR) e ref_listing_views e guarda a atribuição por 30 dias (cookie) para a
 * candidatura. Parâmetro adulterado → nada é contado nem guardado (a página abre normalmente).
 * Rota (e não ação de servidor) de propósito: gravar cookie numa ação recarrega a página e a visita contaria em laço.
 */
export async function POST(request: Request) {
  const nada = () => NextResponse.json({ atribuida: false });
  if (!(await consumirLimite(`cartao-visita:${ipHash(request)}`, 120, HORA).catch(() => true))) return nada();
  const corpo = (await request.json().catch(() => null)) as { listingId?: unknown; parametros?: unknown } | null;
  const listingId = String(corpo?.listingId ?? "");
  const parametros = corpo?.parametros && typeof corpo.parametros === "object" ? (corpo.parametros as Record<string, string>) : {};
  if (!UUID_RE.test(listingId)) return nada();
  const admin = createAdminClient();
  if (!admin) return nada();
  const p = lerRef(chaveServidor(), listingId, parametros);
  if (!p) return nada();
  const dono = await codigoAtivo(admin, p.ref);
  if (!dono) return nada();
  const supabase = await createClient();
  const visitante = supabase ? ((await supabase.auth.getUser()).data.user?.id ?? null) : null;
  if (visitante && visitante === dono.usuarioId) return nada(); // a própria pessoa conferindo o cartão
  const valor = valorCookieRef(p);
  // Mesma visita repetida (recarregar a página) não conta de novo neste aparelho.
  const jaVeio = (request.headers.get("cookie") ?? "").split(/;\s*/).some((c) => c === `${REF_COOKIE}=${encodeURIComponent(valor)}` || c === `${REF_COOKIE}=${valor}`);
  if (!jaVeio) {
    if (p.meio === "qr") await registrarMetrica(admin, "qr_scans", { cartaoTipo: p.tipo, imovelId: listingId, usuarioId: visitante, meio: "qr" });
    await registrarMetrica(admin, "ref_listing_views", { cartaoTipo: p.tipo, imovelId: listingId, usuarioId: visitante, meio: p.meio });
  }
  const res = NextResponse.json({ atribuida: true });
  res.cookies.set(REF_COOKIE, valor, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: REF_DIAS * 86_400, path: "/" });
  return res;
}
