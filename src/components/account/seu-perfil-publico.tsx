"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { meuPerfilPublico, type MeuPerfilPublico } from "@/lib/data/papeis-actions";

/** O que nunca aparece para os outros (Prompt 43, item 2). */
export const NUNCA_APARECE = "CPF ou CNPJ, telefone, e-mail, documentos e dados fiscais";

/**
 * "Seu perfil público" (Prompt 43, item 2): mostra exatamente o que os outros veem — nome curto, foto, cidade, frase,
 * idiomas, avaliações e selos. Documentos, contatos e dados fiscais nunca aparecem.
 */
export function SeuPerfilPublico() {
  const [p, setP] = useState<MeuPerfilPublico | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    meuPerfilPublico()
      .then((r) => vivo && setP(r))
      .catch(() => vivo && setP(null));
    return () => {
      vivo = false;
    };
  }, []);
  if (p === undefined) return null;
  if (p === null) return <p className="text-sm text-muted">Não foi possível ler seu perfil agora. Recarregue a página.</p>;
  return (
    <section className="rounded-xl border border-line bg-white p-4 sm:p-6" data-testid="seu-perfil-publico">
      <div className="flex items-center gap-4">
        <Avatar name={p.nome} size={64} photoUrl={p.fotoUrl ?? undefined} />
        <div className="min-w-0">
          <p className="font-title text-lg font-semibold text-ink" data-testid="perfil-publico-nome">{p.nome}</p>
          {p.cidade && <p className="text-sm text-muted">{p.cidade}</p>}
          {p.desde && <p className="text-sm text-muted">Na Viva desde {new Date(p.desde).getFullYear()}</p>}
        </div>
      </div>
      {p.bio && <p className="mt-4 text-sm text-ink">{p.bio}</p>}
      <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted">Avaliações</dt>
          <dd className="flex items-center gap-1 font-semibold text-ink">
            {p.avaliacoes.n ? (
              <>
                <Star className="h-4 w-4" aria-hidden /> {p.avaliacoes.media.toLocaleString("pt-BR")} · {p.avaliacoes.n}
              </>
            ) : (
              "Ainda sem avaliações"
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted">Idiomas que fala</dt>
          <dd className="text-right font-semibold text-ink">{p.idiomas.length ? p.idiomas.join(", ") : "Não informado"}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted">Selos</dt>
          <dd className="text-right font-semibold text-ink">{p.selos.length ? p.selos.join(" · ") : "Nenhum ainda"}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-muted" data-testid="perfil-publico-nunca">
        Nunca aparece para os outros: {NUNCA_APARECE}.
      </p>
      {p.href && (
        <Link href={p.href} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-ink underline underline-offset-4 hover:text-forest">
          Abrir a sua página pública
        </Link>
      )}
    </section>
  );
}
