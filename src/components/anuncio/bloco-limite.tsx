import Link from "next/link";
import { linhasDoLimite, type SituacaoLimite } from "@/lib/anuncio/pausa";

/**
 * 64-B: "M publicados — seu plano permite N". Acima do limite, os que já estavam no ar continuam e a linha diz quantos
 * pausar para publicar outro. No painel, leva a Meus imóveis (onde fica o Pausar).
 */
export function BlocoLimite({ situacao, link = false }: { situacao: SituacaoLimite; link?: boolean }) {
  const [principal, acima] = linhasDoLimite(situacao);
  return (
    <div className="rounded-xl border border-line p-4 text-sm" data-testid="bloco-limite" data-ativos={situacao.ativos} data-limite={situacao.limite} data-pausar={situacao.excedente}>
      <p className="font-semibold text-ink">{principal}</p>
      {acima && <p className="mt-1 text-ink/80">{acima}</p>}
      {link && (
        <Link href="/dashboard/imoveis" className="mt-2 inline-flex min-h-11 items-center font-semibold text-forest underline underline-offset-4">
          Ver meus imóveis
        </Link>
      )}
    </div>
  );
}
