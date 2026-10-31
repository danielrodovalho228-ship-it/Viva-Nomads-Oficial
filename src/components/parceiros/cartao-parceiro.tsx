import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin, ReceiptText, Star } from "lucide-react";
import { FAIXA_PARCEIRO_TESTE_EQUIPE, rotuloCategoria } from "@/lib/parceiros/regras";
import { fotoDaCategoria } from "@/config/fotos-categorias-parceiro";
import { BRAND_BLUR } from "@/lib/media";
import type { ParceiroPublico } from "@/lib/data/parceiros-publico";

/** Cartão do parceiro na busca: foto, nome, categorias, cidades e a nota real (ou "Novo na Viva"). Sem contato. */
/** `consulta`: parâmetros que seguem para a página do parceiro (ex.: o imóvel do cadastro, Prompt 31b). */
/**
 * E277 (mockup aprovado): foto no topo (16:10, igual em todos) — a capa que o parceiro enviou ou, sem capa, a foto da
 * categoria principal dele — e a foto de perfil (ou a inicial) sobre a borda da capa.
 */
export function CartaoParceiro({ p, consulta }: { p: ParceiroPublico; consulta?: string }) {
  const capaCategoria = fotoDaCategoria(p.categorias[0] ?? "");
  return (
    <li className="min-w-0">
      <Link
        href={`/parceiros/${p.slug}${consulta ? `?${consulta}` : ""}`}
        className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-white transition-colors hover:border-forest"
        data-testid="cartao-parceiro"
        data-slug={p.slug}
      >
        <span className="relative block aspect-[16/10] bg-surface-2" data-testid="cartao-parceiro-capa">
          {p.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem do bucket público, já reduzida no envio
            <img src={p.bannerUrl} alt={`Capa de ${p.nomePublico}`} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            capaCategoria && <Image src={capaCategoria.src} alt={capaCategoria.alt} fill sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" placeholder="blur" blurDataURL={BRAND_BLUR} className="object-cover" />
          )}
          <span className="absolute -bottom-6 left-4 rounded-full border-2 border-white bg-white">
            {p.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagem do bucket público, já reduzida no envio
              <img src={p.avatarUrl} alt={`Foto de ${p.nomePublico}`} width={56} height={56} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-full bg-sage-100 font-title text-xl font-semibold text-forest" aria-hidden>
                {p.nomePublico.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
        </span>
        <div className="min-w-0 flex-1 px-4 pb-4 pt-8">
          {/* E297: só a equipe (conta de teste ou admin) recebe parceiro de teste na busca; a faixa diz que o público não o vê. */}
          {p.teste && (
            <p className="mb-2 rounded-lg bg-surface-2 px-2 py-1 text-xs font-semibold text-muted" data-testid="cartao-parceiro-teste">
              {FAIXA_PARCEIRO_TESTE_EQUIPE}
            </p>
          )}
          <h3 className="truncate font-title text-base font-semibold text-ink group-hover:text-forest">{p.nomePublico}</h3>
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
          {/* E285 (folha aprovada, Tela 2): os selos de confiança do parceiro — todo parceiro publicado passou pela
              aprovação da Viva; "Emite nota fiscal" só para quem declarou (o mesmo dado do filtro). */}
          <p className="mt-2 flex flex-wrap gap-2" data-testid="cartao-parceiro-selos">
            <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-1 text-xs font-semibold text-forest" data-testid="selo-aprovado">
              <BadgeCheck className="h-4 w-4" aria-hidden /> Aprovado pela Viva
            </span>
            {p.emiteNota === true && (
              <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-1 text-xs font-semibold text-ink" data-testid="selo-nota">
                <ReceiptText className="h-4 w-4" aria-hidden /> Emite nota fiscal
              </span>
            )}
          </p>
          {p.descricaoCurta && <p className="mt-2 line-clamp-2 text-sm text-muted">{p.descricaoCurta}</p>}
        </div>
      </Link>
    </li>
  );
}
