import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notifications/email";
import { consumirLimite, ipHash, HORA } from "@/lib/limites";
import { SUPORTE_EMAIL } from "@/lib/site";
import { escaparHtml, validarLeadGestor } from "@/lib/cobranca/plano-gestor-lead";

export const dynamic = "force-dynamic";

/** Lead do Plano Gestor (31+ imóveis, ordem f768b951) → e-mail ao admin. Rota pública: valida e limita por IP. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const v = validarLeadGestor(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  if (!(await consumirLimite(`plano-gestor:ip:${ipHash(request)}`, 5, HORA))) {
    return NextResponse.json(
      { error: "Recebemos vários envios seguidos. Tente de novo em alguns minutos." },
      { status: 429 },
    );
  }

  const { lead } = v;
  const campos: [string, string][] = [
    ["Nome", lead.nome],
    ["E-mail", lead.email],
    ["Telefone", lead.telefone || "—"],
    ["Imóveis ativos (estimativa)", lead.imoveis ? String(lead.imoveis) : "—"],
  ];
  const r = await sendEmail({
    to: process.env.EMPRESAS_LEAD_EMAIL ?? SUPORTE_EMAIL,
    subject: "Lead — Plano Gestor (31+ imóveis)",
    html: `<h2>Novo contato sobre o Plano Gestor</h2><p>${campos.map(([k, x]) => `${escaparHtml(k)}: ${escaparHtml(x)}`).join("<br>")}</p>`,
    text: campos.map(([k, x]) => `${k}: ${x}`).join("\n"),
  });
  return NextResponse.json({ ok: true, delivered: !r.demo });
}
