"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getCanais, setCanais } from "@/lib/data/canais-actions";
import { getCategoriasDesligadas, setCategoriasDesligadas } from "@/lib/data/notif-categorias-actions";
import { getAlertasEquipe, setAlertasEquipe } from "@/lib/data/pedidos-actions";
import type { CategoriaComInterruptor } from "@/config/matriz-notificacoes";
import { CANAIS_AVISO, TIPOS_AVISO, categoriasDesligadasDe, type CanaisAviso } from "@/lib/conta/tela-notificacoes";

type Tipos = Record<CategoriaComInterruptor, boolean>;

/**
 * A6 — Conta › Notificações (mockup perfil-06): o cartão dos tipos de aviso (Novas mensagens, Lembretes da estadia,
 * Novidades e dicas) e o cartão "Canais" (E-mail, push, WhatsApp) com "Salvar preferências". Decisões e segurança
 * sempre chegam (sem interruptor). Gravar a preferência não liga envio: WhatsApp e push seguem atrás das chaves.
 */
export function TelaNotificacoes() {
  const [tipos, setTipos] = useState<Tipos | null>(null);
  const [canais, setCanaisUi] = useState<CanaisAviso | null>(null);
  const [equipe, setEquipe] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([getCategoriasDesligadas().catch((): CategoriaComInterruptor[] => []), getCanais().catch(() => null), getAlertasEquipe().catch(() => null)]).then(([desl, c, eq]) => {
      if (!vivo) return;
      setTipos({ mensagens: !desl.includes("mensagens"), lembretes: !desl.includes("lembretes"), outros: !desl.includes("outros") });
      setCanaisUi(c ?? { email: true, push: true, whatsapp: true });
      setEquipe(eq);
    });
    return () => {
      vivo = false;
    };
  }, []);

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

  if (!tipos || !canais)
    return (
      <div className="grid gap-4" aria-busy="true" data-testid="tela-notificacoes-carregando">
        <span className="block h-56 rounded-xl bg-white" aria-hidden />
        <span className="block h-56 rounded-xl bg-white" aria-hidden />
      </div>
    );

  return (
    <div className="grid gap-4" data-testid="tela-notificacoes">
      <section className="rounded-xl bg-white px-4 sm:px-6" aria-label="Tipos de aviso">
        <ul className="divide-y divide-line">
          {TIPOS_AVISO.map((t) => (
            <Linha key={t.categoria} titulo={t.titulo} texto={t.texto}>
              <Switch checked={tipos[t.categoria]} onChange={(v) => setTipos({ ...tipos, [t.categoria]: v })} label={t.titulo} testId={`notif-tipo-${t.categoria}`} />
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
              <Switch checked={canais[c.canal]} onChange={(v) => setCanaisUi({ ...canais, [c.canal]: v })} label={c.titulo} testId={`notif-canal-${c.canal}`} />
            </Linha>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          {msg && (
            <p role="status" className={msg.ok ? "text-sm text-forest" : "text-sm text-red-700"} data-testid="notif-salvar-msg">
              {msg.texto}
            </p>
          )}
          <Button type="button" size="lg" onClick={salvar} disabled={salvando} data-testid="notif-salvar">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Salvar preferências
          </Button>
        </div>
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
