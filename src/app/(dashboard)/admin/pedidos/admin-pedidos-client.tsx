"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, RotateCcw } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { ListaNumeros, NumeroHeroi } from "@/components/admin/numeros";
import type { MetricasPedidos } from "@/lib/data/pedidos-compat";
import type { Recorte } from "@/lib/admin/indicadores";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import { motivoLabel, PEDIDO_STATUS_LABEL } from "@/lib/pedidos/pedidos";
import { moderarPedido, reativarPedido } from "@/lib/data/pedidos-admin";
import { SoLeituraQa } from "@/components/admin/so-leitura-qa";
import { MotivoDialog } from "@/components/admin/motivo-dialog";
import { dataPedidoBR, textoBairros, textoFaixaValor } from "@/lib/pedidos/campos";
import type { ColunasPedidoAdmin } from "@/lib/data/pedidos-admin-colunas";
import { abasPedidos, filtrarPedidosAdmin } from "@/lib/admin/pedidos-filtro";
import { rotuloDoAdmin } from "@/config/menu-admin";

type Pedido = {
  id: string;
  cidade: string;
  uf: string | null;
  motivo: string;
  prazo_meses: number;
  qtd_ocupantes: number;
  orcamento_mensal: number;
  apresentacao: string | null;
  status: string;
  removido_motivo: string | null;
  criado_em: string;
  data_inicio: string;
  orcamento_min: number | null;
  bairros: string[] | null;
  compativeis_ao_publicar: number | null;
  colunas: ColunasPedidoAdmin | null;
};

const TONE: Record<string, string> = {
  ativo: "border border-line bg-white text-forest",
  pausado: "border border-line bg-white text-amber-800",
  atendido: "border border-line bg-white text-forest",
  expirado: "bg-surface-2 text-muted",
  removido_admin: "border border-line bg-white text-red-700",
  excluido: "bg-surface-2 text-muted",
};

type Resposta = { total: number; comResposta: number; taxa: number | null; medianaHoras: number | null; janela: string; compativel: string };

export function AdminPedidosClient({
  pedidos,
  metricas,
  resposta,
  rotuloFiltro,
  recorte,
  filtroUrl,
  soLeitura = [],
}: {
  pedidos: Record<string, unknown>[];
  metricas: MetricasPedidos | null;
  resposta: Resposta;
  rotuloFiltro: string | null;
  recorte: Recorte;
  filtroUrl: { de: string; ate: string; cidade: string | null; status: string | null; expirando: boolean };
  /** Pendência 3 do QA-LOGIN-B v2: pedidos que o admin observador da QA só lê (sem Ocultar/Reativar). */
  soLeitura?: string[];
}) {
  const router = useRouter();
  const todos = pedidos as unknown as Pedido[];
  const [q, setQ] = useState("");
  const [aba, setAba] = useState("todos");
  const abas = abasPedidos(todos);
  const lista = filtrarPedidosAdmin(todos, { q, aba });
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<Record<string, string>>({});
  const [ocultando, setOcultando] = useState<Pedido | null>(null);

  async function ocultar(motivo: string): Promise<string | null> {
    if (!ocultando) return null;
    const res = await moderarPedido(ocultando.id, motivo);
    if (!res.ok) return res.error ?? "Não foi possível ocultar.";
    setOcultando(null);
    router.refresh();
    return null;
  }
  async function reativar(id: string) {
    setBusy(id);
    setErro((e) => ({ ...e, [id]: "" }));
    const res = await reativarPedido(id);
    setBusy(null);
    if (!res.ok) setErro((e) => ({ ...e, [id]: res.error ?? "Não foi possível reativar." }));
    router.refresh();
  }

  return (
    <>
      <PageTitle
        title={rotuloDoAdmin("/admin/pedidos")}
        subtitle="Ocultar pedidos impróprios (com motivo, notificando o inquilino) e reativar."
      />
      {/* Recorte único dos cartões e da lista (complemento do P29, item 5b). */}
      <form method="get" action="/admin/pedidos" className="mb-4 flex flex-wrap items-end gap-2" data-testid="pedidos-recorte">
        <input type="hidden" name="de" value={filtroUrl.de} />
        <input type="hidden" name="ate" value={filtroUrl.ate} />
        {filtroUrl.cidade && <input type="hidden" name="cidade" value={filtroUrl.cidade} />}
        {filtroUrl.status && <input type="hidden" name="status" value={filtroUrl.status} />}
        {filtroUrl.expirando && <input type="hidden" name="expirando" value="1" />}
        <label className="grid gap-1 text-sm text-muted">
          Contas
          <select name="tipo" defaultValue={recorte} className="rounded-xl border border-line px-3 py-2 text-sm text-ink" data-testid="filtro-tipo">
            <option value="real">Real</option>
            <option value="teste">Teste</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <Button type="submit" size="sm">
          Aplicar
        </Button>
      </form>
      <MetricasPedidosPainel m={metricas} r={resposta} />
      <p className="mb-3 text-sm text-ink">
        <strong data-testid="lista-total">{lista.length}</strong> {lista.length === 1 ? "pedido" : "pedidos"} nesta lista
        {rotuloFiltro ? ` · ${rotuloFiltro}` : ""}
      </p>
      <div className="mb-3 grid gap-2" data-testid="pedidos-busca-abas">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={60}
          placeholder="Buscar por nome, cidade ou bairro"
          aria-label="Buscar pedidos"
          className="min-h-11 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink"
          data-testid="pedidos-busca"
        />
        <div role="tablist" aria-label="Situação do pedido" className="flex flex-wrap gap-2">
          {abas.map((a) => (
            <button
              key={a.valor}
              type="button"
              role="tab"
              aria-selected={aba === a.valor}
              onClick={() => setAba(a.valor)}
              className={cn("min-h-11 rounded-full border px-3 text-sm", aba === a.valor ? "border-forest bg-sage-100 font-semibold text-forest" : "border-line text-ink")}
              data-testid={`pedidos-aba-${a.valor}`}
            >
              {a.rotulo} ({a.total})
            </button>
          ))}
        </div>
      </div>
      <Panel className="scroll-mt-24 p-0 pt-6" id="lista">
        <div className="overflow-x-auto px-6 pb-6">
          {lista.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">{todos.length === 0 ? "Nenhum pedido no sistema." : "Nenhum pedido com esse filtro."}</p>
          ) : (
            <table className="w-full min-w-[960px] text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 font-semibold">Inquilino · motivo · cidade</th>
                  <th className="py-2 font-semibold">Entrada</th>
                  <th className="py-2 font-semibold">Faixa · bairros</th>
                  <th className="py-2 font-semibold">Selos</th>
                  <th className="py-2 font-semibold">Respostas</th>
                  <th className="py-2 font-semibold">Detalhes</th>
                  <th className="py-2 font-semibold">Status</th>
                  <th className="py-2 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sage-200">
                {lista.map((p) => (
                  <tr key={p.id} className={cn(p.status === "removido_admin" && "opacity-70")}>
                    <td className="py-3" data-testid="admin-pedido-linha" data-pedido={p.id}>
                      <p className="font-semibold text-ink" data-testid="admin-pedido-nome">{p.colunas?.nome ?? "—"}</p>
                      <p className="text-xs text-muted">
                        {motivoLabel(p.motivo)} · {p.cidade}
                        {p.uf ? `/${p.uf}` : ""}
                      </p>
                    </td>
                    <td className="py-3 whitespace-nowrap text-ink">{dataPedidoBR(`${p.data_inicio}T12:00:00Z`)}</td>
                    <td className="py-3 text-ink">
                      <span className="block whitespace-nowrap">{textoFaixaValor(p.orcamento_min, p.orcamento_mensal)}</span>
                      <span className="block text-xs text-muted">{textoBairros(p.bairros)}</span>
                    </td>
                    <td className="py-3">
                      <ul className="flex flex-wrap gap-1">
                        {(p.colunas?.selos ?? []).map((s) => (
                          <li key={s.codigo} className={cn("rounded-full px-2 py-1 text-[11px]", s.ok ? "bg-sage-100 text-forest" : "border border-line bg-white text-amber-900")}>
                            {s.texto}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="py-3 text-ink" data-testid="admin-pedido-respostas">{p.colunas?.respostas ?? 0}</td>
                    <td className="py-3 text-muted">
                      {p.prazo_meses}m · {p.qtd_ocupantes}p · {formatBRL(p.orcamento_mensal)}/mês
                      {p.apresentacao && (
                        <span className="block max-w-xs truncate text-xs">{p.apresentacao}</span>
                      )}
                      {p.status === "removido_admin" && p.removido_motivo && (
                        <span className="block text-xs text-red-600">
                          Motivo: {p.removido_motivo}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-xs font-semibold",
                          TONE[p.status] ?? "bg-surface-2 text-muted"
                        )}
                      >
                        {PEDIDO_STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end">
                        {soLeitura.includes(p.id) ? (
                          <SoLeituraQa className="text-right" />
                        ) : p.status === "removido_admin" ? (
                          <Button
                            variant="ghost"
                            onClick={() => reativar(p.id)}
                            disabled={busy === p.id}
                          >
                            <RotateCcw className="h-4 w-4" /> Reativar
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            onClick={() => setOcultando(p)}
                            disabled={busy === p.id}
                          >
                            <EyeOff className="h-4 w-4" /> Ocultar
                          </Button>
                        )}
                      </div>
                      {erro[p.id] && (
                        <p role="alert" className="mt-1 text-right text-xs text-red-600">
                          {erro[p.id]}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      <MotivoDialog
        // key: cada abertura começa limpa (sem o motivo de uma tentativa anterior).
        key={ocultando?.id ?? "fechado"}
        open={!!ocultando}
        titulo="Ocultar pedido"
        descricao={
          ocultando
            ? `${motivoLabel(ocultando.motivo)} · ${ocultando.cidade}. O motivo fica registrado e vai ao inquilino.`
            : undefined
        }
        confirmar="Ocultar"
        onCancel={() => setOcultando(null)}
        onConfirm={ocultar}
      />
    </>
  );
}

/**
 * Números dos pedidos. "Pedidos", "Pedidos com resposta" e "Tempo até a 1ª resposta" são os da home (respostaPedidos);
 * compatível e avisos continuam da 0059 (últimos 30 dias). "—" quando não há dado.
 */
function MetricasPedidosPainel({ m, r }: { m: MetricasPedidos | null; r: Resposta }) {
  const taxa = r.taxa === null ? "—" : `${Math.round(r.taxa * 1000) / 10}%`.replace(".", ",");
  const horas = r.medianaHoras === null ? "—" : `${String(r.medianaHoras).replace(".", ",")} h`;
  return (
    <div className="mb-6">
      <p className="mb-2 text-sm text-muted" data-testid="pedidos-janela">{r.janela}</p>
      <NumeroHeroi rotulo="Pedidos do período" valor={r.total} href="#lista" />
      <ListaNumeros
        itens={[
          { rotulo: "Pedidos com resposta", valor: taxa, href: "#lista" },
          { rotulo: "Tempo até a 1ª resposta (mediana)", valor: horas, href: "#lista" },
          { rotulo: "Pedidos respondidos", valor: r.comResposta, href: "#lista" },
          { rotulo: "Com compatível ao publicar", valor: r.compativel.match(/\d+%$/)?.[0] ?? "—", nota: r.compativel, href: "#lista" },
          { rotulo: "Avisos enviados (30 dias)", valor: m ? m.avisos_email + m.avisos_resumo : "—", href: "#lista" },
        ]}
      />
      <ul className="mt-2 space-y-1 text-xs text-muted" data-testid="formulas-pedidos">
        <li>Pedidos com resposta = pedidos do período que receberam pelo menos 1 contato ou proposta ÷ pedidos do período. A mesma conta da visão geral.</li>
        <li>Tempo até a 1ª resposta = mediana do tempo entre a publicação e o 1º contato ou proposta.</li>
        <li>Com compatível ao publicar = pedidos dos últimos 30 dias com pelo menos 1 imóvel compatível no momento da publicação (compativeis_ao_publicar &gt; 0) ÷ pedidos dos últimos 30 dias.</li>
        <li>Avisos enviados = avisos aos donos de imóveis compatíveis (e-mail no resumo diário), últimos 30 dias.</li>
      </ul>
    </div>
  );
}
