import type { Metadata } from "next";
import { sampleEmails, brandedNotification } from "@/lib/notifications/templates";
import { buildLeadNotification } from "@/lib/leads";
import { SITE_URL } from "@/lib/site";

// Preview NUNCA deve ser indexado nem exposto por engano.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Preview visual de TODOS os e-mails (Fase 3.1). Renderiza cada arte num iframe
 * isolado (cada e-mail é um documento HTML completo). Contém só template com
 * dados fictícios — nenhum dado real. Ainda assim, é protegido: em produção
 * exige `?key=` igual a TEST_ROUTES_KEY; em dev, abre livre.
 */
export default async function DevEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const expected = process.env.TEST_ROUTES_KEY;
  const isProd = process.env.NODE_ENV === "production";
  const allowed = !isProd || (!!expected && key === expected);

  if (!allowed) {
    return (
      <main style={{ fontFamily: "system-ui", padding: 40, maxWidth: 640, margin: "0 auto" }}>
        <h1>Preview de e-mails</h1>
        <p>
          Protegido. Em produção, defina <code>TEST_ROUTES_KEY</code> e acesse com{" "}
          <code>?key=sua-chave</code>.
        </p>
      </main>
    );
  }

  // Notificações transacionais de produção (mesmo template do notify()).
  const lead = buildLeadNotification("candidatura", "Studio no Centro", { name: "Ana Carvalho" });
  const dashboardCta = { label: "Abrir no Viva Nomads", url: `${SITE_URL}/dashboard` };

  const notifs: { key: string; subject: string; html: string }[] = [
    {
      key: "novo-interessado",
      subject: "Novo interessado no seu imóvel",
      html: brandedNotification({
        title: "Novo interessado no seu imóvel",
        intro: "Olá Marcos, você recebeu um novo interessado no Viva Nomads.",
        detailsHtml: lead.detailsHtml,
      }),
    },
    {
      key: "nova-mensagem",
      subject: "Você tem uma nova mensagem no Viva Nomads",
      html: brandedNotification({
        title: "Você tem uma nova mensagem",
        intro: "Olá Marcos, você recebeu uma nova mensagem no Viva Nomads.",
        detailsHtml:
          `<p style="margin:0 0 6px"><strong>Ana</strong> escreveu:</p>` +
          `<blockquote style="margin:8px 0;padding:8px 12px;border-left:3px solid #1e63d0;color:#374151">Oi! O imóvel ainda está disponível para setembro?</blockquote>` +
          `<p style="margin:12px 0 0"><a href="${SITE_URL}/dashboard/mensagens" style="display:inline-block;background:#1e63d0;color:#fff;padding:11px 20px;border-radius:999px;text-decoration:none;font-weight:600">Ler e responder</a></p>`,
      }),
    },
    {
      key: "candidatura-recebida",
      subject: "Candidatura recebida",
      html: brandedNotification({
        title: "Candidatura recebida",
        intro: "Recebemos sua candidatura. O proprietário foi notificado.",
        cta: dashboardCta,
      }),
    },
    {
      key: "pedido-resposta",
      subject: "Um proprietário respondeu ao seu pedido",
      html: brandedNotification({
        title: "Um proprietário respondeu ao seu pedido",
        intro:
          "Olá Ana, um proprietário respondeu ao seu pedido de moradia com um imóvel. Veja e aceite para conversar.",
        cta: { label: "Ver a resposta", url: `${SITE_URL}/dashboard/pedidos` },
      }),
    },
  ];

  const auth = sampleEmails();
  const groups = [
    { title: "Transacionais (Resend · notify)", items: notifs },
    { title: "Autenticação (Supabase Auth · artes)", items: auth },
  ];

  return (
    <main style={{ fontFamily: "system-ui", background: "#eef1f5", padding: "24px 16px", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Preview de e-mails · Viva Nomads</h1>
        <p style={{ color: "#5b6573", margin: "0 0 24px", fontSize: 14 }}>
          Dados fictícios. Cada e-mail sai também em versão texto puro (multipart) no envio real.
        </p>
        {groups.map((g) => (
          <section key={g.title} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, margin: "0 0 12px", color: "#143c8c" }}>{g.title}</h2>
            <div
              style={{
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              }}
            >
              {g.items.map((e) => (
                <div key={e.key} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #e2e7ee" }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #eef2f1", fontSize: 12, fontWeight: 700, color: "#0f1722" }}>
                    {e.subject}
                  </div>
                  <iframe
                    title={e.key}
                    srcDoc={e.html}
                    style={{ width: "100%", height: 480, border: 0, background: "#fff" }}
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
