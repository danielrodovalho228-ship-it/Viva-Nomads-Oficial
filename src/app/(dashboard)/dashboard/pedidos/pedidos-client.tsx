"use client";

import { VazioOnboardingBloco } from "@/components/onboarding/vazio-onboarding";
import { VAZIOS_ONBOARDING } from "@/lib/onboarding/vazios";

import { ProblemaComIsto } from "@/components/ajuda/problema-com-isto";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Check, X, Pause, Play, MessageSquare, Home, Pencil, Trash2, RefreshCw } from "lucide-react";
import { PageTitle, Panel } from "@/components/dashboard/primitives";
import { Button, buttonClasses } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn, dataBR } from "@/lib/utils";
import { rotuloPreco, textoPreco } from "@/lib/cartao-preco";
import { totalMesDaLinha } from "@/lib/precos";
import { statusHumano } from "@/lib/status-humano";
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
  excluirPedido,
  renovarPedido,
} from "@/lib/data/pedidos-actions";
import {
  DIAS_AVISO_RENOVAR,
  TEXTO_AVISO_RENOVAR,
  dataPedidoBR,
  textoBairros,
  textoFaixaValor,
  textoNecessidades,
  textoPortePet,
  textoQuartos,
} from "@/lib/pedidos/campos";

/* Tipos frouxos (as linhas vêm do Supabase). */
type Pedido = {
  id: string;
  cidade: string;
  uf: string | null;
  data_inicio: string;
  prazo_meses: number;
  orcamento_mensal: number;
  orcamento_min?: number | null;
  qtd_ocupantes: number;
  motivo: string;
  apresentacao: string | null;
  status: string;
  expira_em: string;
  bairros?: string[] | null;
  quartos_min?: number | null;
  necessidades?: string[] | null;
  pets?: boolean | null;
  porte_pet?: string | null;
  criancas?: boolean | null;
};
type Resposta = {
  id: string;
  pedido_id: string;
  imovel_id: string;
  mensagem: string | null;
  status: string;
  recusa_motivo: string | null;
  properties: { id: string; title: string; city: string; monthly_price: number; condo_fee?: number | null; utilities_mode?: string | null; utilities_estimate?: number | null; available_from?: string | null } | null;
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
  prefs: { email: boolean };
}) {
  const router = useRouter();
  const editado = useSearchParams().get("editado") === "1";
  const [busy, setBusy] = useState<string | null>(null);
  // Hora de referência fixada na montagem (o render fica puro).
  const [agora] = useState(() => Date.now());
  // Excluir pede confirmação NA PÁGINA (nunca a janelinha do navegador).
  const [confirmarExcluir, setConfirmarExcluir] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(editado ? "Pedido atualizado. As mudanças já valem para os proprietários." : null);
  // Erro na própria página (adendo ao prompt 28: nada de alert, que o QA automatizado não enxerga).
  const [erro, setErro] = useState<string | null>(null);
  // Pedido excluído some na hora: não depende só do router.refresh() (o lab viu o cartão ficar com o banco já "excluido").
  const [excluidos, setExcluidos] = useState<string[]>([]);
  const visiveis = pedidos.filter((p) => !excluidos.includes(p.id));

  async function run(key: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(key);
    setErro(null);
    const res = await fn();
    setBusy(null);
    if (!res.ok) setErro(res.error ?? "Não foi possível agora. Tente de novo.");
    router.refresh();
    return res.ok;
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

      {aviso && (
        <p role="status" className="mb-4 rounded-lg bg-sage-100 px-3 py-2 text-sm text-forest" data-testid="pedidos-aviso">
          {aviso}
        </p>
      )}
      {erro && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" data-testid="pedidos-erro">
          {erro}
        </p>
      )}

      {visiveis.length === 0 ? (
        <VazioOnboardingBloco vazio={VAZIOS_ONBOARDING.pedidosMorador} />
      ) : (
        <div className="space-y-4">
          {visiveis.map((p) => {
            const rs = respostasPorPedido(p.id);
            const expira = Date.parse(p.expira_em);
            const pertoDeVencer = p.status === "ativo" && expira > agora && expira - agora <= DIAS_AVISO_RENOVAR * 86_400_000;
            const extras = [...textoNecessidades(p.necessidades), p.pets ? textoPortePet(p.porte_pet) : null, p.criancas ? "Com crianças" : null].filter(Boolean);
            return (
              <Panel key={p.id} data-testid="meu-pedido" data-pedido={p.id}>
                {pertoDeVencer && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="pedido-renovar-aviso">
                    <span>
                      <strong>{TEXTO_AVISO_RENOVAR}.</strong> Ele sai do ar em {dataPedidoBR(p.expira_em)}.
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => run(`renew-${p.id}`, () => renovarPedido(p.id))} disabled={busy === `renew-${p.id}`} data-testid="pedido-renovar">
                      <RefreshCw className="h-4 w-4" /> Renovar
                    </Button>
                  </div>
                )}
                {/* Cabeçalho do pedido */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-title text-lg font-semibold text-ink">
                        {motivoLabel(p.motivo)}
                      </h3>
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-xs font-semibold",
                          STATUS_TONE[p.status] ?? "bg-surface-2 text-muted"
                        )}
                      >
                        {PEDIDO_STATUS_LABEL[p.status] ?? statusHumano(p.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted" data-testid="meu-pedido-resumo">
                      {p.cidade}
                      {p.uf ? `/${p.uf}` : ""} · {textoBairros(p.bairros)} · a partir de {dataBR(p.data_inicio)} · {p.prazo_meses} meses ·{" "}
                      {p.qtd_ocupantes} {p.qtd_ocupantes === 1 ? "pessoa" : "pessoas"} · {textoQuartos(p.quartos_min)} ·{" "}
                      {textoFaixaValor(p.orcamento_min, p.orcamento_mensal)}/mês
                    </p>
                    {extras.length > 0 && <p className="mt-1 text-xs text-muted">{extras.join(" · ")}</p>}
                    {p.apresentacao && (
                      <p className="mt-2 max-w-2xl text-sm text-ink">{p.apresentacao}</p>
                    )}
                    <p className="mt-1 text-xs text-muted">
                      {p.status === "expirado" ? "Expirou em" : "Fica no ar até"} {dataPedidoBR(p.expira_em)}
                    </p>
                  </div>
                  {/* Ações do pedido */}
                  {p.status === "expirado" && (
                    // Renovar com um clique: mais 30 dias (nunca antes da entrada) e volta para os proprietários.
                    <Button variant="secondary" size="sm" onClick={() => run(`renew-${p.id}`, () => renovarPedido(p.id))} disabled={busy === `renew-${p.id}`} data-testid="pedido-renovar">
                      <Play className="h-4 w-4" /> Renovar pedido
                    </Button>
                  )}
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
                      <Link href={`/pedidos/novo?editar=${p.id}`} className={buttonClasses({ variant: "ghost" })} data-testid="pedido-editar">
                        <Pencil className="h-4 w-4" /> Editar
                      </Link>
                    </div>
                  )}
                  {p.status !== "removido_admin" && (
                    <Button variant="ghost" onClick={() => setConfirmarExcluir(p.id)} data-testid="pedido-excluir">
                      <Trash2 className="h-4 w-4" /> Excluir
                    </Button>
                  )}
                </div>
                {confirmarExcluir === p.id && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" data-testid="pedido-excluir-confirmacao">
                    <p>
                      <strong>Excluir este pedido?</strong> Ele some para os proprietários na hora e quem já respondeu recebe um aviso. Isso não pode ser
                      desfeito.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button variant="destructive"
                        size="sm"
                        className="bg-red-700 text-white hover:bg-red-800"
                        disabled={busy === `del-${p.id}`}
                        data-testid="pedido-excluir-confirmar"
                        onClick={() => {
                          setConfirmarExcluir(null);
                          void run(`del-${p.id}`, () => excluirPedido(p.id)).then((ok) => {
                            if (!ok) return;
                            setExcluidos((l) => [...l, p.id]);
                            setAviso("Pedido excluído. Ele não aparece mais para os proprietários.");
                          });
                        }}
                      >
                        Excluir pedido
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmarExcluir(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                <ProblemaComIsto tipo="pedido" id={p.id} className="mt-3" />

                {/* Respostas recebidas */}
                <div className="mt-4 border-t border-line pt-4">
                  <p className="mb-2 text-sm font-medium text-ink">
                    Respostas ({rs.length})
                  </p>
                  {rs.length === 0 ? (
                    <p className="text-sm text-muted">
                      {p.status === "expirado"
                        ? "Expirado: os proprietários não veem mais este pedido. Renove para voltar a receber respostas."
                        : p.status === "ativo"
                          ? `Nenhuma resposta ainda. Proprietários com imóvel em ${p.cidade} verão seu pedido.`
                          : "Nenhuma resposta."}
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
                                <span className="rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-muted">
                                  {RESPOSTA_STATUS_LABEL[r.status] ?? statusHumano(r.status)}
                                </span>
                              </div>
                              <p className="mt-1 text-muted">
                                {r.properties?.city}
                                {r.properties ? ` · ${textoPreco(rotuloPreco({ mensal: totalMesDaLinha(r.properties), meses: p.prazo_meses }))}` : ""}
                              </p>
                              {r.properties?.available_from && (
                                <p className="text-xs text-muted" data-testid="resposta-disponivel">
                                  {rotuloPreco({ mensal: 0, disponivelEm: r.properties.available_from }).disponivel}
                                </p>
                              )}
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
                              <Button variant="secondary"
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

function NotifPrefs({ inicial }: { inicial: { email: boolean } }) {
  const [email, setEmail] = useState(inicial.email);
  const [salvo, setSalvo] = useState(false);

  async function salvar(v: boolean) {
    setEmail(v);
    setSalvo(false);
    const res = await setNotifPrefs({ email: v });
    if (res.ok) {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-line bg-white p-4 text-sm">
      <p className="font-medium text-ink">Notificações</p>
      <p className="mt-1 text-xs text-muted">Avisos no app sempre aparecem. Você pode desligar o e-mail.</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-ink">Avisar por e-mail</span>
        <Switch checked={email} onChange={(v) => salvar(v)} label="Avisar por e-mail" />
      </div>
      {salvo && <p className="mt-2 text-xs text-forest">Preferências salvas.</p>}
    </div>
  );
}
