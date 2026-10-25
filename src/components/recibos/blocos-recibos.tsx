import Link from "next/link";
import { Download } from "lucide-react";
import { Panel } from "@/components/dashboard/primitives";
import { ButtonLink } from "@/components/ui/button";
import { brl, dataBR } from "@/lib/fiscal/documento";
import { recibosDaPessoa, servicosConcluidosDoParceiro } from "@/lib/data/recibos";
import { rotuloCategoria } from "@/lib/parceiros/regras";
import { AVISO_FIXO, ROTULO_RECIBO, pendenciasDeNota, resumoCarneLeao, rotuloMes, type Recibo } from "@/lib/recibos/regras";
import { hojeBR } from "@/lib/utils";

/*
  Prompt 39-B, fase 1 — os blocos "Recibos e notas" dentro das abas de cada papel (sem aba nova):
  proprietário na aba Ganhos (Contratos & blocos), morador na aba Estadias (Locações), parceiro na seção Ganhos.
  Só leitura: os documentos já existem (documentos_fiscais e o documento que o parceiro envia no pedido).
*/

const linkBaixar = "inline-flex min-h-11 items-center gap-1 text-sm font-medium text-forest underline underline-offset-4";

/** Proprietário, no celular: a porta para /dashboard/recibos com o total do mês. No computador, o menu leva lá. */
export async function BlocoRecibosDono() {
  const d = await recibosDaPessoa("dono");
  if (!d) return null;
  const mes = hojeBR().slice(0, 7);
  const total = resumoCarneLeao(d.recibos, mes).total;
  return (
    <Panel title="Recibos e notas" className="mb-6 lg:hidden" data-testid="bloco-recibos-dono">
      <p className="text-sm text-muted">
        Recebido em {rotuloMes(mes)}: <strong className="text-ink">{brl(total)}</strong>
      </p>
      <p className="mt-1 text-xs text-muted">{AVISO_FIXO}</p>
      <ButtonLink href="/dashboard/recibos" variant="secondary" size="sm" className="mt-3" data-testid="bloco-recibos-dono-abrir">
        Ver recibos e resumos
      </ButtonLink>
    </Panel>
  );
}

function itemDocumento(r: Recibo) {
  return (
    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="recibo-morador-item">
      <span className="min-w-0 text-sm">
        <span className="block text-ink">
          {ROTULO_RECIBO[r.tipo]} · {r.numero}
        </span>
        <span className="block text-xs text-muted">
          {dataBR(r.data)} · {brl(r.valor)}
          {r.anulado ? " · anulado" : ""}
        </span>
      </span>
      <a href={`/api/documentos/${r.id}`} className={linkBaixar} data-testid="recibo-morador-baixar">
        <Download className="h-4 w-4" aria-hidden /> PDF
      </a>
    </li>
  );
}

/** Morador, na aba Estadias: recibos e comprovante de Caução de cada estadia, resumo para reembolso e resumo anual. */
export async function BlocoRecibosMorador() {
  const d = await recibosDaPessoa("morador");
  if (!d || d.recibos.length === 0) return null;
  const porEstadia = new Map<string, Recibo[]>();
  for (const r of d.recibos) {
    if (!r.contratoId) continue;
    porEstadia.set(r.contratoId, [...(porEstadia.get(r.contratoId) ?? []), r]);
  }
  const anos = [...new Set(d.recibos.map((r) => Number(r.data.slice(0, 4))))].sort((a, b) => b - a);
  return (
    <Panel id="recibos-notas" title="Recibos e notas" className="mt-6 scroll-mt-24" data-testid="bloco-recibos-morador">
      <div className="grid gap-4">
        {[...porEstadia.entries()].map(([contratoId, lista]) => (
          <section key={contratoId} className="rounded-xl border border-sage-200 p-4" data-testid="recibos-estadia" data-contrato={contratoId}>
            <h3 className="font-title text-base font-semibold text-ink">{lista[0].imovelTitulo}</h3>
            <ul className="mt-2 divide-y divide-line">{lista.map(itemDocumento)}</ul>
            <a href={`/api/recibos/reembolso?contrato=${contratoId}`} className={`${linkBaixar} mt-2`} data-testid="recibos-reembolso-pdf">
              <Download className="h-4 w-4" aria-hidden /> Resumo para reembolso da empresa (PDF)
            </a>
          </section>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4">
        {anos.map((ano) => (
          <a key={ano} href={`/api/recibos/informe?ano=${ano}&papel=morador`} className={linkBaixar} data-testid="recibos-morador-anual">
            <Download className="h-4 w-4" aria-hidden /> Resumo anual {ano} para a declaração (PDF)
          </a>
        ))}
      </div>
    </Panel>
  );
}

/**
 * Parceiro, na seção Ganhos: serviços concluídos com o documento de cada um (quando o parceiro enviou), a pendência
 * "Falta a nota do serviço X" e o resumo anual. O comprovante do gateway da divisão 90/10 só existe com o pagamento
 * pela plataforma ligado (PAGAMENTO_PARCEIROS_ATIVO); desligado, a parte nem aparece.
 */
export async function BlocoRecibosParceiro({ pagamentoAtivo }: { pagamentoAtivo: boolean }) {
  const p = await servicosConcluidosDoParceiro();
  if (!p) return null;
  const pendencias = pendenciasDeNota(p.servicos);
  const anos = [...new Set([Number(hojeBR().slice(0, 4)), ...p.servicos.map((s) => Number(s.concluidoEm.slice(0, 4)))])].sort((a, b) => b - a);
  return (
    <Panel id="recibos-notas" title="Recibos e notas" className="mb-6 scroll-mt-24" data-testid="bloco-recibos-parceiro">
      {pendencias.length > 0 && (
        <ul className="mb-3 grid gap-1" data-testid="parceiro-pendencias-nota">
          {pendencias.map((t) => (
            <li key={t} className="text-sm font-medium text-ink" data-testid="parceiro-pendencia-nota">
              {t}
            </li>
          ))}
        </ul>
      )}
      {p.servicos.length === 0 ? (
        <p className="text-sm text-muted">Os serviços concluídos aparecem aqui, com a sua nota de cada um.</p>
      ) : (
        <ul className="divide-y divide-line">
          {p.servicos.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="parceiro-servico-concluido">
              <span className="min-w-0 text-sm">
                <span className="block text-ink">
                  {rotuloCategoria(s.categoria)} · {s.codigo}
                </span>
                <span className="block text-xs text-muted">
                  {dataBR(s.concluidoEm)} · {s.cliente}
                  {s.valor != null ? ` · ${brl(s.valor)}` : ""}
                </span>
              </span>
              <Link href={`/dashboard/servicos/pedidos/${s.id}`} className={linkBaixar} data-testid="parceiro-servico-documento">
                {s.temDocumento ? "Ver a sua nota" : "Enviar a nota"}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pagamentoAtivo && (
        <p className="mt-3 text-sm text-muted" data-testid="parceiro-comprovante-gateway">
          Comprovante da divisão 90/10 de cada pagamento: aparece no pedido assim que o pagamento é confirmado.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-x-4">
        {anos.map((ano) => (
          <a key={ano} href={`/api/recibos/parceiro?ano=${ano}`} className={linkBaixar} data-testid="parceiro-resumo-anual">
            <Download className="h-4 w-4" aria-hidden /> Resumo anual {ano} para o contador (PDF)
          </a>
        ))}
      </div>
    </Panel>
  );
}
