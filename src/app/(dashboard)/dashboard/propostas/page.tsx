import Link from "next/link";
import { FileText } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { StatusChip } from "@/components/propostas/status-chip";
import { listarPropostas } from "@/lib/data/propostas-actions";
import { estaAberta, textoVencimento } from "@/lib/propostas/regras";
import { cn, dataBR, formatBRL } from "@/lib/utils";

/**
 * Propostas do inquilino (prompt 27, item 7): a lista das propostas que ele recebeu, com número, imóvel, valor,
 * validade com contagem regressiva e status. As que o proprietário enviou ficam em Orçamentos.
 */
export default async function PropostasPage() {
  const todas = await listarPropostas();
  const recebidas = todas.filter((p) => p.papel === "tenant");
  const enviadas = todas.length - recebidas.length;
  const agora = new Date();
  return (
    <>
      <PageTitle title="Propostas" subtitle="As propostas que os proprietários enviaram para você. Responda antes de vencer." />
      {recebidas.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhuma proposta por enquanto"
          text="Quando um proprietário enviar uma proposta para a sua candidatura, ela aparece aqui e você recebe um aviso."
          action={
            <Link href="/dashboard/candidaturas" className="text-sm font-medium text-forest underline">
              Ver minhas candidaturas
            </Link>
          }
        />
      ) : (
        <Panel title={`${recebidas.length} ${recebidas.length === 1 ? "proposta" : "propostas"}`} data-testid="propostas-inquilino">
          <ul className="divide-y divide-sage-100">
            {recebidas.map((p) => {
              const aberta = estaAberta(p.status);
              const vence = textoVencimento(p.validaAte, agora);
              return (
                <li key={p.id} className="py-3" data-testid="proposta-inquilino" data-status={p.status}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted">{p.numero}</p>
                      <p className="truncate font-medium text-ink">{p.imovel}</p>
                      <p className="text-sm text-ink">
                        {formatBRL(p.valorMensal)}/mês × {p.meses} {p.meses === 1 ? "mês" : "meses"}
                      </p>
                    </div>
                    <StatusChip status={p.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span
                      className={cn(aberta && p.aguardandoVoce ? "font-semibold text-amber-800" : "text-muted")}
                      data-testid="proposta-inquilino-validade"
                    >
                      {aberta ? `Válida até ${dataBR(p.validaAte)} · ${vence}` : `Validade: ${dataBR(p.validaAte)}`}
                      {aberta && p.aguardandoVoce ? " · aguardando a sua resposta" : ""}
                    </span>
                    <Link href={`/dashboard/propostas/${p.id}`} className="font-medium text-forest underline" data-testid="proposta-inquilino-abrir">
                      {aberta && p.aguardandoVoce ? "Responder" : "Ver proposta"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
      {enviadas > 0 && (
        <p className="mt-4 text-sm text-muted">
          As propostas que você enviou como proprietário ficam em{" "}
          <Link href="/dashboard/orcamentos" className="font-medium text-forest underline">
            Orçamentos
          </Link>
          .
        </p>
      )}
    </>
  );
}
