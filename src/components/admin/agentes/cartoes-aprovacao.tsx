"use client";

import { useCallback, useEffect, useState } from "react";
import { rotuloMescla, type CartaoAprovacao } from "@/lib/agentes/aprovacoes";

const COR_RISCO = { baixo: "text-[#B5EC7A]", medio: "text-[#FFD36B]", alto: "text-[#FFB0A6]" } as const;
const ROTULO_RISCO = { baixo: "Risco baixo", medio: "Risco médio", alto: "Risco alto" } as const;

/**
 * Cartões de aprovação no chat do Moacir (ordem 41ae4fc5). Aprovar pede um segundo toque (Confirmar);
 * quem decide é o servidor (/api/admin/aprovacoes/[id]), nunca este componente.
 */
export function CartoesAprovacao({ versao }: { versao: number }) {
  const [cartoes, setCartoes] = useState<CartaoAprovacao[]>([]);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/aprovacoes", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json().catch(() => ({}))) as { cartoes?: CartaoAprovacao[] };
      setCartoes(Array.isArray(j.cartoes) ? j.cartoes : []);
    } catch {
      /* sem rede: mantém o que já está na tela */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void carregar(), 0);
    return () => clearTimeout(t);
  }, [carregar, versao]);

  async function decidir(c: CartaoAprovacao, acao: "aprovar" | "recusar") {
    setOcupado(c.id);
    setErro(null);
    setAviso(null);
    try {
      const r = await fetch(`/api/admin/aprovacoes/${c.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao, confirmar: acao === "aprovar" }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; erro?: string; mescla?: string };
      if (!r.ok || !j.ok) {
        setErro(j.erro ?? "Não consegui registrar agora.");
        return;
      }
      setAviso(acao === "recusar" ? `${c.referencia} recusado.` : `${c.referencia}: ${rotuloMescla(c.tipo === "merge_pr" ? j.mescla : undefined)}`);
      setCartoes((l) => l.filter((x) => x.id !== c.id));
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setOcupado(null);
      setConfirmando(null);
    }
  }

  if (!cartoes.length && !aviso && !erro) return null;
  return (
    <section aria-label="Pedidos esperando seu OK" className="space-y-2" data-testid="cartoes-aprovacao">
      {cartoes.map((c) => (
        <article key={c.id} className="rounded-xl border border-white/15 bg-[#0B1430] p-3 text-sm text-white" data-testid="cartao-aprovacao">
          <p className="font-semibold">{c.referencia}</p>
          <p className="mt-1 text-[#C9D2F0]">{c.resumo}</p>
          <p className={`mt-1 text-xs font-semibold ${COR_RISCO[c.risco] ?? COR_RISCO.medio}`}>{ROTULO_RISCO[c.risco] ?? ROTULO_RISCO.medio}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {confirmando === c.id ? (
              <>
                <button type="button" disabled={ocupado === c.id} onClick={() => void decidir(c, "aprovar")} className="min-h-11 flex-1 rounded-lg bg-[#7FD321] px-3 font-semibold text-[#0B1430] disabled:opacity-60">
                  Confirmar aprovação do {c.referencia}
                </button>
                <button type="button" onClick={() => setConfirmando(null)} className="min-h-11 rounded-lg border border-white/20 px-3">
                  Voltar
                </button>
              </>
            ) : (
              <>
                <button type="button" disabled={ocupado === c.id} onClick={() => setConfirmando(c.id)} className="min-h-11 flex-1 rounded-lg bg-[#7FD321] px-3 font-semibold text-[#0B1430] disabled:opacity-60">
                  Aprovar
                </button>
                <button type="button" disabled={ocupado === c.id} onClick={() => void decidir(c, "recusar")} className="min-h-11 flex-1 rounded-lg border border-white/20 px-3 font-semibold disabled:opacity-60">
                  Recusar
                </button>
              </>
            )}
          </div>
        </article>
      ))}
      {aviso && <p role="status" className="rounded-lg bg-[#7FD321]/10 px-3 py-2 text-sm text-[#B5EC7A]">{aviso}</p>}
      {erro && <p role="alert" className="rounded-lg bg-[#FF7A6B]/10 px-3 py-2 text-sm text-[#FFB0A6]">{erro}</p>}
    </section>
  );
}
