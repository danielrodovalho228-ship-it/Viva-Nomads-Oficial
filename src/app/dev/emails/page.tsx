import type { Metadata } from "next";
import { sampleEmails, notificationSamples } from "@/lib/notifications/templates";

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

  const groups = [
    { title: "Transacionais (Resend · notify)", items: notificationSamples() },
    { title: "Autenticação (Supabase Auth · artes)", items: sampleEmails() },
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
