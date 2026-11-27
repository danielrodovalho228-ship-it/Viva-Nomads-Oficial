/*
  E1192 (ORDEM-DUET-861) — a nota que explica "dias úteis" ao lado de um prazo. O texto é a constante NOTA_DIAS_UTEIS
  do calendário único (lib/calendario/dias-uteis.ts), nunca escrito à mão; cada tela mostra a nota uma vez.
  Com `de`, a nota só aparece quando algum desses textos cita dias úteis (o pedido anterior à regra diz "laudo em 7
  dias" e fica sem nota).
*/
import { NOTA_DIAS_UTEIS, citaDiasUteis } from "@/lib/calendario/dias-uteis";

export function NotaDiasUteis({ de, className = "mt-1 text-sm text-muted" }: { de?: readonly (string | null | undefined)[]; className?: string }) {
  if (de && !de.some(citaDiasUteis)) return null;
  return (
    <p className={className} data-testid="nota-dias-uteis">
      {NOTA_DIAS_UTEIS}
    </p>
  );
}
