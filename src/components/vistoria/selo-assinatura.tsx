import { seloDaAssinatura, type SeloAssinaturaDados } from "@/lib/vistoria/telas-laudo";

/**
 * E691 — o selo da assinatura do laudo: número e hash visíveis ao avaliador (quem assinou) e ao dono. O hash inteiro fica
 * em um campo selecionável (confere com o registro guardado pela Viva); o curto é o que se lê de relance.
 */
export function SeloAssinatura({ laudo, quem }: { laudo: SeloAssinaturaDados; quem: "avaliador" | "dono" }) {
  const s = seloDaAssinatura(laudo);
  if (!s) return null;
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface-2 p-3 text-sm" data-testid="selo-assinatura" data-quem={quem}>
      <p className="font-semibold text-ink">{quem === "avaliador" ? "Você assinou este laudo" : "Laudo assinado pelo avaliador"}</p>
      <p className="text-muted" data-testid="selo-assinatura-numero">
        {s.numero} · {s.quando}
      </p>
      <p className="mt-1 text-muted">
        Hash da assinatura: <span className="font-mono text-ink" data-testid="selo-assinatura-hash">{s.hashCurto}</span>
      </p>
      <input readOnly value={s.hash} aria-label="Hash completo da assinatura" onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-lg border border-line bg-white px-2 py-1 font-mono text-xs text-ink" />
    </div>
  );
}
