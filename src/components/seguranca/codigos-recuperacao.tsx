"use client";

import { useState } from "react";
import { Check, Copy, Download, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { avisarPoucosCodigos } from "@/lib/seguranca/codigos-recuperacao";
import { gerarCodigosRecuperacao } from "@/lib/seguranca/recuperacao-actions";

/** Lista dos códigos recém-gerados: aparece UMA vez, com Copiar e Baixar. */
export function CodigosGerados({ codigos, onFechar }: { codigos: string[]; onFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Viva Nomads — códigos de recuperação da verificação em duas etapas\nCada código vale uma vez.\n\n${codigos.join("\n")}\n`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sem permissão da área de transferência: a pessoa pode selecionar a lista */
    }
  }
  function baixar() {
    const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "viva-nomads-codigos-recuperacao.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div role="region" aria-label="Códigos de recuperação" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-900">Guarde estes 10 códigos num lugar seguro. Eles aparecem só agora; cada um vale uma vez.</p>
      <ul data-testid="codigos-recuperacao" className="grid grid-cols-2 gap-2 font-mono text-sm text-ink">
        {codigos.map((c) => (
          <li key={c} className="rounded bg-white px-2 py-1 text-center tracking-wider">{c}</li>
        ))}
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" className="min-h-11" onClick={copiar}>
          {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copiado ? "Copiado!" : "Copiar códigos"}
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={baixar}>
          <Download className="h-4 w-4" /> Baixar .txt
        </Button>
        <Button type="button" variant="ghost" className="min-h-11" onClick={onFechar}>Já guardei</Button>
      </div>
    </div>
  );
}

/** Conta → Segurança (fator ativo): quantos restam, aviso com 2 ou menos e "Gerar novos códigos". */
export function CodigosRecuperacaoBloco({ restantes, onNovos }: { restantes: number | null; onNovos: (codigos: string[]) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setErro(null);
    setOcupado(true);
    const r = await gerarCodigosRecuperacao();
    setOcupado(false);
    if (!r.ok) return setErro(r.error);
    onNovos(r.codigos);
  }

  return (
    <div className="space-y-2 border-t border-sage-200 pt-3">
      <p className="flex items-center gap-2 text-sm font-medium text-ink"><KeyRound className="h-4 w-4" /> Códigos de recuperação</p>
      {restantes !== null && (
        <p data-testid="codigos-restantes" className={avisarPoucosCodigos(restantes) ? "text-sm font-medium text-amber-900" : "text-sm text-muted"}>
          {restantes === 0 ? "Você não tem códigos de recuperação válidos." : `Restam ${restantes} ${restantes === 1 ? "código" : "códigos"}.`}
          {avisarPoucosCodigos(restantes) && " Gere novos antes de ficar sem."}
        </p>
      )}
      <Button type="button" variant="outline" className="min-h-11" onClick={gerar} disabled={ocupado}>
        {ocupado && <Loader2 className="h-4 w-4 animate-spin" />} Gerar novos códigos
      </Button>
      <p className="text-xs text-muted">Gerar novos códigos invalida os antigos.</p>
      {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
