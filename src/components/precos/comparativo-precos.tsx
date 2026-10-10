import Link from "next/link";
import { Check, Scale } from "lucide-react";
import { COMPARE_ALUGUEL, COMPARE_CONTRATO, COMPARE_MESES, COMPARE_RODAPE, DIFERENCIAIS_VIVA, linhasPublicas, type LinhaCompare } from "@/config/compare-precos";
import { reaisInteiros } from "@/config/planos";
import { pctTexto } from "@/lib/cobranca/regra";

/**
 * "Compare" — regra única de 12% × o que o mercado cobra. Números só de
 * config/compare-precos.ts; cada linha exibida tem fonte e data conferidas.
 */

function dataBR(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const aprox = (p: number) => `≈ ${pctTexto(p)}`;

function Fonte({ l }: { l: LinhaCompare }) {
  if (!l.fonte || !l.conferidoEm) return null;
  const interna = l.fonte.url.startsWith("/");
  return (
    <>
      {interna ? (
        <Link href={l.fonte.url} className="underline">{l.fonte.nome}</Link>
      ) : (
        <a href={l.fonte.url} target="_blank" rel="noopener noreferrer" className="underline">{l.fonte.nome}</a>
      )}
      , conferido em {dataBR(l.conferidoEm)}
    </>
  );
}

export function ComparativoPrecos({ variante = "completo" }: { variante?: "completo" | "curto" }) {
  const linhas = linhasPublicas();
  const viva = linhas.find((l) => l.id === "viva")!;
  const airbnb = linhas.find((l) => l.id === "airbnb");

  if (variante === "curto") {
    return (
      <div className="rounded-2xl border border-sage-200 bg-white p-5 text-ink">
        <p className="flex items-center gap-2 font-title text-lg font-bold">
          <Scale className="h-5 w-5 text-forest" aria-hidden /> Quanto você paga
        </p>
        <p className="mt-2 text-sm text-muted">
          Reserva de {COMPARE_MESES} meses a {reaisInteiros(COMPARE_ALUGUEL)} por mês ({reaisInteiros(COMPARE_CONTRATO)} no contrato):
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 text-center sm:grid-cols-2">
          <div className="rounded-xl bg-sage-100 p-3">
            <p className="text-xs text-muted">Viva Nomads (reserva de 3 meses)</p>
            <p className="font-title text-2xl font-bold text-forest">{aprox(viva.pct ?? 0)}</p>
            <p className="text-xs text-muted">do total, menor com mais imóveis</p>
          </div>
          {airbnb && (
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-xs text-muted">Airbnb (taxa sobre o período)</p>
              <p className="font-title text-2xl font-bold text-ink">{aprox(airbnb.pct ?? 0)}</p>
              <p className="text-xs text-muted">do total pago</p>
            </div>
          )}
        </div>
        <p className="mt-3 text-sm">
          <Link href="/precos#compare" className="web-only font-medium text-forest underline">
            Ver a comparação completa
          </Link>
        </p>
        <p className="mt-3 text-xs text-muted">{COMPARE_RODAPE}</p>
      </div>
    );
  }

  return (
    <section id="compare" className="rounded-3xl border border-sage-200 bg-white p-5 shadow-sm sm:p-8" aria-labelledby="compare-titulo">
      <h2 id="compare-titulo" className="flex items-center gap-2 font-title text-2xl font-bold text-ink">
        <Scale className="h-6 w-6 text-forest" aria-hidden /> Compare
      </h2>
      <p className="mt-1 text-sm text-muted">
        Reserva de {COMPARE_MESES} meses a {reaisInteiros(COMPARE_ALUGUEL)} por mês ({reaisInteiros(COMPARE_CONTRATO)} no total). Os percentuais são sobre o total pago pelo morador, no formato típico de cada empresa.
      </p>
      <ul className="mt-5 grid gap-3 md:grid-cols-2">
        {linhas.map((l) => (
          <li key={l.id} className={l.id === "viva" ? "rounded-2xl border border-forest bg-sage-100 p-4 ring-1 ring-forest" : "rounded-2xl border border-line bg-surface-2 p-4"}>
            <p className="text-sm font-semibold text-ink">{l.nome}</p>
            {l.pct !== null && <p className="mt-1 font-title text-2xl font-bold text-ink">{aprox(l.pct)}</p>}
            <p className="mt-1 text-sm text-muted">{l.regra}</p>
            <p className="mt-2 text-xs text-muted">Fonte: <Fonte l={l} /></p>
          </li>
        ))}
      </ul>
      <h3 className="mt-8 font-title text-lg font-bold text-ink">O que a Viva entrega além do preço</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="diferenciais-viva">
        {DIFERENCIAIS_VIVA.map((d) => (
          <li key={d} className="flex items-start gap-2 text-sm text-ink">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden /> {d}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">{COMPARE_RODAPE}</p>
    </section>
  );
}

/** Linha da etapa de preço do Anunciar: "Você paga R$ X uma vez." */
export function LinhaComparativoAnuncio({ aluguel }: { aluguel: number }) {
  if (!(aluguel > 0)) return null;
  const valor = Math.round(aluguel * 12) / 100;
  return (
    <p className="rounded-lg bg-sage-100 px-3 py-2 text-xs text-ink" data-testid="linha-comparativo">
      Neste valor mensal, a taxa é de <strong>{brl(valor)} uma vez</strong> (12% do primeiro mês para quem tem 1 ou 2 imóveis; menor com mais imóveis), só quando a reserva é fechada.{" "}
      <Link href="/precos" className="web-only font-medium text-forest underline">
        Ver preços
      </Link>
    </p>
  );
}
