import type { ReactNode } from "react";
import { DIAS_SEMANA, NOMES_MES, ROTULO_MARCA, celulasDoMes, marcaPrincipal, ymd, type MarcaDia } from "@/lib/calendario/grade";
import { cn } from "@/lib/utils";

/** Cor de cada marca: a mesma nos três calendários (disponibilidade, agenda do parceiro, estadia). */
const CLASSE_MARCA: Record<MarcaDia, string> = {
  selecionado: "bg-ink font-semibold text-white",
  entrada: "bg-forest font-semibold text-white",
  saida: "bg-forest font-semibold text-white",
  // E138: bloqueado precisa ler de longe (antes: cinza claríssimo, quase igual ao dia livre).
  bloqueado: "bg-red-100 font-semibold text-red-800 line-through ring-1 ring-inset ring-red-300",
  evento: "font-semibold text-forest ring-1 ring-inset ring-forest",
  periodo: "bg-sage-100 text-ink",
  hoje: "font-semibold text-ink underline underline-offset-2",
};

export type TipoCalendario = "disponibilidade" | "agenda" | "estadia";

/**
 * Um mês do calendário (Prompt 43, item 4): o MESMO componente nos três calendários separados — disponibilidade do
 * imóvel, agenda do parceiro e calendário da estadia. Cada tela só diz o que marca em cada dia. Com `onDia`, os dias
 * viram botões (o dono seleciona um período para bloquear); sem, a grade é só leitura.
 * `sobreposicao` desenha por cima da grade (as pílulas das estadias no calendário do dono).
 */
export function CalendarioMes(p: {
  tipo: TipoCalendario;
  ano: number;
  mes: number;
  marcas: Record<string, readonly MarcaDia[]>;
  hoje?: string | null;
  onDia?: (iso: string) => void;
  desabilitado?: (iso: string) => boolean;
  sobreposicao?: ReactNode;
}) {
  const celulas = celulasDoMes(p.ano, p.mes);
  return (
    <div className="rounded-xl border border-line bg-white p-3" data-testid="calendario-mes" data-tipo={p.tipo} data-mes={ymd(p.ano, p.mes, 1).slice(0, 7)}>
      <p className="mb-2 text-center text-sm font-semibold text-ink">
        {NOMES_MES[p.mes][0].toUpperCase() + NOMES_MES[p.mes].slice(1)} de {p.ano}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted" aria-hidden>
        {DIAS_SEMANA.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {p.sobreposicao}
        {celulas.map((dia, i) => {
          const pos = { gridRow: Math.floor(i / 7) + 1, gridColumn: (i % 7) + 1 };
          if (dia === null) return <span key={i} style={pos} />;
          const iso = ymd(p.ano, p.mes, dia);
          const marcas = [...(p.marcas[iso] ?? []), ...(p.hoje === iso ? (["hoje"] as const) : [])];
          const marca = marcaPrincipal(marcas);
          const desab = p.desabilitado?.(iso) ?? false;
          const rotulo = `${dia} de ${NOMES_MES[p.mes]}${marcas.length ? ` — ${marcas.map((m) => ROTULO_MARCA[m]).join(", ")}` : ""}`;
          const classe = cn(
            "grid aspect-square place-items-center rounded-lg text-xs",
            marca ? CLASSE_MARCA[marca] : "text-ink",
            desab && "cursor-not-allowed text-muted/40",
          );
          return p.onDia ? (
            <button
              key={i}
              type="button"
              style={pos}
              disabled={desab}
              onClick={() => p.onDia?.(iso)}
              aria-label={rotulo}
              data-dia={iso}
              data-marca={marca ?? undefined}
              className={cn(classe, !desab && !marca && "hover:bg-sage-100")}
            >
              {dia}
            </button>
          ) : (
            <span key={i} style={pos} aria-label={rotulo} data-dia={iso} data-marca={marca ?? undefined} className={classe}>
              {dia}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Legenda: só as marcas que a tela usa, com a mesma amostra de cor da grade. */
export function LegendaCalendario({ marcas }: { marcas: readonly MarcaDia[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" data-testid="calendario-legenda">
      {marcas.map((m) => (
        <li key={m} className="inline-flex items-center gap-2">
          <span className={cn("inline-block h-4 w-4 rounded-lg", CLASSE_MARCA[m])} aria-hidden />
          {ROTULO_MARCA[m]}
        </li>
      ))}
    </ul>
  );
}
