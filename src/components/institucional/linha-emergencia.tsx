import { pedacosDaFraseEmergencia, FRASE_EMERGENCIA_SEGURANCA } from "@/lib/seguranca/emergencia";

/** E853: a linha de emergência (texto exato em FRASE_EMERGENCIA_SEGURANCA); os números 190, 192 e 193 ligam no celular (E943: + 192, SAMU). */
export function LinhaEmergencia() {
  return (
    <p className="font-semibold text-ink" aria-label={FRASE_EMERGENCIA_SEGURANCA}>
      {pedacosDaFraseEmergencia().map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} className="underline underline-offset-2">
            {p.texto}
          </a>
        ) : (
          <span key={i}>{p.texto}</span>
        ),
      )}
    </p>
  );
}
