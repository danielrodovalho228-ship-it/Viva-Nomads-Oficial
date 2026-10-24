import { ScanSearch } from "lucide-react";
import { dataBRT, instanteBRT } from "@/lib/datas-brasilia";
import { resumoDeteccaoAdmin } from "@/lib/fotos/deteccao-admin";
import { estimativaCusto } from "@/lib/fotos/deteccao";

/**
 * DETECTA-B — contador do admin: fotos da galeria analisadas por dia (últimos 7 dias) e o custo estimado do período.
 * Sem dado de pessoa: só contagem. Antes da migração 0239 (ou sem banco), não aparece.
 */
export async function ContadorDeteccao() {
  const r = await resumoDeteccaoAdmin().catch(() => null);
  if (!r) return null;
  const total = r.porDia.reduce((t, d) => t + d.fotos, 0);
  const custo = estimativaCusto();
  return (
    <section className="rounded-xl border border-sage-200 bg-white p-4" data-testid="contador-deteccao" data-ligada={r.ligada ? "1" : "0"}>
      <h2 className="flex items-center gap-2 font-title text-lg font-semibold text-ink">
        <ScanSearch className="h-5 w-5 text-forest" aria-hidden /> Detecção nas fotos
      </h2>
      <p className="mt-1 text-sm text-ink">
        Chave DETECCAO_FOTOS_ATIVO: <strong>{r.ligada ? "ligada" : "desligada"}</strong> · {total} {total === 1 ? "foto analisada" : "fotos analisadas"} em 7 dias
        <span className="text-muted"> (≈ US$ {(total * custo.usdPorFoto).toFixed(2)} pela estimativa de US$ {custo.usdPorFoto.toFixed(4)} por foto)</span>
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-1 text-sm sm:grid-cols-4" data-testid="contador-deteccao-dias">
        {r.porDia.map((d) => (
          <li key={d.dia} className="text-ink">
            <span className="text-muted">{dataBRT(instanteBRT(d.dia, "12:00"))}:</span> <strong>{d.fotos}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
