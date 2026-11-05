"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CalendarioMes, LegendaCalendario } from "@/components/calendario/calendario-mes";
import { NOMES_MES, type MarcaDia } from "@/lib/calendario/grade";
import { itensDaAgenda, moverMesGrade, type ItemAgendaParceiro } from "@/lib/parceiros/agenda-parceiro";

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * E466 (i): o mini-calendário da Agenda do parceiro com mês anterior/próximo e dias clicáveis — o dia escolhido filtra os
 * horários da lista ("Ver todos" volta); tocar de novo no mesmo dia também volta. Os dias com horário ficam marcados.
 */
export function AgendaCalendario({ hoje, itens }: { hoje: string; itens: ItemAgendaParceiro[] }) {
  const [cursor, setCursor] = useState(() => ({ ano: Number(hoje.slice(0, 4)), mes: Number(hoje.slice(5, 7)) - 1 }));
  const [dia, setDia] = useState<string | null>(null);
  const marcas: Record<string, MarcaDia[]> = {};
  for (const i of itens) marcas[i.dia] = ["evento"];
  if (dia) marcas[dia] = [...(marcas[dia] ?? []), "selecionado"];
  const lista = itensDaAgenda(itens, dia);
  const nomeMes = NOMES_MES[cursor.mes];
  return (
    <div data-testid="parceiro-agenda-calendario">
      <LegendaCalendario marcas={["evento", "hoje"]} />
      <CalendarioMes
        tipo="agenda"
        ano={cursor.ano}
        mes={cursor.mes}
        hoje={hoje}
        marcas={marcas}
        onDia={(iso) => setDia((d) => (d === iso ? null : iso))}
        cabecalho={
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Mês anterior" data-testid="agenda-parceiro-anterior" onClick={() => setCursor((c) => moverMesGrade(c, -1))} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2">
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <p className="text-sm font-semibold text-ink" data-testid="agenda-parceiro-mes" aria-live="polite">
              {nomeMes[0].toUpperCase() + nomeMes.slice(1)} de {cursor.ano}
            </p>
            <button type="button" aria-label="Próximo mês" data-testid="agenda-parceiro-proximo" onClick={() => setCursor((c) => moverMesGrade(c, 1))} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2">
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        }
      />
      {dia && (
        <div className="mt-3 flex items-center justify-between gap-2 text-sm" data-testid="agenda-parceiro-filtro" data-dia={dia}>
          <span className="font-semibold text-ink">Horários em {dataCurta(dia)}</span>
          <button type="button" onClick={() => setDia(null)} className="inline-flex min-h-11 items-center font-semibold text-forest underline underline-offset-4" data-testid="agenda-parceiro-ver-todos">
            Ver todos
          </button>
        </div>
      )}
      {lista.length === 0 ? (
        dia && <p className="mt-2 text-sm text-muted" data-testid="agenda-parceiro-dia-vazio">Nenhum horário combinado neste dia.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {lista.map((p) => (
            <li key={p.id}>
              <Link href={`/dashboard/servicos/pedidos/${p.id}`} className="flex min-h-11 items-center justify-between gap-2 py-3 text-sm" data-testid="parceiro-agenda-item">
                <span className="font-semibold text-ink">{p.quando}</span>
                <span className="text-muted">{p.categoria}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
