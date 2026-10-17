import { CalendarCheck, Clock } from "lucide-react";
import type { PerfilProprietario } from "@/lib/data/perfil-proprietario";
import { respostaExemploLabel, tempoNaVivaLabel, type ProprietarioExemplo } from "@/config/exemplo-proprietarios";
import { iniciais, corAvatar } from "@/lib/avatar";
import { SeloExemplo } from "@/components/property/selo-exemplo";

/**
 * Faixa logo abaixo do título (prompt 9): tempo de resposta · calendário · proprietário.
 * Anúncio REAL: números do 0149 (menos de 3 conversas → "Novo na Viva"); o calendário não tem data de
 * atualização registrada, então a coluna só leva às datas livres (nada inventado).
 * Anúncio de EXEMPLO: dados ilustrativos com o selo "Exemplo ilustrativo".
 */
export function FaixaProprietario({
  real,
  exemplo,
  hoje,
}: {
  real?: PerfilProprietario | null;
  exemplo?: ProprietarioExemplo | null;
  /** AAAA-MM-DD */
  hoje: string;
}) {
  if (!real && !exemplo) return null;
  const nome = exemplo?.nome ?? real!.nome;
  const desde = exemplo?.desde ?? real?.desde?.slice(0, 7) ?? null;
  const resposta = exemplo
    ? respostaExemploLabel(exemplo.respostaHoras)
    : real!.resposta
      ? `Responde ${real!.resposta.taxa}% das conversas, ${real!.resposta.tempo}`
      : "Novo na Viva";
  const foto = exemplo ? null : real!.fotoUrl;

  return (
    <div data-testid="faixa-proprietario" className="mt-4 rounded-2xl border border-sage-200 p-4">
      {exemplo && <SeloExemplo className="mb-3" />}
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-start gap-2.5">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-sage" aria-hidden />
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Tempo de resposta</dt>
            <dd className="text-sm text-ink" data-testid="faixa-resposta">{resposta}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-sage" aria-hidden />
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Calendário</dt>
            <dd className="text-sm text-ink" data-testid="faixa-calendario">
              {exemplo ? (
                "Atualizado nos últimos 30 dias"
              ) : (
                <a href="#disponibilidade" className="underline underline-offset-2 hover:text-forest">
                  Ver datas livres
                </a>
              )}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar pequeno com URL assinada
            <img src={foto} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: corAvatar(nome) }}
            >
              {iniciais(nome)}
            </span>
          )}
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Proprietário</dt>
            <dd className="truncate text-sm text-ink" data-testid="faixa-nome">{nome}</dd>
            {desde && <dd className="text-xs text-muted">{tempoNaVivaLabel(desde, hoje)}</dd>}
          </div>
        </div>
      </dl>
    </div>
  );
}
