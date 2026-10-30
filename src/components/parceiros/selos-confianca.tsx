import { BadgeCheck, LockKeyhole, MessagesSquare } from "lucide-react";

/** E285 (folha aprovada, Tela 2): a faixa de confiança da busca de parceiros — o que já vale para todo parceiro. */
export const SELOS_CONFIANCA_PARCEIROS = [
  { icone: BadgeCheck, texto: "Parceiros aprovados pela Viva" },
  { icone: MessagesSquare, texto: "Você combina tudo pelas mensagens da Viva" },
  { icone: LockKeyhole, texto: "Contato e endereço só depois do aceite" },
] as const;

export function SelosConfianca() {
  return (
    <ul className="mt-6 grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-3" data-testid="selos-confianca">
      {SELOS_CONFIANCA_PARCEIROS.map(({ icone: Icone, texto }) => (
        <li key={texto} className="flex items-center gap-3 text-sm font-medium text-ink" data-testid="selo-confianca">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sage-100 text-forest" aria-hidden>
            <Icone className="h-5 w-5" />
          </span>
          {texto}
        </li>
      ))}
    </ul>
  );
}
