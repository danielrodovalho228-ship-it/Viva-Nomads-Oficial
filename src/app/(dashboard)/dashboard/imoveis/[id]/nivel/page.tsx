import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { nivelDoMeuImovel } from "@/lib/data/nivel-actions";
import { AREAS, ROTULO_AREA, ROTULO_NIVEL, ROTULO_PONTO, rotuloItem, type NivelOuAdequacao } from "@/config/niveis";
import { FormNivel } from "./form-nivel";
import { BlocoAvaliacaoDono } from "@/components/vistoria/bloco-avaliacao-dono";

export const dynamic = "force-dynamic";

const rotulo = (n: NivelOuAdequacao) => (n === "em_adequacao" ? "Em adequação" : ROTULO_NIVEL[n]);

/**
 * Adendo 59.1 — nível do imóvel (Essencial / Conforto / Premium), ruído e extras. O nível é o da área mais fraca;
 * Conforto e Premium só contam com a foto de cada item. Nível não é selo e não muda a taxa nem a posição na busca.
 */
export default async function NivelDoImovelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = await nivelDoMeuImovel(id);
  return (
    <div>
      <Link href="/dashboard/imoveis" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Meus imóveis
      </Link>
      <h1 className="mt-3 font-title text-2xl font-semibold text-ink">Nível, ruído e extras</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        O nível é o da área mais fraca. Conforto e Premium contam com uma foto de cada item. O Essencial é o{" "}
        <Link href={`/dashboard/imoveis/${id}/conforto`} className="text-forest underline">
          padrão mínimo
        </Link>
        .
      </p>
      {dados ? (
        <div className="mt-6 max-w-3xl space-y-6">
          <section className="rounded-xl border border-line bg-white p-4" data-testid="nivel-resumo">
            <p className="text-sm text-ink">
              Nível do imóvel:{" "}
              <strong data-testid="nivel-atual" data-nivel={dados.resultado.nivel}>
                {rotulo(dados.resultado.nivel)}
              </strong>
            </p>
            <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              {AREAS.map((a) => (
                <li key={a} className="flex justify-between gap-2" data-testid={`nivel-area-${a}`} data-nivel={dados.resultado.porArea[a]}>
                  <span className="text-muted">{ROTULO_AREA[a]}</span>
                  <span className="text-ink">{rotulo(dados.resultado.porArea[a])}</span>
                </li>
              ))}
            </ul>
            {Object.keys(dados.resultado.faltaParaProximo).length > 0 && (
              <div className="mt-3 text-xs text-muted" data-testid="nivel-falta">
                <p className="font-semibold text-ink">Para subir de nível</p>
                <ul className="mt-1 space-y-1">
                  {AREAS.filter((a) => dados.resultado.faltaParaProximo[a]).map((a) => (
                    <li key={a}>
                      {ROTULO_AREA[a]}: {dados.resultado.faltaParaProximo[a]!.map(rotuloItem).join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-3 text-xs text-muted" data-testid="nivel-medidas">
              Internet medida:{" "}
              {dados.medidas.length
                ? dados.medidas.map((m) => `${ROTULO_PONTO[m.ponto]} ${Math.round(m.downloadMbps)}/${Math.round(m.uploadMbps)} Mbps`).join(" · ")
                : "nenhuma medição válida por ponto. Meça no quarto principal e no ponto de trabalho pela edição do anúncio."}
            </p>
          </section>
          <FormNivel propertyId={id} dados={dados} />
          {/* Prompt 62-B1: avaliação por avaliador credenciado (só com VISTORIA_ATIVA; a rota por foto acima continua grátis). */}
          <BlocoAvaliacaoDono propertyId={id} />
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-line bg-white p-4 text-sm text-ink" data-testid="nivel-indisponivel">
          Imóvel não encontrado.
        </p>
      )}
    </div>
  );
}
