"use client";

import { TIPOS_CAMA, faltasDaFicha, totalSolteiros, type FichaDentro, type QuartoFicha, type TipoCama } from "@/lib/ficha-dentro/ficha-dentro";

/**
 * E660 — ficha "o que tem dentro" no cadastro: camas e ar-condicionado por quarto, roupa de cama e banho, cozinha equipada.
 * Pratos e talheres são OPCIONAIS (não bloqueiam nada). A ficha congela no contrato e é o que o morador confere na entrada.
 */
const SimNao = ({ valor, onChange, nome }: { valor: boolean | null; onChange: (v: boolean) => void; nome: string }) => (
  <div className="flex gap-2" role="radiogroup" aria-label={nome}>
    {[true, false].map((v) => (
      <button
        key={String(v)}
        type="button"
        role="radio"
        aria-checked={valor === v}
        onClick={() => onChange(v)}
        className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${valor === v ? "border-forest bg-forest text-white" : "border-line bg-white text-ink"}`}
      >
        {v ? "Sim" : "Não"}
      </button>
    ))}
  </div>
);

export function FichaDentroCampos({ ficha, onChange, mostrarFaltas }: { ficha: FichaDentro; onChange: (f: FichaDentro) => void; mostrarFaltas: boolean }) {
  const faltas = faltasDaFicha(ficha);
  const mudaQuarto = (i: number, p: Partial<QuartoFicha>) => onChange({ ...ficha, quartos: ficha.quartos.map((q, j) => (j === i ? { ...q, ...p } : q)) });
  const qtdDe = (q: QuartoFicha, tipo: TipoCama) => q.camas.find((c) => c.tipo === tipo)?.qtd ?? 0;
  const mudaCama = (i: number, tipo: TipoCama, qtd: number) => {
    const q = ficha.quartos[i];
    const resto = q.camas.filter((c) => c.tipo !== tipo);
    mudaQuarto(i, { camas: qtd > 0 ? [...resto, { tipo, qtd }] : resto });
  };
  return (
    <section className="space-y-4" data-testid="ficha-dentro" aria-labelledby="ficha-dentro-titulo">
      <div>
        <h3 id="ficha-dentro-titulo" className="text-base font-semibold text-ink">O que tem dentro</h3>
        <p className="text-sm text-muted">Camas e ar-condicionado por quarto, roupa de cama e banho e cozinha. É o que o morador confere ao entrar.</p>
      </div>
      {ficha.quartos.map((q, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-line p-3" data-testid={`ficha-quarto-${i}`}>
          <p className="text-sm font-semibold text-ink">{q.nome}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TIPOS_CAMA.map((t) => (
              <label key={t.valor} className="flex items-center justify-between gap-2 text-sm text-ink">
                <span>Cama {t.rotulo}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={10}
                  value={qtdDe(q, t.valor) || ""}
                  placeholder="0"
                  onChange={(e) => mudaCama(i, t.valor, Math.max(0, Math.min(10, Math.floor(Number(e.target.value) || 0))))}
                  className="h-11 w-16 rounded-lg border border-line px-2 text-center"
                  data-testid={`ficha-cama-${i}-${t.valor}`}
                />
              </label>
            ))}
          </div>
          {totalSolteiros(q) >= 2 && (
            <div className="space-y-1">
              <p className="text-sm text-ink">As camas de solteiro se juntam numa de casal?</p>
              <SimNao nome={`${q.nome}: solteiros juntam`} valor={q.solteirosJuntam} onChange={(v) => mudaQuarto(i, { solteirosJuntam: v })} />
            </div>
          )}
          <div className="space-y-1">
            <p className="text-sm text-ink">Tem ar-condicionado neste quarto?</p>
            <SimNao nome={`${q.nome}: ar-condicionado`} valor={q.arCondicionado} onChange={(v) => mudaQuarto(i, { arCondicionado: v })} />
          </div>
        </div>
      ))}
      <div className="space-y-1">
        <p className="text-sm text-ink">Roupa de cama e banho inclusa?</p>
        <SimNao nome="Roupa de cama e banho inclusa" valor={ficha.enxoval} onChange={(v) => onChange({ ...ficha, enxoval: v })} />
      </div>
      <div className="space-y-1">
        <p className="text-sm text-ink">Cozinha equipada?</p>
        <SimNao nome="Cozinha equipada" valor={ficha.cozinhaEquipada} onChange={(v) => onChange({ ...ficha, cozinhaEquipada: v })} />
      </div>
      <details className="rounded-lg border border-line p-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink">Pratos e talheres (opcional)</summary>
        <div className="mt-2 flex gap-3">
          {(["pratos", "talheres"] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm text-ink">
              <span>{k === "pratos" ? "Pratos" : "Talheres"}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={ficha.utensilios?.[k] ?? ""}
                onChange={(e) => {
                  const n = Math.floor(Number(e.target.value) || 0);
                  onChange({ ...ficha, utensilios: { pratos: ficha.utensilios?.pratos ?? null, talheres: ficha.utensilios?.talheres ?? null, [k]: n > 0 ? n : null } });
                }}
                className="h-11 w-20 rounded-lg border border-line px-2 text-center"
                data-testid={`ficha-${k}`}
              />
            </label>
          ))}
        </div>
      </details>
      {mostrarFaltas && faltas.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" data-testid="ficha-faltas">
          <p className="font-semibold">Falta responder:</p>
          <ul className="list-inside list-disc">{faltas.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
