"use client";
import { MSG_FALHA_ENVIO_FOTO, enviarFotoDoAnuncio } from "@/lib/fotos/enviar-foto-cliente";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ehChaveNivel, rotuloItem } from "@/config/niveis";
import { CONFIRMACAO_PENDENCIA_H, type PapelPendencia } from "@/lib/conforto/regras";
import { agirNaPendencia } from "@/lib/data/conforto-actions";
import type { PendenciaParaTela } from "@/lib/conforto/servidor";
import { dataHoraBRT } from "@/lib/datas-brasilia";
import { statusHumano } from "@/lib/status-humano";

const ROTULO_STATUS: Record<string, string> = {
  aberta: "Aberta",
  corrigida: "Corrigida",
  contestada: "Contestada: o atendimento da Viva decide",
  procedente: "Procedente (decisão do atendimento)",
  improcedente: "Improcedente (decisão do atendimento)",
};

const fmt = (iso: string) => dataHoraBRT(iso);

/**
 * Prompt 59 — pendências do padrão mínimo no contrato. Dono: "Corrigido" ou "Contestar". Morador: confirmar ou reabrir em
 * 48 h. A contestação é decidida pelo atendimento da Viva (em /admin/conforto), nunca pelo dono.
 */
export function PendenciasConforto({ papel, pendencias }: { papel: PapelPendencia; pendencias: PendenciaParaTela[] }) {
  if (pendencias.length === 0) return null;
  return (
    <ul className="mt-3 space-y-3" data-testid="pendencias-conforto-lista">
      {pendencias.map((p) => (
        <Linha key={p.id} papel={papel} p={p} />
      ))}
    </ul>
  );
}

/** O que a ação muda na linha, para aparecer na hora (o servidor confirma ao reler a página). */
const EFEITO: Record<"corrigir" | "contestar" | "confirmar" | "reabrir", (agora: string) => Partial<PendenciaParaTela>> = {
  corrigir: (agora) => ({ status: "corrigida", corrigida_em: agora, fechada: false }),
  contestar: () => ({ status: "contestada", fechada: false }),
  confirmar: () => ({ status: "corrigida", fechada: true }),
  reabrir: () => ({ status: "aberta", fechada: false }),
};

function Linha({ papel, p: doServidor }: { papel: PapelPendencia; p: PendenciaParaTela }) {
  // Vale só enquanto o servidor ainda mostra o estado de antes da ação; depois, vale o que ele traz.
  const [local, setLocal] = useState<{ de: string; campos: Partial<PendenciaParaTela> } | null>(null);
  const estadoServidor = `${doServidor.status}|${doServidor.fechada ? 1 : 0}`;
  const p: PendenciaParaTela = local && local.de === estadoServidor ? { ...doServidor, ...local.campos } : doServidor;
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [contestando, setContestando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const rotulo = rotuloItem(p.chave);
  // Adendo 59.1: item que define o nível se corrige com foto nova do item (vale como a foto do nível).
  const itemDeNivel = ehChaveNivel(p.chave);
  const agir = (acao: "corrigir" | "contestar" | "confirmar" | "reabrir", arquivo?: File) =>
    iniciar(async () => {
      // E47-A-CORRECAO: nada aqui lança (rede caindo vira mensagem na linha, nunca tela branca).
      try {
        let foto: string | undefined;
        if (arquivo) {
          const up = await enviarFotoDoAnuncio(arquivo);
          if (!up.ok) return setMsg({ ok: false, t: up.erro });
          foto = up.path;
        }
        const r = await agirNaPendencia(p.id, acao, acao === "contestar" ? { motivo } : foto ? { foto } : {});
        setMsg(r.ok ? { ok: true, t: r.mensagem ?? "Feito." } : { ok: false, t: r.erro });
        if (r.ok) {
          setLocal({ de: estadoServidor, campos: { ...EFEITO[acao](new Date().toISOString()), ...(acao === "contestar" ? { motivo_contestacao: motivo.trim() } : {}) } });
          setContestando(false);
          router.refresh();
        }
      } catch {
        setMsg({ ok: false, t: MSG_FALHA_ENVIO_FOTO });
      }
    });
  const aguardaMorador = p.status === "corrigida" && !p.fechada;
  const ateMorador = p.corrigida_em ? new Date(new Date(p.corrigida_em).getTime() + CONFIRMACAO_PENDENCIA_H * 3_600_000).toISOString() : null;
  return (
    <li className="rounded-lg border border-line p-3 text-sm" data-testid="pendencia-conforto" data-chave={p.chave} data-status={p.status} data-fechada={p.fechada ? "1" : "0"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-semibold text-ink">{rotulo}</p>
        <span className="text-xs text-muted" data-testid="pendencia-conforto-status">
          {p.status === "corrigida" && p.fechada ? "Corrigida e confirmada" : ROTULO_STATUS[p.status] ?? statusHumano(p.status)}
        </span>
      </div>
      {p.texto_morador && <p className="mt-1 break-words text-muted">Morador: {p.texto_morador}</p>}
      {p.status === "aberta" && (
        <p className={p.vencida ? "mt-1 text-xs text-red-700" : "mt-1 text-xs text-muted"} data-testid="pendencia-conforto-prazo">
          {p.vencida ? "Prazo de correção vencido em " : "Corrigir até "}
          {fmt(p.prazo_ate)}
        </p>
      )}
      {aguardaMorador && ateMorador && (
        <p className="mt-1 text-xs text-muted">O morador confirma ou reabre até {fmt(ateMorador)}; sem resposta, conta como corrigido.</p>
      )}
      {p.motivo_contestacao && <p className="mt-1 break-words text-xs text-muted">Contestação: {p.motivo_contestacao}</p>}

      {papel === "proprietario" && p.status === "aberta" && (
        <div className="mt-2 space-y-2">
          {contestando ? (
            <>
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} rows={2} placeholder="Por que o item estava conforme" aria-label="Motivo da contestação" className="w-full rounded-lg border border-line p-3 text-sm" data-testid="pendencia-motivo" />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={pendente || motivo.trim().length < 5} onClick={() => agir("contestar")} data-testid="pendencia-enviar-contestacao">
                  Enviar contestação
                </Button>
                <Button size="sm" variant="outline" onClick={() => setContestando(false)}>
                  Voltar
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              {itemDeNivel ? (
                <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-forest px-3 text-sm font-semibold text-forest">
                  Enviar foto do item corrigido
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={pendente}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) agir("corrigir", f);
                      e.target.value = "";
                    }}
                    data-testid="pendencia-foto-corrigido"
                  />
                </label>
              ) : (
                <Button size="sm" disabled={pendente} onClick={() => agir("corrigir")} data-testid="pendencia-corrigido">
                  Marcar como corrigido
                </Button>
              )}
              <Button size="sm" variant="outline" disabled={pendente} onClick={() => setContestando(true)} data-testid="pendencia-contestar">
                Contestar
              </Button>
            </div>
          )}
        </div>
      )}
      {papel === "inquilino" && aguardaMorador && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" disabled={pendente} onClick={() => agir("confirmar")} data-testid="pendencia-confirmar">
            Confirmar correção
          </Button>
          <Button size="sm" variant="outline" disabled={pendente} onClick={() => agir("reabrir")} data-testid="pendencia-reabrir">
            Ainda não está certo
          </Button>
        </div>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "mt-2 text-xs text-ink" : "mt-2 text-xs text-red-700"} data-testid="pendencia-resultado">
          {msg.t}
        </p>
      )}
    </li>
  );
}
