"use client";

import Link from "next/link";

/**
 * Último recurso: falha no próprio layout raiz. Substitui o layout (sem o CSS global nem as fontes), então o estilo é
 * inline. Em português, com "Tentar de novo" (unstable_retry do Next 16; reset de reserva) — nunca a página padrão em
 * inglês.
 */
export default function ErroGeral({ unstable_retry, reset }: { error: unknown; unstable_retry?: () => void; reset?: () => void }) {
  const tentarDeNovo = () => (unstable_retry ?? reset)?.();
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f7f8f5", color: "#0f3d2e" }}>
        <title>Viva Nomads</title>
        <main role="alert" data-testid="erro-geral" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Não conseguimos abrir a Viva Nomads agora</h1>
          <p style={{ marginTop: 8, color: "#475569", maxWidth: 420 }}>Foi só um tropeço do nosso lado. Tente de novo em instantes.</p>
          <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button type="button" onClick={tentarDeNovo} style={{ minHeight: 44, padding: "0 18px", borderRadius: 10, border: 0, background: "#1c6b3a", color: "#fff", fontWeight: 700, fontSize: 15 }}>
              Tentar de novo
            </button>
            <Link href="/" style={{ minHeight: 44, display: "inline-flex", alignItems: "center", padding: "0 18px", borderRadius: 10, border: "1px solid #1c6b3a", color: "#1c6b3a", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
              Ir para o início
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
