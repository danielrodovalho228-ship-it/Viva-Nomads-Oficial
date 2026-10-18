"use client";

import { useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { avisarFotografoNaCidade } from "@/lib/fotografos/aviso-actions";
import { CONVITE_AVISO } from "@/lib/fotografos/aviso";

/**
 * Busca sem fotógrafo na cidade (QA do Muse, 18/10): sempre há uma saída — "avise-me quando houver" (gravado por
 * cidade, contato do perfil) e seguir com as próprias fotos. Sem login: entrar e voltar para a mesma busca.
 */
export function AvisoFotografo({ cidade, uf, logado, voltarPara }: { cidade: string; uf: string; logado: boolean; voltarPara: string }) {
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function avisar() {
    setEnviando(true);
    const r: { ok: boolean; erro?: string; mensagem?: string } = await avisarFotografoNaCidade({ cidade, uf }).catch(() => ({ ok: false, erro: "Sem conexão. Tente de novo." }));
    setEnviando(false);
    setMsg({ ok: r.ok, texto: (r.ok ? r.mensagem : r.erro) ?? "" });
  }

  return (
    <div className="mt-4 rounded-xl border border-sage-200 bg-sage-50 p-4" data-testid="aviso-fotografo">
      <p className="flex items-center gap-2 font-semibold text-ink">
        <BellRing className="size-5 shrink-0 text-forest" aria-hidden /> {CONVITE_AVISO}
      </p>
      {msg?.ok ? (
        <p className="mt-2 text-sm text-forest" role="status" data-testid="aviso-fotografo-ok">
          {msg.texto}
        </p>
      ) : logado ? (
        <button type="button" onClick={() => void avisar()} disabled={enviando || !uf} className={buttonClasses({ className: "mt-3 w-full sm:w-auto disabled:opacity-60" })} data-testid="aviso-fotografo-enviar">
          {enviando && <Loader2 className="size-4 animate-spin" aria-hidden />} Quero ser avisado
        </button>
      ) : (
        <div className="mt-3">
          <ButtonLink href={`/auth?redirect=${encodeURIComponent(voltarPara)}`} className="w-full sm:w-auto" data-testid="aviso-fotografo-entrar">
            Entrar para ser avisado
          </ButtonLink>
        </div>
      )}
      {!uf && !msg && <p className="mt-2 text-xs text-ink/70">Busque pelo CEP do imóvel para sabermos a cidade e o estado.</p>}
      {msg && !msg.ok && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {msg.texto}
        </p>
      )}
      <p className="mt-3 text-xs text-ink/70">Enquanto isso, você pode publicar com as suas próprias fotos: o anúncio sai normalmente.</p>
    </div>
  );
}
