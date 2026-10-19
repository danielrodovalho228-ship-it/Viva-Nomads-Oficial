"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { assinarContrato, pedirCodigoAssinatura } from "@/lib/data/contrato-assinar-actions";
import { EVENTO_AVISO_ASSINATURA } from "./aviso-assinatura";

/** “Li e concordo” + código de 6 dígitos enviado ao e-mail da conta (conferido no servidor) → assina. */
export function AssinarContrato({ contratoId }: { contratoId: string }) {
  const router = useRouter();
  const [aceite, setAceiteEstado] = useState(false);
  // "Li e concordo" sobrevive a recarregar a página (jornada de assinatura, 19/10): guardado por contrato no
  // sessionStorage e limpo depois de assinar. O servidor continua exigindo o aceite no envio.
  const chave = `vn-li-concordo:${contratoId}`;
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura a marcação depois da hidratação
      if (window.sessionStorage.getItem(chave) === "1") setAceiteEstado(true);
    } catch {
      /* sem armazenamento (aba privada): segue desmarcado */
    }
  }, [chave]);
  const setAceite = (v: boolean) => {
    setAceiteEstado(v);
    try {
      if (v) window.sessionStorage.setItem(chave, "1");
      else window.sessionStorage.removeItem(chave);
    } catch {
      /* sem armazenamento */
    }
  };
  const [codigo, setCodigo] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [pedindo, setPedindo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [assinado, setAssinado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function pedir() {
    setErro(null);
    setPedindo(true);
    try {
      const r = await pedirCodigoAssinatura(contratoId);
      if (!r.ok) {
        setErro(r.error ?? "Não foi possível enviar o código.");
        return;
      }
      setEnviado(true);
    } finally {
      setPedindo(false);
    }
  }

  async function assinar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await assinarContrato({ contratoId, aceite, codigo });
      if (!r.ok) {
        setErro(r.error ?? "Não foi possível assinar.");
        return;
      }
      setAssinado(true);
      if (r.aviso) window.dispatchEvent(new CustomEvent(EVENTO_AVISO_ASSINATURA, { detail: { contratoId, aviso: r.aviso } }));
      try {
        window.sessionStorage.removeItem(chave);
      } catch {
        /* sem armazenamento */
      }
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  if (assinado) return null;

  return (
    <form onSubmit={assinar} className="mt-5 space-y-3 border-t border-line pt-4" data-testid="form-assinar">
      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={aceite}
          onChange={(e) => setAceite(e.target.checked)}
          className="mt-0.5 h-4 w-4"
          data-testid="assinar-aceite"
        />
        Li e concordo com o contrato acima.
      </label>
      <div>
        <p className="text-sm font-medium text-ink">Confirme que é você</p>
        <Button type="button" variant="outline" onClick={pedir} disabled={pedindo} className="mt-1" data-testid="assinar-pedir-codigo">
          {pedindo ? <Loader2 className="h-4 w-4 animate-spin" /> : enviado ? "Enviar outro código" : "Enviar código por e-mail"}
        </Button>
        {enviado && <p className="mt-1 text-xs text-muted">Enviamos 6 números para o e-mail da sua conta. Valem por 15 minutos.</p>}
        <label htmlFor="assinar-codigo" className="mt-3 block text-sm font-medium text-ink">
          Código recebido por e-mail
        </label>
        <input
          id="assinar-codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          className="mt-1 w-full max-w-[12rem] rounded-xl border border-line bg-white px-3 py-2.5 text-base tracking-widest"
          data-testid="assinar-codigo"
        />
      </div>
      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}
      <Button type="submit" variant="gold" disabled={!aceite || codigo.length !== 6 || enviando} data-testid="assinar-enviar">
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assinar contrato"}
      </Button>
    </form>
  );
}
