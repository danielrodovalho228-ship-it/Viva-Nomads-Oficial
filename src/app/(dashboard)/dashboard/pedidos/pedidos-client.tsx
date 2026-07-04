"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Megaphone, Plus, Check, X, Pause, Play, MessageSquare, Home } from "lucide-react";
import { PageTitle, Panel, EmptyState } from "@/components/dashboard/primitives";
import { Button } from "@/components/ui/button";
import { formatBRL, cn } from "@/lib/utils";
import {
  motivoLabel,
  PEDIDO_STATUS_LABEL,
  RESPOSTA_STATUS_LABEL,
} from "@/lib/pedidos/pedidos";
import {
  aceitarResposta,
  recusarResposta,
  marcarAtendido,
  pausarPedido,
  setNotifPrefs,
} from "@/lib/data/pedidos-actions";

/* Tipos frouxos (as linhas vêm do Supabase). */
type Pedido = {
  id: string;
  cidade: string;
  uf: string | null;
  data_inicio: string;
  prazo_meses: number;
  orcamento_mensal: number;
  qtd_ocupantes: number;
  motivo: string;
  apresentacao: string | null;
  status: string;
  expira_em: string;
};
type Resposta = {
  id: string;
  pedido_id: string;
  imovel_id: string;
  mensagem: string | null;
  status: string;
  recusa_motivo: string | null;
  properties: { id: string; title: string; city: string; monthly_price: number } | null;
};

const STATUS_TONE: Record<string, string> = {
  ativo: "bg-green-50 text-green-800",
  pausado: "bg-amber-50 text-amber-800",
  atendido: "bg-blue-50 text-blue-700",
  expirado: "bg-surface-2 text-muted",
  removido_admin: "bg-red-50 text-red-700",
};

export function PedidosClient({
  pedidos,
  respostas,
  prefs,
}: {
  pedidos: Pedido[];
  respostas: Resposta[];
  prefs: { email: boolean; whatsapp: boolean };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.ok && res.error) alert(res.error);
    router.refresh();
  }

  const respostasPorPedido = (pedidoId: string) =>
    respostas.filter((r) => r.pedido_id === pedidoId);

  return (
    <div>
      <PageTitle
        title="Meus pedidos de moradia"
        subtitle="Publique o que precisa e receba respostas dos proprietários — tudo pela plataforma."
        action={
          <Link href="/pedidos/novo">
            <Button variant="gold">
              <Plus className="h-4 w-4" /> Novo pedido
            </Button>
          </Link>
        }
      />

      {pedidos.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Megaphone}
            title="Você ainda não tem pedidos"
            text="Publique um pedido de moradia e deixe os proprietários da cidade encontrarem você."
            action={
              <Link href="/pedidos/novo">
                <Button variant="gold">
                  <Plus className="h-4 w-4" /> Publicar pedido
                </Button>
              </Link>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {pedidos.map((p) => {
            const rs = respostasPorPedido(p.id);
            return (
              <Panel key={p.id}>
                {/* Cabeçalho do pedido */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-title text-lg font-bold text-ink">
                        {motivoLabel(p.motivo)}
                      </h3>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          STATUS_TONE[p.status] ?? "bg-surface-2 text-muted"
                        )}
                      >
                        {PEDIDO_STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {p.cidade}
                      {p.uf ? `/${p.uf}` : ""} · a partir de {p.data_inicio} · {p.prazo_meses} meses ·{" "}
                      {p.qtd_ocupantes} {p.qtd_ocupantes === 1 ? "pessoa" : "pessoas"} · até{" "}
                      {formatBRL(p.orcamento_mensal)}/mês
                    </p>
                    {p.apresentacao && (
                      <p className="mt-2 max-w-2xl text-sm text-ink">{p.apresentacao}</p>
                    )}
                    <p className="mt-1 text-xs text-muted">Expira em {p.expira_em?.slice(0, 10)}</p>
                  </div>
                  {/* Ações do pedido */}
                  {(p.status === "ativo" || p.status === "pausado") && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          run(`pause-${p.id}`, () => pausarPedido(p.id, p.status === "ativo"))
                        }
                        disabled={busy === `pause-${p.id}`}
                      >
                        {p.status === "ativo" ? (
                          <>
                            <Pause className="h-4 w-4" /> Pausar
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" /> Reativar
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => run(`done-${p.id}`, () => marcarAtendido(p.id))}
                        disabled={busy === `done-${p.id}`}
                      >
                        <Check className="h-4 w-4" /> Marcar atendido
                      </Button>
                    </div>
                  )}
                </div>

                {/* Respostas recebidas */}
                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-2 text-sm font-medium text-ink">
                    Respostas ({rs.length})
                  </p>
                  {rs.length === 0 ? (
                    <p className="text-sm text-muted">
                      Nenhuma resposta ainda. Proprietários com imóvel em {p.cidade} verão seu pedido.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {rs.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-xl border border-line p-4 text-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <Home className="h-4 w-4 text-sage" />
                                <span className="font-medium text-ink">
                                  {r.properties?.title ?? "Imóvel"}
                                </span>
                                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
                                  {RESPOSTA_STATUS_LABEL[r.status] ?? r.status}
                                </span>
                              </div>
                              <p className="mt-1 text-muted">
                                {r.properties?.city}
                                {r.properties ? ` · ${formatBRL(r.properties.monthly_price)}/mês` : ""}
                              </p>
                              {r.mensagem && <p className="mt-2 text-ink">{r.mensagem}</p>}
                            </div>
                            {r.properties && (
                              <Link
                                href={`/imoveis/${r.properties.id}`}
                                className="text-sm font-medium text-forest underline"
                              >
                                Ver imóvel
                              </Link>
                            )}
                          </div>

                          {/* Ações da resposta */}
                          {r.status !== "aceita_para_conversa" && r.status !== "recusada" && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                onClick={() =>
                                  run(`ok-${r.id}`, () => aceitarResposta(r.id))
                                }
                                disabled={busy === `ok-${r.id}`}
                              >
                                <MessageSquare className="h-4 w-4" /> Aceitar para conversa
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  run(`no-${r.id}`, () => recusarResposta(r.id))
                                }
                                disabled={busy === `no-${r.id}`}
                              >
                                <X className="h-4 w-4" /> Recusar
                              </Button>
                            </div>
                          )}
                          {r.status === "aceita_para_conversa" && (
                            <p className="mt-3 flex items-center gap-2 rounded-lg bg-sage-100 px-3 py-2 text-xs text-forest">
                              <MessageSquare className="h-4 w-4" /> Conversa aberta —{" "}
                              <Link href="/dashboard/mensagens" className="font-medium underline">
                                ir para mensagens
                              </Link>
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* Preferências de notificação (o aviso in-app não desliga). */}
      <NotifPrefs inicial={prefs} />
    </div>
  );
}

function NotifPrefs({ inicial }: { inicial: { email: boolean; whatsapp: boolean } }) {
  const [email, setEmail] = useState(inicial.email);
  const [whatsapp, setWhatsapp] = useState(inicial.whatsapp);
  const [salvo, setSalvo] = useState(false);

  async function salvar(next: { email: boolean; whatsapp: boolean }) {
    setEmail(next.email);
    setWhatsapp(next.whatsapp);
    setSalvo(false);
    const res = await setNotifPrefs(next);
    if (res.ok) {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-white p-5 text-sm">
      <p className="font-medium text-ink">Notificações</p>
      <p className="mt-1 text-xs text-muted">
        Avisos no site sempre aparecem. Você pode desligar e-mail e WhatsApp.
      </p>
      <div className="mt-3 space-y-2">
        <Toggle label="Avisar por e-mail" on={email} onChange={(v) => salvar({ email: v, whatsapp })} />
        <Toggle
          label="Avisar por WhatsApp"
          on={whatsapp}
          onChange={(v) => salvar({ email, whatsapp: v })}
        />
      </div>
      {salvo && <p className="mt-2 text-xs text-forest">Preferências salvas.</p>}
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          on ? "bg-forest" : "bg-line"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
            on ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </label>
  );
}
