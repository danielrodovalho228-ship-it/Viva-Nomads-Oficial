"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Megaphone, ShieldCheck, Home, Plus, Info, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL, cn, dataBR } from "@/lib/utils";
import {
  motivoLabel,
  motivoPublico,
  RESPOSTA_STATUS_LABEL,
  contemContato,
  CONTATO_AVISO,
  receitaPotencial,
} from "@/lib/pedidos/pedidos";
import { chaveCidade } from "@/lib/cidades";
import { responderPedido } from "@/lib/data/pedidos-actions";
import type { PropriedadeMinima } from "@/lib/data/pedidos-actions";

type PedidoPublico = {
  id: string;
  cidade: string;
  uf: string | null;
  data_inicio: string;
  prazo_meses: number;
  orcamento_mensal: number;
  qtd_ocupantes: number;
  motivo: string;
  apresentacao: string | null;
  expira_em: string;
  inquilino_verificado: boolean;
  pets?: boolean | null;
  criancas?: boolean | null;
  // Compatibilidade REAL (calculada no banco para o MEU melhor imóvel).
  situacao: "compativel" | "quase" | "demais";
  compat_imovel_id: string | null;
  compat_imovel_titulo: string | null;
  compat_nota: number | null;
  compat_motivo: string | null;
  compat_porque: string[];
};
type MinhaResposta = {
  pedido_id: string;
  imovel_id: string;
  status: string;
  properties: { title: string } | null;
};

export function PedidosProprietarioClient({
  pedidos,
  myProperties,
  minhasRespostas,
}: {
  pedidos: Record<string, unknown>[];
  myProperties: PropriedadeMinima[];
  minhasRespostas: Record<string, unknown>[];
}) {
  const router = useRouter();
  const todos = pedidos as unknown as PedidoPublico[];
  const respostas = minhasRespostas as unknown as MinhaResposta[];
  const [aberto, setAberto] = useState<string | null>(null); // pedido em resposta
  const [aba, setAba] = useState<"compativel" | "quase" | "demais">("compativel");
  const [ordem, setOrdem] = useState<"nota" | "recentes" | "potencial" | "prazo">("nota");

  // Abas pela regra do banco (o MESMO imóvel atende tudo — não "algum imóvel").
  const compat = todos.filter((p) => p.situacao === "compativel");
  const quase = todos.filter((p) => p.situacao === "quase");
  const demais = todos.filter((p) => p.situacao === "demais");
  const base = aba === "compativel" ? compat : aba === "quase" ? quase : demais;

  // Link do e-mail ("Responder com este imóvel"): abre o pedido já respondendo.
  const params = useSearchParams();
  const pedidoDoLink = params.get("pedido");
  const imovelDoLink = params.get("imovel");
  useEffect(() => {
    if (!pedidoDoLink) return;
    const p = todos.find((x) => x.id === pedidoDoLink);
    if (!p) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAba(p.situacao);
    setAberto(p.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoDoLink]);

  const lista = [...base].sort((a, b) => {
    if (ordem === "nota") return (b.compat_nota ?? -1) - (a.compat_nota ?? -1);
    if (ordem === "potencial")
      return (
        receitaPotencial(b.orcamento_mensal, b.prazo_meses) -
        receitaPotencial(a.orcamento_mensal, a.prazo_meses)
      );
    if (ordem === "prazo") return b.prazo_meses - a.prazo_meses;
    return (b.data_inicio ?? "").localeCompare(a.data_inicio ?? ""); // mais recentes
  });

  // Status da minha resposta a um pedido (se já respondi).
  const minhaRespostaDoPedido = (pedidoId: string) =>
    respostas.find((r) => r.pedido_id === pedidoId);

  return (
    <div className="container-page py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-title text-2xl font-bold text-ink sm:text-3xl">Pedidos de moradia</h1>
          <p className="mt-1 text-muted">
            Inquilinos dizem o que precisam. Responda com um imóvel seu — a conversa acontece pela
            plataforma.
          </p>
        </div>
      </div>

      {todos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-blue-500" />
          <h3 className="mt-4 font-title text-lg font-bold text-ink">Nenhum pedido ativo por aqui</h3>
          <p className="mx-auto mt-1 max-w-md text-muted">
            Quando um inquilino publicar um pedido na cidade dos seus imóveis, ele aparece aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Tabs Compatíveis / Demais + ordenação (Dashboard Fase 2). */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap rounded-full bg-surface-2 p-0.5 text-sm" role="tablist">
              {(
                [
                  ["compativel", `Compatíveis (${compat.length})`],
                  ["quase", `Quase (${quase.length})`],
                  ["demais", `Demais na cidade (${demais.length})`],
                ] as const
              ).map(([chave, rotulo]) => (
                <button
                  key={chave}
                  type="button"
                  role="tab"
                  aria-selected={aba === chave}
                  onClick={() => setAba(chave)}
                  className={cn(
                    "rounded-full px-4 py-1.5 font-medium transition-colors",
                    aba === chave ? "bg-forest text-white" : "text-muted"
                  )}
                >
                  {rotulo}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              Ordenar
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as typeof ordem)}
                className="rounded-lg border border-line bg-white px-2 py-1 text-sm text-ink outline-none focus:border-sage"
              >
                <option value="nota">Melhor combinação</option>
                <option value="recentes">Mais recentes</option>
                <option value="potencial">Maior potencial</option>
                <option value="prazo">Prazo mais longo</option>
              </select>
            </label>
          </div>

          {lista.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line bg-white px-5 py-8 text-center text-sm text-muted">
              {aba === "compativel"
                ? "Nenhum pedido combina com um imóvel seu agora. Veja os que quase combinam."
                : aba === "quase"
                  ? "Nenhum pedido quase compatível no momento."
                  : "Sem outros pedidos na cidade no momento."}
            </p>
          )}

        <div className="grid gap-4 sm:grid-cols-2">
          {lista.map((p) => {
            const naCidade = myProperties.filter((m) => chaveCidade(m.city) === chaveCidade(p.cidade));
            // O imóvel que combina (ou o do link do e-mail) vem primeiro no seletor.
            const preferido = p.id === pedidoDoLink && imovelDoLink ? imovelDoLink : p.compat_imovel_id;
            const compativeis = [
              ...naCidade.filter((m) => m.id === preferido),
              ...naCidade.filter((m) => m.id !== preferido),
            ];
            const temImovelNaCidade = naCidade.length > 0;
            const jaRespondi = minhaRespostaDoPedido(p.id);
            return (
              <article
                key={p.id}
                className="relative overflow-hidden rounded-2xl border border-line bg-white p-5 pl-6"
              >
                {/* Barra dourada à esquerda (padrão do protótipo) */}
                <span className="absolute inset-y-0 left-0 w-1.5 bg-gold" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-title text-lg font-bold text-forest">
                      {motivoPublico(p.motivo)}
                    </h3>
                    <p className="text-xs text-muted">{motivoLabel(p.motivo)}</p>
                  </div>
                  {p.inquilino_verificado && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-forest">
                      <ShieldCheck className="h-3.5 w-3.5" /> Verificado
                    </span>
                  )}
                </div>

                {/* Receita potencial do período — o lead chega precificado (Fase 2). */}
                <div className="mt-3 flex items-baseline justify-between rounded-lg bg-champagne/15 px-3 py-2">
                  <span className="text-xs font-medium text-muted">Potencial do período</span>
                  <span className="font-title text-lg font-bold text-forest">
                    {formatBRL(receitaPotencial(p.orcamento_mensal, p.prazo_meses))}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted">
                  Estimativa pelo orçamento e prazo declarados.
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Meta label="Cidade" value={`${p.cidade}${p.uf ? `/${p.uf}` : ""}`} />
                  <Meta label="A partir de" value={dataBR(p.data_inicio)} />
                  <Meta label="Período" value={`${p.prazo_meses} meses`} />
                  <Meta label="Ocupantes" value={`${p.qtd_ocupantes}`} />
                  <Meta label="Orçamento" value={`${formatBRL(p.orcamento_mensal)}/mês`} />
                  <Meta label="Expira" value={dataBR(p.expira_em)} />
                </div>

                {p.apresentacao && (
                  <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink">
                    {p.apresentacao}
                  </p>
                )}

                {(p.pets || p.criancas) && (
                  <p className="mt-2 text-xs text-muted">
                    {[p.pets && "Com pet", p.criancas && "Com crianças"].filter(Boolean).join(" · ")}
                  </p>
                )}

                {/* Qual imóvel MEU combina e por quê (ou o que falta). */}
                {p.situacao !== "demais" && p.compat_imovel_titulo && (
                  <div
                    className={cn(
                      "mt-3 rounded-lg px-3 py-2 text-sm",
                      p.situacao === "compativel" ? "bg-sage-100 text-forest" : "bg-amber-50 text-amber-900"
                    )}
                  >
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Sparkles className="h-4 w-4" />
                      {p.situacao === "compativel" ? "Combina com" : "Quase combina com"} “{p.compat_imovel_titulo}”
                      {p.compat_nota != null && <span className="ml-auto text-xs font-medium">nota {p.compat_nota}/100</span>}
                    </p>
                    {p.situacao === "compativel" ? (
                      <ul className="mt-1 list-disc pl-5 text-xs">
                        {p.compat_porque.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    ) : (
                      p.compat_motivo && <p className="mt-1 text-xs">Falta pouco: {p.compat_motivo}.</p>
                    )}
                  </div>
                )}

                {/* Ação: responder / status / CTA de captação */}
                <div className="mt-4">
                  {jaRespondi ? (
                    <p className="flex items-center gap-2 rounded-lg bg-sage-100 px-3 py-2 text-xs text-forest">
                      <Check className="h-4 w-4" /> Você respondeu com{" "}
                      <strong>{jaRespondi.properties?.title ?? "seu imóvel"}</strong> ·{" "}
                      {RESPOSTA_STATUS_LABEL[jaRespondi.status] ?? jaRespondi.status}
                    </p>
                  ) : !temImovelNaCidade ? (
                    <Link href="/qualificar">
                      <Button variant="ghost" className="w-full">
                        <Plus className="h-4 w-4" /> Cadastrar imóvel em {p.cidade}
                      </Button>
                    </Link>
                  ) : aberto === p.id ? (
                    <ResponderForm
                      pedido={p}
                      compativeis={compativeis}
                      onCancel={() => setAberto(null)}
                      onDone={() => {
                        setAberto(null);
                        router.refresh();
                      }}
                    />
                  ) : (
                    <Button variant="gold" className="w-full" onClick={() => setAberto(p.id)}>
                      <Home className="h-4 w-4" />{" "}
                      {p.situacao === "compativel" ? "Responder com este imóvel" : "Responder com meu imóvel"}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}

function ResponderForm({
  pedido,
  compativeis,
  onCancel,
  onDone,
}: {
  pedido: PedidoPublico;
  compativeis: PropriedadeMinima[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [imovelId, setImovelId] = useState(compativeis[0]?.id ?? "");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const contatoNoTexto = mensagem.length > 0 && contemContato(mensagem);

  async function enviar() {
    setErro(null);
    if (contatoNoTexto) {
      setErro(CONTATO_AVISO);
      return;
    }
    setEnviando(true);
    const res = await responderPedido(pedido.id, imovelId, mensagem || undefined);
    setEnviando(false);
    if (res.ok) onDone();
    else setErro(res.error ?? "Não foi possível responder.");
  }

  return (
    <div className="space-y-3 rounded-xl border border-sage-200 p-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Imóvel</span>
        <select
          value={imovelId}
          onChange={(e) => setImovelId(e.target.value)}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-sage"
        >
          {compativeis.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} · {formatBRL(m.monthlyPrice)}/mês
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Mensagem (opcional)</span>
        <textarea
          rows={2}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Apresente o imóvel. Sem telefone/e-mail — a conversa é pela plataforma."
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-sage",
            contatoNoTexto ? "border-red-300" : "border-line"
          )}
        />
        {contatoNoTexto && (
          <span className="mt-1 flex items-start gap-1.5 text-xs text-red-600">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {CONTATO_AVISO}
          </span>
        )}
      </label>
      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={enviando}>
          Cancelar
        </Button>
        <Button variant="gold" onClick={enviar} disabled={enviando || contatoNoTexto || !imovelId}>
          {enviando ? "Enviando…" : "Enviar resposta"}
        </Button>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-medium text-ink">{value}</p>
    </div>
  );
}
