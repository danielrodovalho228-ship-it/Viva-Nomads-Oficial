import { BadgeCheck } from "lucide-react";
import type { PerfilProprietario } from "@/lib/data/perfil-proprietario";
import { respostaExemploLabel, tempoNaVivaLabel, type ProprietarioExemplo } from "@/config/exemplo-proprietarios";
import { iniciais, corAvatar } from "@/lib/avatar";
import { SeloExemplo } from "@/components/property/selo-exemplo";
import { SeloLinkedin } from "@/components/confianca/selo-linkedin";
import { ehSeloLinkedin } from "@/lib/linkedin/textos";

/**
 * Anfitrião (Prompt 41, item 1), logo depois da linha-síntese: foto, nome curto e selos numa linha; embaixo, em miúdo,
 * o tempo de resposta e o link para as datas livres (prompt 9). Nada inventado:
 * - anúncio REAL: números do 0149 (menos de 3 conversas → "Novo na Viva") e os selos reais do perfil; o calendário
 *   não tem data de atualização registrada, então só leva às datas livres;
 * - anúncio de EXEMPLO: dados ilustrativos com o selo "Exemplo ilustrativo".
 * O cartão completo "Sobre o proprietário" continua mais abaixo (#proprietario).
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
  const selos = (exemplo ? exemplo.selos : real!.selos).slice(0, 3);

  return (
    <div data-testid="faixa-proprietario" className="mt-6 border-y border-divisor py-4">
      {exemplo && <SeloExemplo className="mb-3" />}
      <div className="flex items-center gap-3">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar pequeno com URL assinada
          <img src={foto} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-base font-semibold text-white"
            style={{ backgroundColor: corAvatar(nome) }}
          >
            {iniciais(nome)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">
            Anfitrião: <span data-testid="faixa-nome">{nome}</span>
          </p>
          {desde && <p className="text-sm text-muted">{tempoNaVivaLabel(desde, hoje)}</p>}
        </div>
      </div>
      {selos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" data-testid="faixa-selos">
          {selos.map((s) =>
            ehSeloLinkedin(s) ? (
              <li key={s}>
                <SeloLinkedin formato="pilula" />
              </li>
            ) : (
              <li key={s} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-ink">
                <BadgeCheck className="h-4 w-4 text-forest" aria-hidden /> {s}
              </li>
            ),
          )}
        </ul>
      )}
      <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-xs text-muted">Tempo de resposta</dt>
          <dd className="text-ink" data-testid="faixa-resposta">
            {resposta}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Calendário</dt>
          <dd className="text-ink" data-testid="faixa-calendario">
            {exemplo ? (
              "Atualizado nos últimos 30 dias"
            ) : (
              <a href="#disponibilidade" className="underline underline-offset-2 hover:text-forest">
                Ver datas livres
              </a>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
