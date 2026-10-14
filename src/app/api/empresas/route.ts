import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notifications/email";
import { consumirLimite, ipHash, HORA } from "@/lib/limites";
import { SUPORTE_EMAIL } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushParaCeo } from "@/lib/notifications/push-admins";
import { validarLead, gravarLead } from "@/lib/empresas-lead";

export const dynamic = "force-dynamic";

/** Lead B2B (mobilidade corporativa) → grava no banco, avisa o Daniel e manda e-mail. Sem prometer feature. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const lead = validarLead(body);
  if (!lead) {
    return NextResponse.json(
      { error: "Preencha nome, empresa e um e-mail válido." },
      { status: 400 }
    );
  }
  const { nome: n, empresa: e, email: mail } = lead;

  // Endereço da EMPRESA (nunca um e-mail pessoal de fallback).
  // Anti-spam: 5 envios por hora por IP (cada envio é um e-mail).
  if (!(await consumirLimite(`empresas:ip:${ipHash(request)}`, 5, HORA))) {
    return NextResponse.json(
      { error: "Recebemos vários envios seguidos. Tente de novo em alguns minutos." },
      { status: 429 }
    );
  }

  // Guarda o contato no banco (só admin lê) e avisa só o Daniel; ambos best-effort: o e-mail abaixo segue.
  const gravou = await gravarLead(createAdminClient(), lead);
  if (gravou) {
    await pushParaCeo({ title: "Novo contato de empresa", body: `${e} quer falar com a Viva.`, url: "/admin" }).catch(() => 0);
  }

  const to = process.env.EMPRESAS_LEAD_EMAIL ?? SUPORTE_EMAIL;

  const esc = (s: string) =>
    s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] ?? c));
  const campos: [string, string][] = [
    ["Nome", n],
    ["Empresa", e],
    ["E-mail", mail],
    ["Volume/ano", lead.volume_ano ?? "—"],
    ["Mensagem", lead.mensagem ?? "—"],
  ];

  const r = await sendEmail({
    to,
    subject: `Lead B2B — ${e}`,
    html: `<h2>Novo contato corporativo</h2><p>${campos
      .map(([k, v]) => `${esc(k)}: ${esc(v)}`)
      .join("<br>")}</p>`,
    text: campos.map(([k, v]) => `${k}: ${v}`).join("\n"),
  });

  // Sem e-mail configurado (demo/preview), não falha o fluxo: confirma o recebido.
  return NextResponse.json({ ok: true, delivered: !r.demo, saved: gravou });
}
