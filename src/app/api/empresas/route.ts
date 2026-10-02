import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/notifications/email";

export const dynamic = "force-dynamic";

/** Lead B2B (mobilidade corporativa) → e-mail ao admin. Sem prometer feature. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { nome, empresa, email, volumeAno, mensagem } = body as {
    nome?: string;
    empresa?: string;
    email?: string;
    volumeAno?: string;
    mensagem?: string;
  };

  const n = (nome ?? "").trim();
  const e = (empresa ?? "").trim();
  const mail = (email ?? "").trim();
  if (!n || !e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) {
    return NextResponse.json(
      { error: "Preencha nome, empresa e um e-mail válido." },
      { status: 400 }
    );
  }

  const to =
    process.env.EMPRESAS_LEAD_EMAIL ??
    process.env.DEMO_OWNER_EMAIL ??
    "contato@vivanomads.com.br";

  const esc = (s: string) =>
    s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] ?? c));
  const campos: [string, string][] = [
    ["Nome", n],
    ["Empresa", e],
    ["E-mail", mail],
    ["Volume/ano", (volumeAno ?? "").trim() || "—"],
    ["Mensagem", (mensagem ?? "").trim().slice(0, 2000) || "—"],
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
  return NextResponse.json({ ok: true, delivered: !r.demo });
}
