import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import { rotuloCategoria } from "@/lib/parceiros/regras";
import type { ParceiroPublico } from "@/lib/data/parceiros-publico";

/** Cartão do parceiro na busca: foto, nome, categorias, cidades e a nota real (ou "Novo na Viva"). Sem contato. */
/** `consulta`: parâmetros que seguem para a página do parceiro (ex.: o imóvel do cadastro, Prompt 31b). */
export function CartaoParceiro({ p, consulta }: { p: ParceiroPublico; consulta?: string }) {
  return (
    <li className="min-w-0">
      <Link
        href={`/parceiros/${p.slug}${consulta ? `?${consulta}` : ""}`}
        className="flex h-full gap-4 rounded-xl border border-line bg-white p-4 transition "
        data-testid="cartao-parceiro"
        data-slug={p.slug}
      >
        {p.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem do bucket público, já reduzida no envio
          <img src={p.avatarUrl} alt={`Foto de ${p.nomePublico}`} width={64} height={64} className="h-16 w-16 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-sage-100 font-title text-xl font-semibold text-forest" aria-hidden>
            {p.nomePublico.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-title text-base font-semibold text-ink">{p.nomePublico}</h3>
          <p className="mt-1 text-sm text-muted">{p.categorias.map(rotuloCategoria).join(" · ")}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-ink">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden /> <span className="truncate">{p.cidades.join(", ")}</span>
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm text-ink" data-testid="cartao-parceiro-nota">
            {p.avaliacoesQtd > 0 && p.notaMedia ? (
              <>
                <Star className="h-4 w-4 shrink-0 text-amber-500" aria-hidden /> {p.notaMedia.toFixed(1)} ({p.avaliacoesQtd})
              </>
            ) : (
              <span className="rounded-full bg-sage-100 px-2 py-1 text-xs font-semibold text-forest">Novo na Viva</span>
            )}
          </p>
          {p.descricaoCurta && <p className="mt-2 line-clamp-2 text-sm text-muted">{p.descricaoCurta}</p>}
        </div>
      </Link>
    </li>
  );
}
