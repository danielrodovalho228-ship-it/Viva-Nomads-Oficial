import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { formatarDiaCurto, type EtapaEstadia } from "@/lib/estadia-linha-tempo";

/**
 * Linha do tempo da estadia (ordem f1b437bb, UX6-a): cartões empilhados com o dia à esquerda e,
 * ao lado, o que acontece e a que horas. Atalho para as mensagens com a outra parte.
 */
export function LinhaDoTempoEstadia({ etapas }: { etapas: EtapaEstadia[] }) {
  if (etapas.length === 0) return null;
  return (
    <Panel className="mt-4 p-4" data-testid="estadia-linha-tempo">
      <h2 className="font-title text-base font-semibold text-ink">Sua estadia</h2>
      <ol className="mt-3 space-y-3">
        {etapas.map((e) => (
          <li
            key={e.chave}
            data-testid={`estadia-etapa-${e.chave}`}
            data-prazo={e.prazo}
            className="flex items-center gap-4 rounded-xl border border-sage-200 bg-white p-3"
          >
            <span className="w-16 shrink-0 text-center font-title text-sm font-semibold uppercase text-forest">
              {formatarDiaCurto(e.dia)}
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-ink">{e.titulo}</span>
              <span className="block text-sm text-muted">{e.horario}</span>
            </span>
          </li>
        ))}
      </ol>
      <Link
        href="/dashboard/mensagens"
        data-testid="estadia-mensagens"
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-sage-200 px-4 text-sm font-medium text-ink hover:bg-surface-2"
      >
        <MessageCircle className="h-4 w-4" /> Mensagens
      </Link>
    </Panel>
  );
}
