import { BadgeCheck, Eye, MessageSquareText } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { PILULA_EMAIL, TITULO_ESPELHO, nomeNoEspelho } from "@/lib/perfil/espelho";

/**
 * O ESPELHO (CONTA-A, item 4; desenho perfil-01): a pílula "É assim que o proprietário te vê", a foto, o nome curto (o
 * proprietário nunca vê o sobrenome inteiro), a pílula "E-mail confirmado" e o "Sobre você" num balão. No computador,
 * coluna da direita, centrado; no celular, foto à esquerda e texto à direita.
 */
export function EspelhoPerfil({
  foto,
  nome,
  emailConfirmado,
  bio,
}: {
  foto: string | null;
  nome: string;
  emailConfirmado: boolean;
  bio: string;
}) {
  const sobre = bio.trim();
  return (
    <section
      id="espelho"
      className="scroll-mt-24 rounded-xl bg-white p-4 sm:p-6 lg:sticky lg:top-24"
      aria-labelledby="espelho-titulo"
      data-testid="espelho-perfil"
    >
      {/* A1 (perfil-01): a pílula verde é o título do cartão. */}
      <h2 id="espelho-titulo" className="flex justify-start lg:justify-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white">
          <Eye className="h-4 w-4" aria-hidden /> {TITULO_ESPELHO}
        </span>
      </h2>
      <div className="mt-4 flex items-start gap-4 lg:flex-col lg:items-center lg:text-center" data-testid="espelho-cartao">
        {/* C8: a foto do espelho é a do cartão de conversa — menor que a do topo. */}
        <span className="max-lg:hidden">
          <Avatar name={nome} size={96} photoUrl={foto ?? undefined} />
        </span>
        <span className="lg:hidden">
          <Avatar name={nome} size={64} photoUrl={foto ?? undefined} />
        </span>
        <div className="min-w-0 flex-1 lg:w-full">
          <p className="font-title text-xl font-semibold text-ink" data-testid="espelho-nome">
            {nomeNoEspelho(nome)}
          </p>
          {emailConfirmado && (
            <p className="mt-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1 text-xs font-semibold text-white" data-testid="espelho-email">
                <BadgeCheck className="h-4 w-4" aria-hidden /> {PILULA_EMAIL}
              </span>
            </p>
          )}
          <div
            className={
              sobre
                ? "mt-4 flex items-start gap-3 rounded-xl bg-surface-2 p-4 text-left text-sm text-ink"
                : "mt-4 flex items-start gap-3 rounded-xl border border-dashed border-line p-4 text-left text-sm text-muted"
            }
          >
            <MessageSquareText className="h-5 w-5 shrink-0 text-muted" aria-hidden />
            <p className="min-w-0 whitespace-pre-line break-words" data-testid="espelho-sobre" data-vazio={sobre ? "nao" : "sim"}>
              {sobre ? `“${sobre}”` : "O seu \"Sobre você\" aparece aqui, como uma mensagem."}
            </p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted max-lg:hidden" data-testid="espelho-nota">
        Esta é a visão que os proprietários terão ao avaliar sua candidatura.
      </p>
    </section>
  );
}
