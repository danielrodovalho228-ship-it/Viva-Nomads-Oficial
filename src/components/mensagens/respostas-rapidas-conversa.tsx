"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { respostasDaConversaDoImovel } from "@/lib/data/respostas-actions";
import type { RespostaRapida } from "@/lib/respostas/regras";

/**
 * Prompt 55-E2 — respostas rápidas na conversa do dono: 1 toque põe o texto no campo da mensagem (o dono confere e
 * envia). A mensagem para quem vai pedir, do anúncio (61-B), vem primeiro.
 */
export function RespostasRapidasConversa({ propertyId, onEscolher }: { propertyId: string; onEscolher: (r: RespostaRapida) => void }) {
  const [aberta, setAberta] = useState(false);
  const [lista, setLista] = useState<{ propertyId: string; itens: RespostaRapida[] } | null>(null);
  useEffect(() => {
    if (!aberta || lista?.propertyId === propertyId) return;
    let vivo = true;
    respostasDaConversaDoImovel(propertyId)
      .then((itens) => vivo && setLista({ propertyId, itens }))
      .catch(() => vivo && setLista({ propertyId, itens: [] }));
    return () => {
      vivo = false;
    };
  }, [aberta, propertyId, lista?.propertyId]);
  const itens = lista?.propertyId === propertyId ? lista.itens : null;

  return (
    <div className="border-t border-sage-200 px-3 pt-2" data-testid="respostas-rapidas-conversa">
      <button
        type="button"
        onClick={() => setAberta(!aberta)}
        aria-expanded={aberta}
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest"
        data-testid="respostas-rapidas-abrir"
      >
        <MessageSquareText className="h-4 w-4" aria-hidden />
        Respostas rápidas
      </button>
      {aberta && (
        <div className="pb-2">
          {itens === null ? (
            <p className="text-xs text-muted">Carregando…</p>
          ) : itens.length === 0 ? (
            <p className="text-xs text-muted" data-testid="respostas-rapidas-vazio">
              Nenhuma resposta salva.{" "}
              <Link href="/dashboard/respostas-rapidas" className="font-semibold underline">
                Criar respostas
              </Link>
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {itens.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onEscolher(r);
                      setAberta(false);
                    }}
                    className="min-h-11 max-w-[16rem] truncate rounded-full border border-sage-200 bg-white px-4 text-sm text-ink hover:border-sage"
                    data-testid="resposta-rapida-item"
                    data-id={r.id}
                  >
                    {r.titulo}
                  </button>
                </li>
              ))}
              <li>
                <Link href="/dashboard/respostas-rapidas" className="inline-flex min-h-11 items-center px-2 text-sm text-muted underline">
                  Gerenciar
                </Link>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
