import { NumeroDaFonte } from "@/components/admin/numero-da-fonte";
import Link from "next/link";
import { FileSignature } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button, ButtonLink } from "@/components/ui/button";
import { SeloTeste } from "@/components/admin/selo-teste";
import { adminDaPagina, contratosReais, intervaloBRT, nomesCurtos } from "@/lib/data/admin-indicadores";
import {
  agregarContratos,
  ehRegraAnterior,
  faltaAssinar,
  mesesDoContrato,
  periodoDaLista,
  FORMULA_TAKE_RATE,
  FORMULA_TAXA,
  FORMULA_VALOR_TOTAL,
} from "@/lib/admin/indicadores";
import { fmtPct, fmtReais, rotuloPeriodo } from "@/lib/admin/visao-geral";
import { refContratoVN } from "@/lib/fiscal/fila-falhas";
import { rotuloBaseTaxa } from "@/lib/taxa-servico-base";
import { dataBRT } from "@/lib/datas-brasilia";
import { estadosConferenciaEntrada } from "@/lib/data/contrato-admin";
import { ROTULO_ESTADO_CONFERENCIA, type EstadoConferenciaLista } from "@/lib/conferencia";
import { rotuloDoAdmin, tituloDoAdmin } from "@/config/menu-admin";

export const metadata = { title: tituloDoAdmin("/admin/contratos"), robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_assinatura: "Aguardando assinatura",
  assinado: "Assinado",
  ativo: "Ativo",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

/**
 * Admin → Contratos (Prompt 29, item 5): todos os contratos, sem depender de Documentos ou Financeiro. A lista e os
 * totais saem de contratosReais + agregarContratos — a MESMA conta do Financeiro e da home. Nomes das partes só aqui
 * (área do admin), em nome curto.
 */
export default async function AdminContratosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const um = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 80) : "");
  const p = periodoDaLista({ de: um("de"), ate: um("ate") });
  const cidade = um("cidade") || null;
  const tipo = (["teste", "todos"].includes(um("tipo")) ? um("tipo") : "real") as "real" | "teste" | "todos";
  const status = um("status");
  const q = um("q").toLowerCase();
  const dono = um("dono").toLowerCase();
  const inquilino = um("inquilino").toLowerCase();

  const admin = await adminDaPagina();
  const todos = admin ? await contratosReais(admin, p ? intervaloBRT(p.inicio, p.fim) : undefined, cidade, tipo) : [];
  const nomes = admin ? await nomesCurtos(admin, todos.flatMap((c) => [c.ownerId, c.tenantId])) : new Map<string, string>();
  const lista = todos.filter(
    (c) =>
      (!status || c.status === status) &&
      (!q || c.id.toLowerCase().startsWith(q.replace(/^vn-ct-/, "")) || c.imovel.toLowerCase().includes(q)) &&
      (!dono || (nomes.get(c.ownerId) ?? "").toLowerCase().includes(dono)) &&
      (!inquilino || (nomes.get(c.tenantId) ?? "").toLowerCase().includes(inquilino))
  );
  const ag = agregarContratos(lista);
  // Coluna "Conferência de entrada" (Prompt 35B, F5): Não aberta / Em andamento / Aguardando a outra parte / Confirmada / Contestada.
  const conferencias = admin ? await estadosConferenciaEntrada(admin, lista.map((c) => c.id)) : new Map<string, EstadoConferenciaLista>();
  const statusVistos = [...new Set(todos.map((c) => c.status))].sort();
  const campo = "rounded-xl border border-line px-3 py-2 text-sm text-ink";

  return (
    <div data-testid="admin-contratos">
      <PageTitle
        title={rotuloDoAdmin("/admin/contratos")}
        subtitle={`${p ? rotuloPeriodo(p.inicio, p.fim) : "Todos os períodos"}${cidade ? ` · ${cidade}` : ""} · ${tipo === "real" ? "só reais" : tipo === "teste" ? "só de teste" : "reais e de teste"}`}
        action={
          <span className="flex flex-wrap gap-3">
            <Link href="/admin/contratos/encerramentos" className="text-sm text-forest underline" data-testid="admin-link-encerramentos">
              Pedidos de encerramento
            </Link>
            <Link href="/admin/financeiro" className="text-sm text-forest underline">
              Ver o financeiro
            </Link>
          </span>
        }
      />
      <NumeroDaFonte chave="estadias" />
      <form action="/admin/contratos" method="get" className="mb-4 flex flex-wrap items-end gap-2" role="search">
        {p && <input type="hidden" name="de" value={p.inicio} />}
        {p && <input type="hidden" name="ate" value={p.fim} />}
        {cidade && <input type="hidden" name="cidade" value={cidade} />}
        <label className="grid gap-1 text-sm text-muted">
          Número ou imóvel
          <input name="q" defaultValue={um("q")} maxLength={80} className={campo} />
        </label>
        <label className="grid gap-1 text-sm text-muted">
          Proprietário
          <input name="dono" defaultValue={um("dono")} maxLength={80} className={campo} />
        </label>
        <label className="grid gap-1 text-sm text-muted">
          Inquilino
          <input name="inquilino" defaultValue={um("inquilino")} maxLength={80} className={campo} />
        </label>
        <label className="grid gap-1 text-sm text-muted">
          Situação
          <select name="status" defaultValue={status} className={campo}>
            <option value="">Todas</option>
            {statusVistos.map((s) => (
              <option key={s} value={s}>
                {STATUS[s] ?? s}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm text-muted">
          Tipo
          <select name="tipo" defaultValue={tipo} className={campo} data-testid="filtro-tipo">
            <option value="real">Real</option>
            <option value="teste">Teste</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
      </form>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="contratos-totais">
        <Total rotulo="Contratos" valor={String(ag.contratos)} formula="Contratos desta lista." testid="lista-total" />
        <Total rotulo="Valor total dos contratos" valor={fmtReais(ag.valorTotal)} formula={FORMULA_VALOR_TOTAL} testid="contratos-valor-total" />
        <Total rotulo="Taxa de serviço" valor={fmtReais(ag.taxa)} formula={FORMULA_TAXA} testid="contratos-taxa" />
        <Total rotulo="Take rate" valor={fmtPct(ag.takeRate)} formula={FORMULA_TAKE_RATE} testid="contratos-take-rate" />
      </div>

      <Panel title={`Contratos (${lista.length})`}>
        {lista.length === 0 ? (
          <EmptyState icon={FileSignature} title="Nenhum contrato nesta lista" text="Tire um filtro para ver outros." action={<ButtonLink href="/admin/contratos" variant="secondary" size="sm">Ver todos os contratos</ButtonLink>} />
        ) : (
          <ul className="grid gap-3">
            {lista.map((c) => {
              const meses = mesesDoContrato(c.prazoDias);
              return (
                <li key={c.id} className="rounded-xl border border-line p-3 text-sm" data-testid="contrato-linha">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink">
                      {refContratoVN(c.id)} · {c.imovel}
                      {c.teste && <SeloTeste />}
                      {ehRegraAnterior(c) && <span className="ml-2 rounded-full border border-line bg-white px-2 py-1 text-xs text-muted">regra anterior</span>}
                    </span>
                    <span className="text-xs text-muted">criado em {dataBRT(c.criadoEm)}</span>
                  </div>
                  <p className="mt-1 text-muted">
                    Proprietário: {nomes.get(c.ownerId) ?? "—"} · Inquilino: {nomes.get(c.tenantId) ?? "—"} · {STATUS[c.status] ?? c.status} ·{" "}
                    <span data-testid="contrato-assinatura">{faltaAssinar(c)}</span>
                  </p>
                  <p className="mt-1 text-ink">
                    Valor mensal {fmtReais(c.aluguelMensal)} × {meses} {meses === 1 ? "mês" : "meses"} ={" "}
                    <strong>{fmtReais((c.aluguelMensal ?? 0) * meses)}</strong>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Conferência de entrada:{" "}
                    <span className="font-semibold text-ink" data-testid="contrato-conferencia-entrada">
                      {ROTULO_ESTADO_CONFERENCIA[conferencias.get(c.id) ?? "nao_aberta"]}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted" data-testid="contrato-rotulo-taxa">
                    Taxa de serviço:{" "}
                    {rotuloBaseTaxa({ valor: c.taxaValor ?? 0, percent: c.taxaPercent ?? 0, aluguelMensal: c.aluguelMensal ?? 0, meses, aceiteEm: c.aceiteEm })}
                  </p>
                  <p className="mt-2 flex flex-wrap gap-3 text-xs">
                    <Link href={`/admin/contratos/${c.id}`} className="font-semibold text-forest underline" data-testid="abrir-contrato-admin">
                      Abrir o contrato
                    </Link>
                    <Link href="/admin/financeiro" className="font-semibold text-forest underline">
                      Financeiro
                    </Link>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Total({ rotulo, valor, formula, testid }: { rotulo: string; valor: string; formula: string; testid: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3" title={formula}>
      <p className="text-sm text-muted">{rotulo}</p>
      <p className="mt-1 font-title text-2xl font-semibold text-ink" data-testid={testid}>
        {valor}
      </p>
      <p className="mt-1 text-xs text-muted">{formula}</p>
    </div>
  );
}
