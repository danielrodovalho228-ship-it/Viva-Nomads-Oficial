"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { decidirLinkDeVideo, type LinkPendente } from "@/lib/data/video-link-actions";

/**
 * E133 (d) — links de vídeo (YouTube/Vimeo) que o anúncio ainda NÃO mostra: a equipe assiste e aprova (o tour passa a
 * aparecer) ou recusa (continua escondido). A decisão fica no registro de moderação.
 */
export function LinksDeVideoPendentes({ links }: { links: LinkPendente[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  if (!links.length) return null;

  async function decidir(l: LinkPendente, aprovar: boolean) {
    setErro(null);
    setOcupado(l.propertyId);
    const r = await decidirLinkDeVideo(l.propertyId, l.url, aprovar).catch(() => ({ ok: false, erro: "Sem conexão. Tente de novo." }));
    setOcupado(null);
    if (!r.ok) return setErro(r.erro ?? "Não foi possível agora.");
    router.refresh();
  }

  return (
    <section className="mb-6 rounded-xl border border-line bg-white p-4" data-testid="admin-links-video">
      <h2 className="text-base font-semibold text-ink">Vídeos por link para conferir ({links.length})</h2>
      <p className="mt-1 text-sm text-muted">O anúncio só mostra o vídeo depois da aprovação. Abra o link e confira se mostra o imóvel.</p>
      <ul className="mt-3 divide-y divide-line">
        {links.map((l) => (
          <li key={l.propertyId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm" data-testid="admin-link-video" data-imovel={l.propertyId}>
            <span className="min-w-0">
              <span className="block font-semibold text-ink">{l.titulo}</span>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="block break-all text-forest underline">
                {l.url}
              </a>
            </span>
            <span className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={ocupado === l.propertyId} onClick={() => void decidir(l, true)} data-testid="admin-link-video-aprovar">
                Aprovar
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={ocupado === l.propertyId} onClick={() => void decidir(l, false)} data-testid="admin-link-video-recusar">
                Recusar
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {erro}
        </p>
      )}
    </section>
  );
}
