import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { coverPhoto } from "@/lib/media";
import { formatBRL } from "@/lib/utils";

/**
 * Linha de imóvel com MINIATURA da foto de capa (56px, cantos arredondados) +
 * título + preço/mês + seta. Toda a linha é clicável e abre a página do imóvel.
 * Padrão único para as listas de imóveis do painel que não tinham imagem.
 *
 * `demo`: imóveis de demonstração não têm página real (/imoveis/demo-* daria
 * 404) — nesse caso a linha não vira link (some a seta), mas mantém a miniatura.
 */
export function PropertyRow({
  id,
  title,
  monthlyPrice,
  neighborhood,
  photos,
  demo = false,
}: {
  id: string;
  title: string;
  monthlyPrice: number;
  neighborhood?: string;
  photos?: string[];
  demo?: boolean;
}) {
  const inner = (
    <>
      <Image
        src={coverPhoto(id, photos)}
        alt=""
        width={56}
        height={56}
        className="h-14 w-14 shrink-0 rounded-xl object-cover"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{title}</span>
        <span className="block text-sm font-semibold text-forest">
          {formatBRL(monthlyPrice)}
          <span className="font-normal text-muted">/mês</span>
          {neighborhood ? <span className="font-normal text-muted"> · {neighborhood}</span> : null}
        </span>
      </span>
      {!demo && <ChevronRight className="h-5 w-5 shrink-0 text-muted" />}
    </>
  );

  if (demo) {
    return <div className="flex items-center gap-3 py-2.5">{inner}</div>;
  }

  return (
    <Link
      href={`/imoveis/${id}`}
      className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2"
    >
      {inner}
    </Link>
  );
}
