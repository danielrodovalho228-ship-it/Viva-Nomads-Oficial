"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, ShieldCheck, Home, Plus, Info, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import {
  motivoLabel,
  motivoPublico,
  RESPOSTA_STATUS_LABEL,
  contemContato,
  CONTATO_AVISO,
} from "@/lib/pedidos/pedidos";
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
  const lista = pedidos as unknown as PedidoPublico[];
  const respostas = minhasRespostas as unknown as MinhaResposta[];
  const [aberto, setAberto] = useState<string | null>(null); // pedido em resposta

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

      {lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-blue-500" />
          <h3 className="mt-4 font-title text-lg font-bold text-ink">Nenhum pedido ativo por aqui</h3>
          <p className="mx-auto mt-1 max-w-md text-muted">
            Quando um inquilino publicar um pedido na cidade dos seus imóveis, ele aparece aqui.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {lista.map((p) => {
            const compativeis = myProperties.filter(
              (m) =>
                m.city.toLowerCase() === p.cidade.toLowerCase() &&
                (m.maxGuests == null || m.maxGuests >= p.qtd_ocupantes)
            );
            const temImovelNaCidade = myProperties.some(
              (m) => m.city.toLowerCase() === p.cidade.toLowerCase()
            );
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

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <Meta label="Cidade" value={`${p.cidade}${p.uf ? `/${p.uf}` : ""}`} />
                  <Meta label="A partir de" value={p.data_inicio} />
                  <Meta label="Período" value={`${p.prazo_meses} meses`} />
                  <Meta label="Ocupantes" value={`${p.qtd_ocupantes}`} />
                  <Meta label="Orçamento" value={`${formatBRL(p.orcamento_mensal)}/mês`} />
                  <Meta label="Expira" value={p.expira_em?.slice(0, 10)} />
                </div>

                {p.apresentacao && (
                  <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink">
                    {p.apresentacao}
                  </p>
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
                  ) : compativeis.length === 0 ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Seus imóveis em {p.cidade} não comportam {p.qtd_ocupantes} pessoas.
                    </p>
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
                      <Home className="h-4 w-4" /> Responder com meu imóvel
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
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
