"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { FILTROS_AVISOS, filtrarAvisos, ordemCronologica, type AvisoTela, type FiltroAvisos } from "@/lib/notifications/sino";
import { MarcaLeitura, SeloPrioridade, classeDoAviso, marcarLidoEIr, marcarTodosLidos } from "@/components/painel/sino-avisos";

/**
 * E444 item 3 — "Ver todas" (/dashboard/notificacoes#avisos): a lista da tabela de avisos, do mais recente para o mais
 * antigo, com filtro por prioridade. Clique leva à tela do evento e marca como lido. Falha de leitura: o aviso (nunca
 * "nenhum aviso").
 */
export function ListaAvisos({ avisos, falhou, filtroInicial }: { avisos: AvisoTela[]; falhou: boolean; filtroInicial: FiltroAvisos }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<FiltroAvisos>(filtroInicial);
  const [lidos, setLidos] = useState<Set<string>>(() => new Set());
  // E586: a lista é estritamente cronológica (data/hora decrescente, desempate estável).
  const visiveis = filtrarAvisos(ordemCronologica(avisos), filtro);
  const [erroTodas, setErroTodas] = useState(false);
  const temNaoLido = avisos.some((a) => !a.lido_em && !lidos.has(a.id));
  return (
    <div className="mb-6 rounded-xl border border-line bg-white" data-testid="avisos-caixa">
      <div role="group" aria-label="Filtrar avisos por prioridade" className="flex flex-wrap gap-2 border-b border-line p-3 sm:px-4">
        {FILTROS_AVISOS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-semibold",
              filtro === f.id ? "border-forest bg-sage-100 text-forest" : "border-line bg-white text-ink hover:border-forest"
            )}
            data-testid={`avisos-filtro-${f.id}`}
          >
            {f.rotulo}
          </button>
        ))}
        {/* E533: marcar todas como lidas (o sino baixa junto). */}
        {!falhou && temNaoLido && (
          <button
            type="button"
            onClick={async () => {
              setErroTodas(false);
              setLidos(new Set(avisos.map((a) => a.id)));
              const ok = await marcarTodosLidos();
              if (!ok) {
                setLidos(new Set());
                setErroTodas(true);
              }
            }}
            className="ml-auto min-h-11 text-sm font-semibold text-forest underline underline-offset-4"
            data-testid="avisos-marcar-todas"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>
      {erroTodas && (
        <p role="alert" className="px-4 pt-3 text-sm text-amber-900" data-testid="avisos-marcar-todas-falha">
          Não foi possível marcar os avisos agora. Tente de novo em instantes.
        </p>
      )}
      {falhou ? (
        <p role="alert" className="px-4 py-4 text-sm text-amber-900" data-testid="avisos-caixa-falha">
          Não foi possível carregar os avisos agora. Recarregue a página em instantes.
        </p>
      ) : visiveis.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted" data-testid="avisos-caixa-vazia">
          {filtro === "todos" ? "Nenhum aviso por enquanto." : "Nenhum aviso com esta prioridade."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {visiveis.map((a) => {
            const lido = !!a.lido_em || lidos.has(a.id);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => {
                    setLidos((s) => new Set(s).add(a.id));
                    marcarLidoEIr(a, (href) => router.push(href));
                  }}
                  className={cn("flex min-h-11 w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2", classeDoAviso(lido))}
                  data-testid="avisos-item"
                  data-prioridade={a.prioridade}
                  data-lido={lido ? "sim" : "nao"}
                >
                  <MarcaLeitura lido={lido} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm text-ink [overflow-wrap:anywhere]", lido ? "font-normal" : "font-semibold")}>{a.titulo}</span>
                    {a.texto && (
                      <span className="mt-1 line-clamp-2 block text-sm text-muted [overflow-wrap:anywhere]" data-testid="aviso-texto">
                        {a.texto}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-muted">
                      {new Date(a.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}
                      {a.resolvido_em ? " · resolvido" : ""}
                    </span>
                  </span>
                  <SeloPrioridade prioridade={a.prioridade} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
