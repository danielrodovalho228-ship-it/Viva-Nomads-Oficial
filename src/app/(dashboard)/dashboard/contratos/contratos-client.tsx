"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  Check,
  Clock,
  Lock,
  CalendarDays,
  Plus,
  CircleDollarSign,
  Users,
} from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { useDemoMode, DemoBadge } from "@/lib/demo/demo-mode";
import { DEMO_CONTRACTS } from "@/lib/demo/seed";
import {
  planejarBlocos,
  encadearDatas,
  comissaoContrato,
  DIAS_POR_MES,
} from "@/lib/contrato-blocos";
import { COMISSAO_POR_PLANO } from "@/config/planos";
import {
  marcarPagamentoRecebido,
  type ContratoView,
  type BlocoView,
} from "@/lib/data/contratos-actions";
import { AvaliacaoForm } from "@/components/avaliacao-form";
import { formatBRL, cn } from "@/lib/utils";

/** Texto imutável da regra de ouro (declaratório — nunca movimenta valores). */
const REGRA_PAGAMENTO =
  "O pagamento é feito direto ao proprietário. A plataforma registra e documenta — não movimenta valores.";

/** Rótulo + tom de cada estado do bloco. */
const BLOCO_STATUS: Record<string, { label: string; tone: string }> = {
  agendado: { label: "Agendado", tone: "bg-surface-2 text-muted" },
  ativo: { label: "Em vigência", tone: "bg-sage-100 text-forest" },
  renovado: { label: "Renovado", tone: "bg-blue-50 text-blue-700" },
  encerrado: { label: "Encerrado", tone: "bg-surface-2 text-muted" },
  encerrado_sem_renovacao: { label: "Encerrado (sem renovação)", tone: "bg-amber-50 text-amber-700" },
};

const FORMA_LABEL: Record<string, string> = {
  pix: "Pix",
  boleto: "Boleto",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

function statusMeta(status: string) {
  return BLOCO_STATUS[status] ?? { label: status, tone: "bg-surface-2 text-muted" };
}

/**
 * Constrói contratos de DEMONSTRAÇÃO (admin) a partir do seed, sintetizando os
 * blocos com as regras reais (blocos de 2 meses, caução 50%) e um pagamento já
 * confirmado no 1º bloco — para o piloto/investidor ver o fluxo declaratório.
 */
/** Trilha de comissão dos contratos de DEMONSTRAÇÃO: Profissional (8%). */
const DEMO_COMISSAO_PCT = COMISSAO_POR_PLANO.pro;

function buildDemoContratos(hojeISO: string): ContratoView[] {
  return DEMO_CONTRACTS.map((c, ci) => {
    // Prazo total plausível (~6 meses) para render um belo encadeamento.
    const prazoMeses = 6;
    const planos = planejarBlocos(prazoMeses, c.valorMes, 2);
    const comDatas = encadearDatas(c.inicio, planos);
    const blocos: BlocoView[] = comDatas.map((b, i) => {
      const status =
        b.fim < hojeISO ? "renovado" : b.inicio <= hojeISO ? "ativo" : "agendado";
      return {
        id: `demo-bloco-${ci}-${b.numero}`,
        numeroBloco: b.numero,
        inicio: b.inicio,
        fim: b.fim,
        meses: b.meses,
        valor: b.valor,
        caucao: b.caucao,
        caucaoForma: "avista",
        caucaoStatus: i === 0 ? "comprovada" : "pendente",
        status,
      };
    });
    // Um pagamento de aluguel já confirmado no 1º bloco (histórico declaratório).
    const b0 = blocos[0];
    const pagamentos = b0
      ? [
          {
            id: `demo-pg-${ci}`,
            blocoId: b0.id,
            tipo: "aluguel",
            valor: b0.valor, // bloco 1 quitado (aluguel × meses do bloco)
            forma: "pix",
            dataPagamento: c.inicio,
            confirmado: true,
            observacao: null,
          },
        ]
      : [];
    return {
      id: `demo-contrato-${ci}`,
      propertyId: `demo-prop-${ci}`,
      propertyTitle: c.imovel,
      tenantId: `demo-tenant-${ci}`,
      city: "",
      aluguelMensal: c.valorMes,
      prazoTotalDias: prazoMeses * DIAS_POR_MES,
      tamanhoBlocoMeses: 2,
      // Comissão = % × 1º aluguel, UMA vez (regra correta). Exemplo demo usa a
      // trilha do Profissional (8%) — NUNCA "1 mês de aluguel cheio".
      comissaoValor: comissaoContrato(c.valorMes, DEMO_COMISSAO_PCT),
      comissaoPercent: DEMO_COMISSAO_PCT,
      qtdOcupantes: 1 + (ci % 3),
      status: "ativo",
      criadoEm: c.inicio,
      blocos,
      pagamentos,
    };
  });
}

export function ContratosClient({
  contratos: real,
  hojeISO,
}: {
  contratos: ContratoView[];
  hojeISO: string;
}) {
  const { on: demoOn } = useDemoMode();
  const demoContratos = useMemo(() => buildDemoContratos(hojeISO), [hojeISO]);
  const contratos = demoOn ? demoContratos : real;

  return (
    <>
      <PageTitle
        title="Contratos & blocos"
        subtitle="Acompanhe cada contrato, seus blocos e registre os recebimentos."
        action={demoOn ? <DemoBadge /> : undefined}
      />

      {/* Regra de ouro — sempre visível no topo. */}
      <div className="mb-6 flex items-start gap-2 rounded-xl border border-sage-200 bg-surface-2 px-4 py-3 text-sm text-muted">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
        <span>{REGRA_PAGAMENTO}</span>
      </div>

      {contratos.length === 0 ? (
        <EmptyState
          illustration={<Image src="/media/empty-contratos.webp" alt="" width={176} height={176} className="h-44 w-44" />}
          title="Nenhum contrato ainda"
          text="Seu primeiro fechamento aparece aqui — o contrato-mãe, os blocos e o registro dos recebimentos."
          action={
            <Link href="/dashboard/fechamento">
              <Button variant="gold">Ir para o fechamento</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {contratos.map((c) => (
            <ContratoCard key={c.id} contrato={c} hojeISO={hojeISO} demo={demoOn} />
          ))}
        </div>
      )}
    </>
  );
}

function ContratoCard({
  contrato,
  hojeISO,
  demo,
}: {
  contrato: ContratoView;
  hojeISO: string;
  demo: boolean;
}) {
  const pagosPorBloco = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of contrato.pagamentos) {
      if (p.tipo !== "aluguel") continue;
      m.set(p.blocoId, (m.get(p.blocoId) ?? 0) + p.valor);
    }
    return m;
  }, [contrato.pagamentos]);

  const totalPeriodo = contrato.blocos.reduce((s, b) => s + b.valor, 0);
  const caucaoTotal = contrato.blocos.reduce((s, b) => s + b.caucao, 0);

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-title text-lg font-bold text-ink">{contrato.propertyTitle}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <CircleDollarSign className="h-3.5 w-3.5" /> {formatBRL(contrato.aluguelMensal)}/mês
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> {contrato.blocos.length}{" "}
              {contrato.blocos.length === 1 ? "bloco" : "blocos"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {contrato.qtdOcupantes} ocupante(s)
            </span>
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            contrato.status === "ativo"
              ? "bg-sage-100 text-forest"
              : "bg-amber-50 text-amber-700"
          )}
        >
          {contrato.status === "ativo"
            ? "Ativo"
            : contrato.status === "encerrado_sem_renovacao"
              ? "Encerrado (sem renovação)"
              : contrato.status === "concluido"
                ? "Concluído"
                : "Cancelado"}
        </span>
      </div>

      {/* Comissão única (contrato-mãe) — % do 1º aluguel, NUNCA "1 mês de aluguel". */}
      <p className="mt-3 rounded-lg bg-champagne/10 px-3 py-2 text-xs text-forest">
        Comissão do contrato-mãe: <strong>{formatBRL(contrato.comissaoValor)}</strong>
        {contrato.comissaoPercent > 0 && (
          <> ({Math.round(contrato.comissaoPercent * 100)}% do 1º aluguel)</>
        )}{" "}
        — cobrada <strong>uma única vez</strong>. Renovar ou estender blocos não gera nova
        comissão; os aluguéis vão direto a você.
      </p>

      {/* Timeline dos blocos */}
      <div className="mt-4 space-y-3">
        {contrato.blocos.map((b) => (
          <BlocoRow
            key={b.id}
            bloco={b}
            contratoId={contrato.id}
            aluguelMensal={contrato.aluguelMensal}
            pago={pagosPorBloco.get(b.id) ?? 0}
            hojeISO={hojeISO}
            demo={demo}
          />
        ))}
      </div>

      {/* Totais do período */}
      <div className="mt-4 flex flex-wrap gap-4 border-t border-sage-200 pt-3 text-xs text-muted">
        <span>
          Total do período: <strong className="text-ink">{formatBRL(totalPeriodo)}</strong>
        </span>
        <span>
          Caução (soma dos blocos): <strong className="text-ink">{formatBRL(caucaoTotal)}</strong>
        </span>
      </div>

      {/* Avaliar o inquilino (reputação bidirecional). */}
      <AvaliacaoForm
        contratoId={contrato.id}
        alvoId={contrato.tenantId}
        papelAutor="proprietario"
        abrirLabel="Avaliar o inquilino"
        titulo="Como foi a locação com este inquilino?"
        placeholder="Comentário (opcional) — pontualidade, cuidado com o imóvel, comunicação…"
        demo={demo}
      />
    </Panel>
  );
}

function BlocoRow({
  bloco,
  contratoId,
  aluguelMensal,
  pago,
  hojeISO,
  demo,
}: {
  bloco: BlocoView;
  contratoId: string;
  aluguelMensal: number;
  pago: number;
  hojeISO: string;
  demo: boolean;
}) {
  const meta = statusMeta(bloco.status);
  const vigente = bloco.inicio <= hojeISO && bloco.fim >= hojeISO;
  const quitado = pago >= bloco.valor;
  const restante = Math.max(0, bloco.valor - pago);

  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        vigente ? "border-forest/40 bg-sage-100/40" : "border-sage-200"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-forest text-xs font-bold text-white">
            {bloco.numeroBloco}
          </span>
          <div className="text-sm">
            <p className="font-medium text-ink">
              Bloco {bloco.numeroBloco}{" "}
              <span className="font-normal text-muted">({bloco.meses}m)</span>
            </p>
            <p className="text-xs text-muted">
              {formatDate(bloco.inicio)} → {formatDate(bloco.fim)}
            </p>
          </div>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", meta.tone)}>
          {meta.label}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <p className="text-muted">Aluguel do bloco</p>
          <p className="font-medium text-ink">{formatBRL(bloco.valor)}</p>
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <p className="text-muted">Caução (50%)</p>
          <p className="font-medium text-ink">
            {formatBRL(bloco.caucao)}{" "}
            <span
              className={cn(
                "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                bloco.caucaoStatus === "comprovada"
                  ? "bg-green-50 text-green-900"
                  : "bg-amber-50 text-amber-700"
              )}
            >
              {bloco.caucaoStatus === "comprovada" ? "comprovada" : "pendente"}
            </span>
          </p>
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <p className="text-muted">Recebido (declarado)</p>
          <p className={cn("font-medium", quitado ? "text-forest" : "text-ink")}>
            {formatBRL(pago)}{" "}
            {quitado && <Check className="inline h-3.5 w-3.5" />}
          </p>
        </div>
      </div>

      {/* Registro declaratório de recebimento (só em blocos já iniciados). */}
      {bloco.status !== "agendado" ? (
        quitado ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-forest">
            <Check className="h-3.5 w-3.5" /> Aluguel do bloco registrado como recebido.
          </p>
        ) : (
          <RegistrarRecebimento
            blocoId={bloco.id}
            contratoId={contratoId}
            valorSugerido={restante > 0 ? restante : aluguelMensal}
            hojeISO={hojeISO}
            demo={demo}
          />
        )
      ) : (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
          <Clock className="h-3.5 w-3.5" /> Bloco agendado — o registro abre quando ele entra em
          vigência.
        </p>
      )}
    </div>
  );
}

function RegistrarRecebimento({
  blocoId,
  contratoId,
  valorSugerido,
  hojeISO,
  demo,
}: {
  blocoId: string;
  contratoId: string;
  valorSugerido: number;
  hojeISO: string;
  demo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState(String(valorSugerido));
  const [forma, setForma] = useState("pix");
  const [data, setData] = useState(hojeISO);
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSaving(true);
    setErro(null);
    const r = await marcarPagamentoRecebido({
      blocoId,
      contratoId,
      tipo: "aluguel",
      valor: Number(valor) || 0,
      forma: forma as "pix" | "boleto" | "transferencia" | "dinheiro" | "outro",
      dataPagamento: data,
      observacao: obs || undefined,
    });
    setSaving(false);
    if (r.ok) {
      setDone(true);
    } else {
      setErro(r.error ?? "Não foi possível registrar.");
    }
  }

  if (done) {
    return (
      <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-forest">
        <Check className="h-3.5 w-3.5" />
        {demo
          ? "Registro de exemplo — em produção fica no histórico do contrato."
          : "Recebimento registrado. O inquilino pode confirmar."}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-sage-200 px-3 py-1.5 text-xs font-medium text-forest hover:bg-sage-100"
      >
        <Plus className="h-3.5 w-3.5" /> Registrar recebimento
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-sage-200 bg-white p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink">
        <ShieldCheck className="h-3.5 w-3.5 text-sage" /> Registrar recebimento (declaratório)
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-muted">
          Valor
          <input
            type="number"
            min={0}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="mt-1 w-full rounded-lg border border-sage-200 px-2 py-1.5 text-sm text-ink outline-none focus:border-sage"
          />
        </label>
        <label className="text-xs text-muted">
          Forma
          <select
            value={forma}
            onChange={(e) => setForma(e.target.value)}
            className="mt-1 w-full rounded-lg border border-sage-200 bg-white px-2 py-1.5 text-sm text-ink outline-none focus:border-sage"
          >
            {Object.entries(FORMA_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Data
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-1 w-full rounded-lg border border-sage-200 px-2 py-1.5 text-sm text-ink outline-none focus:border-sage"
          />
        </label>
      </div>
      <input
        type="text"
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        placeholder="Observação (opcional)"
        className="mt-2 w-full rounded-lg border border-sage-200 px-2 py-1.5 text-sm text-ink outline-none focus:border-sage"
      />
      <p className="mt-2 text-[11px] text-muted">{REGRA_PAGAMENTO}</p>
      {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="gold" size="sm" onClick={salvar} disabled={saving}>
          {saving ? "Registrando…" : "Confirmar recebimento"}
        </Button>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}
