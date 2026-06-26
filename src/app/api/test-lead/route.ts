import { NextResponse } from "next/server";
import { notify, isEmailConfigured } from "@/lib/notifications";
import { buildLeadNotification, type LeadKind } from "@/lib/leads";
import { testRouteForbidden } from "@/lib/test-guard";

/**
 * Simula o aviso de lead que o PROPRIETÁRIO recebe quando alguém clica nos
 * botões do imóvel (Candidatar-se / Tirar dúvida / Agendar visita). Envia o
 * MESMO e-mail que a server action `requestLead` dispara — para revisar o que
 * chega na caixa de entrada.
 *
 * Uso (no deploy, com RESEND configurado):
 *   GET /api/test-lead?to=voce@x                  → 1 e-mail (dúvida)
 *   GET /api/test-lead?to=voce@x&kind=visita      → pedido de visita
 *   GET /api/test-lead?to=voce@x&kind=candidatura → candidatura
 *   GET /api/test-lead?to=voce@x&all=1            → um de cada (3 e-mails)
 */
const KINDS: LeadKind[] = ["duvida", "visita", "candidatura"];

export async function GET(request: Request) {
  const blocked = testRouteForbidden(request);
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to") ?? "dtrodovalho40@gmail.com";
  const all = searchParams.get("all") === "1";
  const kindParam = (searchParams.get("kind") ?? "duvida") as LeadKind;
  const title = searchParams.get("title") ?? "Studio premium no Centro";

  if (!isEmailConfigured()) {
    return NextResponse.json({
      ok: false,
      demo: true,
      message:
        "RESEND não configurado. Acesse esta rota no site publicado (com RESEND_API_KEY na Vercel) para enviar o aviso de lead.",
      to,
    });
  }

  // Interessado fictício (no app real, são os dados do inquilino logado).
  const tenant = {
    name: "Maria Teste (simulação)",
    email: "interessado.teste@vivanomads.com.br",
    phone: "(34) 99999-0000",
  };

  const kinds = all ? KINDS : [KINDS.includes(kindParam) ? kindParam : "duvida"];
  const sent = [];
  for (const kind of kinds) {
    const { detailsHtml, detailsText } = buildLeadNotification(kind, title, tenant);
    const r = await notify({
      event: "new_lead",
      email: to,
      detailsHtml,
      detailsText,
      name: "Proprietário",
    });
    sent.push({ kind, email: r.email, whatsapp: r.whatsapp });
  }

  return NextResponse.json({
    ok: sent.every((s) => s.email === true || s.email === "demo"),
    to,
    count: sent.length,
    sent,
    dica: "Para receber os 3 tipos de uma vez, use &all=1.",
  });
}
