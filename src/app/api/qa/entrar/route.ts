import { NextResponse } from "next/server";
import { ipHash } from "@/lib/limites";
import { entrarComoQa, qaLoginLigado, registrarRecusaQa } from "@/lib/qa/entrar-servidor";

export const dynamic = "force-dynamic";

/*
  QA-LOGIN-B — POST { email, chave, papel?, destino? }: a QA entra numa conta de teste (ou no admin observador) sem código por
  e-mail (docs/qa-login.md).
  Sem a chave certa (ou com a porta desligada) responde 404 com o mesmo corpo: a rota não revela que existe. E488: com
  a chave certa, a recusa vira 403 com o código da causa (o formulário diz qual). E256-B: cada 404 deixa
  UM código de motivo no log do servidor (desligada | metodo | chave | perfil | 2fa | padrao | admin_fechada).
  A chave só vem no corpo do POST; nunca na URL, nunca no log, nunca na resposta.
*/
const naoEncontrado = () => NextResponse.json({ ok: false }, { status: 404, headers: { "Cache-Control": "no-store" } });
/**
 * E488: com a chave CERTA, a recusa diz a causa específica (403 + o código: perfil, 2fa, padrao, admin_fechada, email).
 * Só quem tem a chave chega aqui; sem ela, o 404 mudo de sempre (a rota não se revela).
 */
const recusada = (motivo: string) => NextResponse.json({ ok: false, motivo }, { status: 403, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (!qaLoginLigado()) {
    registrarRecusaQa("desligada");
    return naoEncontrado();
  }
  const corpo = (await request.json().catch(() => ({}))) as { email?: unknown; chave?: unknown; papel?: unknown; destino?: unknown };
  const r = await entrarComoQa({ email: corpo.email, chave: corpo.chave, papel: corpo.papel, destino: corpo.destino }, ipHash(request));
  if (r.status === 200) return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  if (r.status === 404) return r.motivo === "chave" || r.motivo === "desligada" ? naoEncontrado() : recusada(r.motivo);
  return NextResponse.json({ ok: false }, { status: r.status, headers: { "Cache-Control": "no-store" } });
}

/** Só POST entra. Um GET aqui (link aberto no navegador, redirecionamento que virou GET) deixa "metodo" no log. */
export function GET() {
  registrarRecusaQa("metodo");
  return naoEncontrado();
}
