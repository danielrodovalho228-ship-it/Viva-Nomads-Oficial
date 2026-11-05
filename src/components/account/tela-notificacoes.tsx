"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { InterruptorSomMensagem } from "@/components/painel/som-mensagem";
import { getCanais, setCanais } from "@/lib/data/canais-actions";
import { getCategoriasDesligadas, setCategoriasDesligadas } from "@/lib/data/notif-categorias-actions";
import { getAlertasEquipe, setAlertasEquipe } from "@/lib/data/pedidos-actions";
import type { CategoriaComInterruptor } from "@/config/matriz-notificacoes";
import { CANAIS_AVISO, TIPOS_AVISO, categoriasDesligadasDe, tiposDeDesligadas, type CanaisAviso, type PreferenciasIniciais } from "@/lib/conta/tela-notificacoes";

type Tipos = Record<CategoriaComInterruptor, boolean>;

/**
 * A6 — Conta › Notificações (mockup perfil-06): o cartão dos tipos de aviso (Novas mensagens, Lembretes da estadia,
 * Novidades e dicas, Sugestões e novidades) e o cartão "Canais" (E-mail, push, WhatsApp) com "Salvar preferências". Decisões e segurança
 * sempre chegam (sem interruptor). Gravar a preferência não liga envio: WhatsApp e push seguem atrás das chaves.
 */
export function TelaNotificacoes({ inicial = null }: { inicial?: PreferenciasIniciais | null }) {
  // E549: a página lê as preferências no servidor — os interruptores já nascem ligados/desligados. Antes, os 7 ficavam
  // no trilho de carregamento (oval vazio) enquanto as três leituras do navegador não voltavam.
  const [tipos, setTipos] = useState<Tipos | null>(inicial ? tiposDeDesligadas(inicial.desligadas) : null);
  const [canais, setCanaisUi] = useState<CanaisAviso | null>(inicial?.canais ?? null);
  const [equipe, setEquipe] = useState<boolean | null>(inicial?.equipe ?? null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  // Achados 52/53: sem ler as preferências gravadas, a tela não abre com valores padrão (todos ligados) — salvar isso
  // religaria o que a pessoa desligou, inclusive "Sugestões e novidades". Mostra o aviso com "Tentar de novo".
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    // Com o estado vindo da página, o navegador só relê em "Tentar de novo".
    if (inicial && tentativa === 0) return;
    let vivo = true;
    Promise.all([getCategoriasDesligadas(), getCanais(), getAlertasEquipe().catch(() => null)])
      .then(([desl, c, eq]) => {
        if (!vivo) return;
        setFalhou(false);
        setTipos(tiposDeDesligadas(desl));
        setCanaisUi(c);
        setEquipe(eq);
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [tentativa, inicial]);

  async function salvar() {
    if (!tipos || !canais) return;
    setSalvando(true);
    setMsg(null);
    const [a, b] = await Promise.all([
      setCategoriasDesligadas(categoriasDesligadasDe(tipos)).catch(() => ({ ok: false })),
      setCanais(canais).catch(() => ({ ok: false })),
    ]);
    setSalvando(false);
    setMsg(a.ok && b.ok ? { ok: true, texto: "Preferências salvas." } : { ok: false, texto: "Não foi possível salvar. Tente de novo." });
  }

  async function alternarEquipe(v: boolean) {
    const antes = equipe;
    setEquipe(v);
    const r = await setAlertasEquipe(v).catch(() => ({ ok: false }));
    if (!r.ok) setEquipe(antes);
  }

  if (falhou && (!tipos || !canais))
    return (
      <p role="alert" className="rounded-xl bg-white p-4 text-sm text-red-700" data-testid="tela-notificacoes-falha">
        Não foi possível carregar suas preferências de aviso agora. Nada foi alterado.{" "}
        <button type="button" className="font-semibold text-forest underline underline-offset-2" onClick={() => setTentativa((n) => n + 1)} data-testid="tela-notificacoes-tentar">
          Tentar de novo
        </button>
      </p>
    );
  // Estabilidade (02/11): carregando, a MESMA tela (títulos e textos são fixos) com um trilho neutro no lugar de cada
  // interruptor — nunca um estado ligado/desligado ainda não lido. Antes, dois blocos de 224 px viravam cartões de
  // ~420 px e empurravam "Avisos recentes" (salto de layout 0,13 no celular).
  const carregando = !tipos || !canais;
  const trilho = <span className="block h-6 w-11 shrink-0 rounded-full bg-surface-2" aria-hidden data-testid="notif-trilho-carregando" />;

  return (
    <div className="grid gap-4" aria-busy={carregando || undefined} data-testid={carregando ? "tela-notificacoes-carregando" : "tela-notificacoes"}>
      <section className="rounded-xl bg-white px-4 sm:px-6" aria-label="Tipos de aviso">
        <ul className="divide-y divide-line">
          {TIPOS_AVISO.map((t) => (
            <Linha key={t.categoria} titulo={t.titulo} texto={t.texto}>
              {tipos ? <Switch checked={tipos[t.categoria]} onChange={(v) => setTipos({ ...tipos, [t.categoria]: v })} label={t.titulo} testId={`notif-tipo-${t.categoria}`} /> : trilho}
            </Linha>
          ))}
        </ul>
      </section>
      <p className="px-1 text-sm text-muted">Decisões que dependem de você e avisos de segurança chegam sempre.</p>

      <section className="rounded-xl bg-white px-4 pb-4 pt-4 sm:px-6 sm:pb-6" aria-labelledby="notif-canais-titulo">
        <h2 id="notif-canais-titulo" className="font-title text-2xl font-semibold text-ink">
          Canais
        </h2>
        <ul className="divide-y divide-line">
          {CANAIS_AVISO.map((c) => (
            <Linha key={c.canal} titulo={c.titulo} texto={c.texto}>
              {canais ? <Switch checked={canais[c.canal]} onChange={(v) => setCanaisUi({ ...canais, [c.canal]: v })} label={c.titulo} testId={`notif-canal-${c.canal}`} /> : trilho}
            </Linha>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          {msg && (
            <p role="status" className={msg.ok ? "text-sm text-forest" : "text-sm text-red-700"} data-testid="notif-salvar-msg">
              {msg.texto}
            </p>
          )}
          <Button type="button" size="lg" onClick={salvar} disabled={salvando || carregando} data-testid="notif-salvar">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Salvar preferências
          </Button>
        </div>
      </section>

      {/* E445 item 6: o som de mensagem nova é deste aparelho (grava na hora, fora do "Salvar preferências"). */}
      <section className="rounded-xl bg-white px-4 sm:px-6" aria-label="Neste aparelho" data-testid="notif-neste-aparelho">
        <ul>
          <Linha titulo="Som de mensagem nova" texto="Um toque discreto quando chega mensagem com o site aberto. Vale para este aparelho.">
            <InterruptorSomMensagem />
          </Linha>
        </ul>
      </section>

      {equipe !== null && (
        <section className="rounded-xl bg-white px-4 sm:px-6" aria-label="Equipe">
          <ul>
            <Linha titulo="Receber alertas da equipe" texto="Documento na fila, chamado novo e parceiro aguardando aprovação.">
              <Switch checked={equipe} onChange={(v) => void alternarEquipe(v)} label="Receber alertas da equipe" testId="notif-equipe" />
            </Linha>
          </ul>
        </section>
      )}
    </div>
  );
}

function Linha({ titulo, texto, children }: { titulo: string; texto: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-4 py-4">
      <span className="min-w-0">
        <span className="block text-lg font-semibold text-ink">{titulo}</span>
        <span className="block text-sm text-ink">{texto}</span>
      </span>
      {children}
    </li>
  );
}
