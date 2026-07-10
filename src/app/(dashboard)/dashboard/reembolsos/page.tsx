"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  BellRing,
  FileCheck2,
  AlertTriangle,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { PlatformLegalNotice } from "@/components/legal-notice";
import { useDashDemo } from "@/lib/demo/demo-mode";
import {
  calcularReembolso,
  totalDescontos,
  PRAZO_REEMBOLSO_DIAS,
  type DescontoReembolso,
  type StatusReembolso,
} from "@/lib/caucao";
import { formatBRL } from "@/lib/utils";

// Locação encerrada (mock — viria do contrato/fechamento). A caução está em
// conta vinculada em nome do locador; a plataforma só documenta o reembolso.
const LOCACAO = {
  contrato: "VN-CT-2026-0042", // consistency-ignore: dado de demonstração (ReembolsoPreview)
  inquilino: "Ana Carvalho", // consistency-ignore: persona de demonstração (ReembolsoPreview)
  imovel: "Apartamento mobiliado · Centro",
  caucao: 1800,
};

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted">{label}</span>
      <span className={strong ? "font-title font-bold text-forest" : "font-medium text-ink"}>
        {value}
      </span>
    </div>
  );
}

/**
 * Reembolso da caução (fronteira demo/real). O fluxo abaixo usa uma locação
 * encerrada de EXEMPLO (contrato e inquilino fictícios), então só renderiza no
 * MODO DEMONSTRAÇÃO. Conta real vê o estado honesto — o reembolso abre a partir
 * de uma locação encerrada de verdade, sem dado fictício.
 */
export default function ReembolsosPage() {
  const demo = useDashDemo();
  return demo ? <ReembolsoPreview /> : <ReembolsoReal />;
}

function ReembolsoReal() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="Reembolso da caução"
        subtitle="O cálculo do reembolso abre quando uma locação é encerrada."
      />
      <EmptyState
        icon={FileCheck2}
        title="Nenhuma locação encerrada"
        text="Ao encerrar uma locação, a plataforma calcula o reembolso da caução, notifica as partes e registra o prazo legal — com os dados reais do contrato. O pagamento é feito pelo locador; a plataforma nunca movimenta o valor."
        action={
          <ButtonLink href="/dashboard/contratos" variant="primary">
            Ver contratos e locações
          </ButtonLink>
        }
      />
      <div className="mt-4">
        <PlatformLegalNotice />
      </div>
    </div>
  );
}

function ReembolsoPreview() {
  // Fluxo 100% de DOCUMENTAÇÃO. A plataforma nunca movimenta o valor.
  const [descontos, setDescontos] = useState<DescontoReembolso[]>([]);
  const [motivo, setMotivo] = useState("");
  const [valor, setValor] = useState<number>(0);
  const [evidencia, setEvidencia] = useState("");
  const [prazoLimite, setPrazoLimite] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusReembolso>("pendente");

  const totalDesc = useMemo(() => totalDescontos(descontos), [descontos]);
  const valorDevolver = useMemo(
    () => calcularReembolso(LOCACAO.caucao, descontos),
    [descontos]
  );

  function addDesconto() {
    if (!motivo.trim() || valor <= 0) return;
    setDescontos((d) => [...d, { motivo: motivo.trim(), valor, evidencia: evidencia.trim() || null }]);
    setMotivo("");
    setValor(0);
    setEvidencia("");
  }
  function removeDesconto(i: number) {
    setDescontos((d) => d.filter((_, idx) => idx !== i));
  }

  function notificarERegistrarPrazo() {
    // Prazo legal: até 30 dias após a entrega das chaves (registramos a data).
    const limite = new Date(Date.now() + PRAZO_REEMBOLSO_DIAS * 24 * 60 * 60 * 1000);
    setPrazoLimite(limite.toLocaleDateString("pt-BR"));
  }
  function gerarComprovante() {
    setStatus("registrado"); // só marca o status e guarda a prova — não paga
  }

  return (
    <div>
      <PageTitle
        title="Reembolso da caução"
        subtitle="A plataforma calcula, notifica e documenta. O pagamento é feito pelo locador — a plataforma nunca movimenta o valor."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Contexto da locação */}
          <Panel>
            <div className="rounded-xl bg-surface-2 p-4 text-sm">
              <Row label="Contrato" value={LOCACAO.contrato} />
              <Row label="Inquilino" value={LOCACAO.inquilino} />
              <Row label="Imóvel" value={LOCACAO.imovel} />
              <Row label="Caução em conta vinculada" value={formatBRL(LOCACAO.caucao)} />
            </div>
          </Panel>

          {/* a) Comparação com a entrada (o ciclo de vistorias com fotos está por vir) */}
          <Panel title="1. Compare com o estado de entrada">
            <p className="text-sm text-muted">
              Compare o estado do imóvel com o registrado no início da locação — é o que
              fundamenta eventuais descontos. O ciclo de vistorias com fotos e itens está{" "}
              <strong className="text-ink">em estruturação</strong>; por ora, anexe as evidências
              em cada desconto abaixo.
            </p>
          </Panel>

          {/* b) Descontos comprovados */}
          <Panel title="2. Descontos comprovados (danos/pendências)">
            <p className="text-sm text-muted">
              Cada desconto precisa de motivo, valor e evidência. Sem desconto, a caução volta
              integral.
            </p>

            {descontos.length > 0 && (
              <ul className="mt-3 space-y-2">
                {descontos.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-xl border border-sage-200 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-ink">{d.motivo}</span>{" "}
                      <span className="text-muted">
                        · {d.evidencia ? `evidência: ${d.evidencia}` : "sem evidência anexada"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="font-medium text-ink">− {formatBRL(d.valor)}</span>
                      <button
                        type="button"
                        onClick={() => removeDesconto(i)}
                        aria-label="Remover desconto"
                        className="text-muted hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_8rem_1fr_auto]">
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo (ex.: reparo de parede)"
                className="rounded-lg border border-sage-200 px-3 py-2 text-sm outline-none focus:border-sage"
              />
              <input
                type="number"
                min={0}
                value={valor || ""}
                onChange={(e) => setValor(Number(e.target.value))}
                placeholder="Valor"
                className="rounded-lg border border-sage-200 px-3 py-2 text-sm outline-none focus:border-sage"
              />
              <input
                value={evidencia}
                onChange={(e) => setEvidencia(e.target.value)}
                placeholder="Evidência (arquivo/foto)"
                className="rounded-lg border border-sage-200 px-3 py-2 text-sm outline-none focus:border-sage"
              />
              <Button variant="outline" onClick={addDesconto} disabled={!motivo.trim() || valor <= 0}>
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>

            {/* Detalhamento (locador e inquilino veem a mesma conta) */}
            <div className="mt-4 rounded-xl bg-surface-2 p-4 text-sm">
              <Row label="Caução" value={formatBRL(LOCACAO.caucao)} />
              <Row label="Descontos comprovados" value={`− ${formatBRL(totalDesc)}`} />
              <div className="mt-1 border-t border-sage-200 pt-1">
                <Row label="Valor a devolver" value={formatBRL(valorDevolver)} strong />
              </div>
            </div>
          </Panel>

          {/* c) Notificar + prazo + comprovante */}
          <Panel title="3. Notificar, registrar prazo e gerar comprovante">
            <p className="text-sm text-muted">
              A plataforma notifica as partes, registra o prazo legal (devolução em até{" "}
              {PRAZO_REEMBOLSO_DIAS} dias após a entrega das chaves) e gera o comprovante.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={notificarERegistrarPrazo}>
                <BellRing className="h-4 w-4" /> Notificar partes e registrar prazo
              </Button>
              <Button
                variant="gold"
                onClick={gerarComprovante}
                disabled={!prazoLimite || status === "registrado"}
              >
                <FileCheck2 className="h-4 w-4" /> Gerar comprovante de reembolso
              </Button>
            </div>
            {prazoLimite && (
              <p className="mt-3 text-sm text-muted">
                Prazo limite de devolução: <strong className="text-ink">{prazoLimite}</strong>.
              </p>
            )}
          </Panel>

          {/* d) Status + quem paga */}
          {status === "registrado" && (
            <Panel>
              <div className="flex items-center gap-2 rounded-xl bg-sage-100 px-4 py-3 text-sm text-forest">
                <CheckCircle2 className="h-5 w-5" /> Reembolso registrado · comprovante gerado.
              </div>
              <p className="mt-3 flex items-start gap-2 text-sm text-muted">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />O pagamento de{" "}
                <strong className="text-ink">{formatBRL(valorDevolver)}</strong> é feito pelo{" "}
                <strong className="text-ink">locador</strong>, da conta vinculada direto ao
                inquilino. A plataforma <strong className="text-ink">não transfere valores</strong>{" "}
                — apenas marca o status e guarda a prova.
              </p>
            </Panel>
          )}
        </div>

        {/* Coluna lateral: avisos honestos */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" /> Atenção ao prazo
            </p>
            <p className="mt-1">
              A devolução em atraso pode gerar, por lei, devolução em <strong>dobro</strong> ao
              inquilino. A responsabilidade é do locador, não da plataforma.
            </p>
          </div>
          <PlatformLegalNotice />
        </aside>
      </div>
    </div>
  );
}
