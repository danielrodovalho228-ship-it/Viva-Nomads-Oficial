"use client";

import { useEffect, useState, useTransition } from "react";
import { meusPapeis } from "@/lib/data/papeis-actions";
import { minhaChavePix, removerChavePix, salvarChavePix, type MinhaChavePix } from "@/lib/data/recebimento-actions";
import { TIPOS_CHAVE_PIX, type TipoChavePix } from "@/lib/conta/chave-pix";
import { Button } from "@/components/ui/button";

const campo = "w-full min-h-[44px] rounded-lg border border-line bg-white px-3 text-sm text-ink";

/**
 * Configurações → Pagamentos (Prompt 43, item 3; mockup perfil-07-pagamentos). Para quem anuncia: "Como você recebe"
 * — a chave Pix em que o morador paga o valor mensal direto ao proprietário (PERFIL-B, 0236; só o dono lê e grava).
 * Para quem mora: como paga. A Viva não recebe o valor mensal.
 */
export function PagamentosConta() {
  const [dono, setDono] = useState(false);
  const [pix, setPix] = useState<MinhaChavePix | null>(null);
  const [editando, setEditando] = useState(false);
  const [tipo, setTipo] = useState<TipoChavePix>("cpf");
  const [chave, setChave] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pendente, comecar] = useTransition();

  useEffect(() => {
    let vivo = true;
    meusPapeis()
      .then((p) => vivo && setDono(!!p?.find((x) => x.papel === "proprietario")?.ativo))
      .catch(() => {});
    minhaChavePix()
      .then((c) => vivo && setPix(c))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const salvar = () =>
    comecar(async () => {
      setErro(null);
      const r = await salvarChavePix(tipo, chave);
      if (!r.ok) return setErro(r.error ?? "Não foi possível salvar.");
      setPix(await minhaChavePix());
      setEditando(false);
      setChave("");
    });
  const remover = () =>
    comecar(async () => {
      setErro(null);
      const r = await removerChavePix();
      if (!r.ok) return setErro(r.error ?? "Não foi possível remover.");
      setPix(null);
    });
  const copiar = async () => {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.chave);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <section className="rounded-xl border border-line bg-white p-4 sm:p-6" data-testid="conta-pagamentos">
      <h2 className="font-title text-lg font-semibold text-ink">{dono ? "Como o morador paga você" : "Como você paga"}</h2>
      {dono ? (
        <>
          <p className="mt-2 text-sm text-ink">
            O morador paga o valor mensal direto para a sua conta, nos dados que você informa no contrato. A Viva não recebe esse valor.
          </p>
          <div className="mt-4 grid gap-3" data-testid="conta-pix">
            <h3 className="text-sm font-semibold text-ink">Sua chave Pix para receber</h3>
            {pix && !editando ? (
              <div className="grid gap-2">
                <p className="text-sm text-ink" data-testid="conta-pix-salva">
                  {pix.rotuloTipo}: <span className="font-semibold">{pix.mascarada}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={copiar} data-testid="conta-pix-copiar">
                    {copiado ? "Copiada" : "Copiar chave"}
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => { setEditando(true); setTipo(pix.tipo); }} data-testid="conta-pix-trocar">
                    Trocar chave
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={remover} disabled={pendente} data-testid="conta-pix-remover">
                    Remover
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
                <label className="grid gap-1 text-xs text-muted">
                  Tipo da chave
                  <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value as TipoChavePix)} data-testid="conta-pix-tipo">
                    {TIPOS_CHAVE_PIX.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.rotulo}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs text-muted">
                  Chave
                  <input className={campo} value={chave} onChange={(e) => setChave(e.target.value)} autoComplete="off" data-testid="conta-pix-chave" />
                </label>
                <Button type="button" size="sm" onClick={salvar} disabled={pendente || !chave.trim()} data-testid="conta-pix-salvar">
                  Salvar chave
                </Button>
              </div>
            )}
            {erro && (
              <p className="text-sm text-red-700" role="alert" data-testid="conta-pix-erro">
                {erro}
              </p>
            )}
            <p className="text-xs text-muted">Só você vê esta chave. A Viva não recebe nem movimenta o valor mensal.</p>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink">Você paga o valor mensal direto ao proprietário, nos dados que estão no contrato. A Viva não recebe esse valor.</p>
      )}
    </section>
  );
}
