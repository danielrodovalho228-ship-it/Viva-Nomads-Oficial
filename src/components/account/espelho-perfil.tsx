import { BadgeCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import type { Intencao } from "@/lib/auth/entrada";
import { PILULA_EMAIL, TITULO_ESPELHO, linhaIntencaoCidade, nomeNoEspelho } from "@/lib/perfil/espelho";

/**
 * CONTA-A, item 4 — O ESPELHO: um cartão ao vivo que se monta enquanto a pessoa preenche o perfil: foto, nome, a linha
 * "Quer morar · cidade", a pílula "E-mail confirmado" (quando houver) e o "Sobre você" como um balão de mensagem.
 * No computador fica à direita do formulário, sobre o painel quente; no celular, logo abaixo do formulário.
 */
export function EspelhoPerfil({
  foto,
  nome,
  intencoes,
  cidade,
  emailConfirmado,
  bio,
}: {
  foto: string | null;
  nome: string;
  intencoes: Intencao[];
  cidade: string;
  emailConfirmado: boolean;
  bio: string;
}) {
  const linha = linhaIntencaoCidade(intencoes, cidade);
  const sobre = bio.trim();
  return (
    <section id="espelho" className="scroll-mt-24 rounded-xl bg-areia p-4 lg:sticky lg:top-24" aria-labelledby="espelho-titulo" data-testid="espelho-perfil">
      <h2 id="espelho-titulo" className="font-title text-lg font-semibold text-ink">
        {TITULO_ESPELHO}
      </h2>
      <div className="mt-3 rounded-xl border border-line bg-white p-4" data-testid="espelho-cartao">
        <div className="flex items-center gap-3">
          <Avatar name={nome} size={56} photoUrl={foto ?? undefined} />
          <div className="min-w-0">
            <p className="truncate font-title text-base font-semibold text-ink" data-testid="espelho-nome">
              {nomeNoEspelho(nome)}
            </p>
            {linha && (
              <p className="text-sm text-muted" data-testid="espelho-linha">
                {linha}
              </p>
            )}
          </div>
        </div>
        {emailConfirmado && (
          <p className="mt-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold text-forest" data-testid="espelho-email">
              <BadgeCheck className="h-4 w-4" aria-hidden /> {PILULA_EMAIL}
            </span>
          </p>
        )}
        <p
          className={
            sobre
              ? "mt-3 whitespace-pre-line rounded-xl rounded-tl-none bg-surface-2 px-3 py-2 text-sm text-ink"
              : "mt-3 rounded-xl rounded-tl-none border border-dashed border-line px-3 py-2 text-sm text-muted"
          }
          data-testid="espelho-sobre"
          data-vazio={sobre ? "nao" : "sim"}
        >
          {sobre || "O seu \"Sobre você\" aparece aqui, como uma mensagem."}
        </p>
      </div>
    </section>
  );
}
