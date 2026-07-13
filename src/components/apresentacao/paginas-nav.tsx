import Link from "next/link";

/*
  Referências cruzadas entre as páginas internas (C4 do E2E): as páginas de
  números modelam recortes diferentes do MESMO negócio — devem parecer capítulos
  de um documento, não simuladores concorrentes. Estilo autocontido (inline)
  para funcionar dentro de qualquer página, mesmo com CSS module próprio.
*/

interface PaginaRef {
  href: string;
  nome: string;
  resumo: string;
}

const PAGINAS: PaginaRef[] = [
  { href: "/modelodenegocio", nome: "Modelo de negócio", resumo: "visão do proprietário e do híbrido" },
  { href: "/simulacao", nome: "Simulação", resumo: "as 5 fontes de receita da plataforma" },
  { href: "/roi", nome: "ROI", resumo: "payback e break-even da empresa" },
  { href: "/socios", nome: "Sócios", resumo: "quem faz o quê" },
  { href: "/decisao", nome: "Decisão", resumo: "híbrido × tradicional" },
  { href: "/tributario", nome: "Tributário", resumo: "memória de cálculo PF × PJ (parecer)" },
];

/** Barra discreta com links entre as páginas internas. `atual` = href da página. */
export function PaginasInternasNav({ atual }: { atual: string }) {
  return (
    <nav
      aria-label="Documentos internos relacionados"
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "10px 18px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        fontFamily: "var(--font-inter), -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        fontSize: 12.5,
      }}
    >
      <span style={{ color: "#5c6a60", fontWeight: 700 }}>Documento interno · capítulos:</span>
      {PAGINAS.map((p) => {
        const isAtual = p.href === atual;
        return isAtual ? (
          <span
            key={p.href}
            title={p.resumo}
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              background: "#0f3d2e",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            {p.nome}
          </span>
        ) : (
          <Link
            key={p.href}
            href={p.href}
            title={p.resumo}
            style={{
              padding: "3px 10px",
              borderRadius: 999,
              border: "1px solid #e2e9e4",
              color: "#0f3d2e",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            {p.nome}
          </Link>
        );
      })}
    </nav>
  );
}
