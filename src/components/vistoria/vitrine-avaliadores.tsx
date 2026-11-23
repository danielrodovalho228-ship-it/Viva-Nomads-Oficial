import Link from "next/link";
import { MapPin, Search, ShieldCheck, Star } from "lucide-react";
import { PLACEHOLDER_BUSCA_CIDADE, ROTULO_VER_PERFIL, TEXTO_IDENTIDADE_VERIFICADA, TITULO_NOVO_NA_VIVA, TITULO_VITRINE, linhaDaCidade, novoNaViva, textoAvaliacoes, type CartaoAvaliador } from "@/lib/vistoria/vitrine-avaliadores";

/**
 * E1080 (ORDEM-DUET-385/386): a listagem pública de avaliadores de uma cidade, no desenho dos mockups aprovados
 * (docs/mockups-avaliadores/publico-avaliadores-{mobile,desktop}.webp): título "Avaliadores em <cidade>", a busca por
 * cidade e os cartões — foto da conta (ou iniciais no círculo), nome, selo / "Novo na Viva" ou as avaliações, a cidade e
 * "Ver perfil". Dentro da guarda de estilo (Prompt 45). Sem telefone nem e-mail.
 */
export function VitrineAvaliadores({ cidade, uf, cartoes }: { cidade: string; uf: string | null; cartoes: CartaoAvaliador[] }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8" data-testid="vitrine-avaliadores">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
        <h1 className="font-title text-2xl font-semibold text-ink" data-testid="vitrine-titulo">{TITULO_VITRINE(cidade)}</h1>
        <form action="/avaliadores/busca" className="relative" role="search">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-forest" aria-hidden />
          <input
            name="cidade"
            type="search"
            placeholder={PLACEHOLDER_BUSCA_CIDADE}
            aria-label={PLACEHOLDER_BUSCA_CIDADE}
            className="w-full rounded-xl border border-line bg-white py-3 pl-12 pr-4 text-base text-ink"
            data-testid="vitrine-busca"
          />
        </form>
      </div>
      {cartoes.length === 0 ? (
        <p className="mt-8 text-base text-muted" data-testid="vitrine-vazia">Ainda não há avaliadores em {cidade}.</p>
      ) : (
        <ul className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
          {cartoes.map((c) => (
            <CartaoVitrine key={c.numero} c={c} cidade={cidade} uf={uf} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CartaoVitrine({ c, cidade, uf }: { c: CartaoAvaliador; cidade: string; uf: string | null }) {
  const novo = novoNaViva(c.avaliacoesFeitas, c.notaConduta);
  return (
    <li className="flex gap-4 rounded-xl border border-line bg-white p-4 sm:flex-col sm:items-center sm:text-center" data-testid="vitrine-cartao" data-numero={c.numero}>
      {c.rosto.tipo === "foto" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.rosto.url} alt={`Foto de ${c.nome}`} className="h-24 w-24 shrink-0 rounded-full object-cover" data-testid="vitrine-foto" />
      ) : (
        <span className="inline-grid h-24 w-24 shrink-0 place-items-center rounded-full bg-forest font-title text-2xl font-semibold text-white" data-testid="vitrine-iniciais" aria-hidden>
          {c.rosto.texto}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:items-center">
        <p className="font-title text-xl font-semibold text-ink" data-testid="vitrine-nome">{c.nome}</p>
        <div className="flex flex-wrap gap-2 sm:justify-center">
          {c.selo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-champagne px-3 py-1 text-sm font-semibold text-forest-700" data-testid="vitrine-selo">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
              {c.selo}
            </span>
          )}
          {novo && <span className="inline-flex items-center rounded-full bg-sage-100 px-3 py-1 text-sm text-forest-700" data-testid="vitrine-novo">{TITULO_NOVO_NA_VIVA}</span>}
        </div>
        {!novo && (
          <p className="inline-flex items-center gap-1 text-sm text-ink" data-testid="vitrine-avaliacoes">
            {c.notaConduta != null && <span className="font-semibold">{c.notaConduta.toLocaleString("pt-BR")}</span>}
            {c.notaConduta != null && <span aria-hidden>·</span>}
            {textoAvaliacoes(c.avaliacoesFeitas)}
            <Star className="h-4 w-4 shrink-0" aria-hidden />
          </p>
        )}
        <p className="inline-flex items-center gap-1 text-sm text-muted">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          {linhaDaCidade(cidade, uf)}
        </p>
        {/* E1099 parte 3 (ORDEM-463 §1): só com a identidade da conta confirmada; o texto é o da fonte única. */}
        {c.identidadeVerificada && (
          <p className="inline-flex items-center gap-1 text-sm font-semibold text-forest-700" data-testid="vitrine-identidade">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            {TEXTO_IDENTIDADE_VERIFICADA}
          </p>
        )}
        <Link href={c.href} className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-forest px-4 py-2 text-base font-semibold text-forest" data-testid="vitrine-ver-perfil">
          {ROTULO_VER_PERFIL}
        </Link>
      </div>
    </li>
  );
}
