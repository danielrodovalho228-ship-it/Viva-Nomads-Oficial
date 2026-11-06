"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { salvarContaRecebimento } from "@/lib/data/ficha-resumo-actions";
import { textoAutorizacaoTerceiro } from "@/lib/contrato-ficha-resumo";

/** E634: o proprietário informa o vencimento e a conta de recebimento. Conta de terceiro pede a autorização expressa. Só o FINAL do documento e da conta fica guardado. */
export function FormContaRecebimento({ contratoId, diaInicial }: { contratoId: string; diaInicial: number | null }) {
  const router = useRouter();
  const [dia, setDia] = useState(diaInicial ? String(diaInicial) : "");
  const [titularNome, setTitularNome] = useState("");
  const [titularDocumento, setTitularDocumento] = useState("");
  const [instituicao, setInstituicao] = useState("");
  const [referencia, setReferencia] = useState("");
  const [proprio, setProprio] = useState(true);
  const [autorizo, setAutorizo] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    iniciar(async () => {
      const r = await salvarContaRecebimento(contratoId, Number(dia), { titularNome, titularDocumento, instituicao, referencia, titularProprio: proprio, autorizo }).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
      if (r.ok) {
        setMsg({ tipo: "ok", texto: "Salvo." });
        router.refresh();
      } else setMsg({ tipo: "erro", texto: r.erro });
    });
  }
  const campo = "mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-base text-ink";
  return (
    <form onSubmit={salvar} className="grid gap-3 sm:grid-cols-2" data-testid="form-conta-recebimento">
      <label className="text-sm font-semibold text-ink">
        Dia de vencimento do aluguel (1 a 28)
        <input type="number" min={1} max={28} required value={dia} onChange={(e) => setDia(e.target.value)} className={campo} />
      </label>
      <label className="text-sm font-semibold text-ink">
        Nome do titular da conta
        <input required value={titularNome} onChange={(e) => setTitularNome(e.target.value)} className={campo} autoComplete="off" />
      </label>
      <label className="text-sm font-semibold text-ink">
        CPF ou CNPJ do titular
        <input required inputMode="numeric" value={titularDocumento} onChange={(e) => setTitularDocumento(e.target.value)} className={campo} autoComplete="off" />
      </label>
      <label className="text-sm font-semibold text-ink">
        Banco ou instituição
        <input required value={instituicao} onChange={(e) => setInstituicao(e.target.value)} className={campo} autoComplete="off" />
      </label>
      <label className="text-sm font-semibold text-ink sm:col-span-2">
        Conta ou chave Pix
        <input required value={referencia} onChange={(e) => setReferencia(e.target.value)} className={campo} autoComplete="off" />
      </label>
      <p className="text-xs text-muted sm:col-span-2">Guardamos só o final do documento e da conta/Pix. O restante não fica salvo.</p>
      <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
        <input type="checkbox" checked={!proprio} onChange={(e) => { setProprio(!e.target.checked); if (e.target.checked) setAutorizo(false); }} /> A conta é de outra pessoa (terceiro)
      </label>
      {!proprio && (
        <label className="flex items-start gap-2 rounded-xl border border-line p-3 text-sm text-ink sm:col-span-2" data-testid="autorizacao-terceiro">
          <input type="checkbox" className="mt-1" checked={autorizo} onChange={(e) => setAutorizo(e.target.checked)} />
          <span>{textoAutorizacaoTerceiro(titularNome || "o titular informado")}</span>
        </label>
      )}
      {msg && (
        <p role={msg.tipo === "erro" ? "alert" : "status"} className={msg.tipo === "erro" ? "text-sm text-red-700 sm:col-span-2" : "text-sm text-forest sm:col-span-2"}>
          {msg.texto}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
