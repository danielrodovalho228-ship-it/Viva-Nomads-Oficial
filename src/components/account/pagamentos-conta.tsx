"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, CreditCard, Plus } from "lucide-react";
import { meusPapeis } from "@/lib/data/papeis-actions";
import { minhaChavePix, removerChavePix, salvarChavePix, type MinhaChavePix } from "@/lib/data/recebimento-actions";
import { TIPOS_CHAVE_PIX, type TipoChavePix } from "@/lib/conta/chave-pix";
import { NOTA_MORADOR, NOTA_RECEBE, SEM_CARTAO, TITULO_MORADOR, TITULO_RECEBE } from "@/lib/conta/tela-pagamentos";
import { Button } from "@/components/ui/button";

const campo = "w-full min-h-[44px] rounded-lg border border-line bg-white px-3 text-sm text-ink";

/**
 * A7 — Conta › Pagamentos (mockup perfil-07). "Como você recebe (proprietário)": a chave Pix em que o morador paga o
 * valor mensal direto ao proprietário (PERFIL-B, 0236; só o dono lê e grava), no campo com o botão de copiar.
 * "Para suas estadias (morador)": a linha do cartão e "Adicionar cartão" como no desenho, sem cadastro nem cobrança —
 * a Viva não recebe o valor mensal.
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
      setCopiado(false);
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
    <div className="grid gap-4" data-testid="conta-pagamentos">
      {dono && (
        <section className="rounded-xl bg-white p-4 sm:p-6" aria-labelledby="pag-recebe-titulo" data-testid="conta-pix">
          <h2 id="pag-recebe-titulo" className="font-title text-2xl font-semibold text-ink">
            {TITULO_RECEBE}
          </h2>
          {pix && !editando ? (
            <div className="mt-4 grid gap-3">
              <div className="flex min-h-14 items-center gap-3 rounded-lg border border-line px-4">
                <p className="min-w-0 flex-1 truncate text-base text-ink">
                  <span className="text-muted">Chave Pix · </span>
                  <span className="font-semibold" data-testid="conta-pix-salva">
                    {pix.rotuloTipo}: {pix.mascarada}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={copiar}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink hover:text-forest"
                  aria-label={copiado ? "Chave Pix copiada" : "Copiar chave Pix"}
                  data-testid="conta-pix-copiar"
                >
                  {copiado ? <Check className="h-5 w-5 text-forest" aria-hidden /> : <Copy className="h-5 w-5" aria-hidden />}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => { setEditando(true); setTipo(pix.tipo); }} data-testid="conta-pix-trocar">
                  Trocar chave
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={remover} disabled={pendente} data-testid="conta-pix-remover">
                  Remover
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end">
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
                Chave Pix
                <input className={campo} value={chave} onChange={(e) => setChave(e.target.value)} autoComplete="off" data-testid="conta-pix-chave" />
              </label>
              <Button type="button" variant="secondary" size="sm" onClick={salvar} disabled={pendente || !chave.trim()} data-testid="conta-pix-salvar">
                Salvar chave
              </Button>
            </div>
          )}
          {erro && (
            <p className="mt-2 text-sm text-red-700" role="alert" data-testid="conta-pix-erro">
              {erro}
            </p>
          )}
          <p className="mt-3 text-sm text-muted" data-testid="conta-pix-nota">
            {NOTA_RECEBE}
          </p>
        </section>
      )}

      <section className="rounded-xl bg-white p-4 sm:p-6" aria-labelledby="pag-morador-titulo" data-testid="conta-pag-morador">
        <h2 id="pag-morador-titulo" className="font-title text-2xl font-semibold text-ink">
          {TITULO_MORADOR}
        </h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-sage-100 text-forest" aria-hidden>
              <CreditCard className="h-6 w-6" />
            </span>
            <span className="text-base text-ink" data-testid="conta-cartao">
              {SEM_CARTAO}
            </span>
          </div>
          {/* Como no desenho, mas sem cadastro nem cobrança de cartão: nenhuma chave de pagamento é ligada. */}
          <Button type="button" variant="secondary" size="lg" disabled aria-describedby="pag-morador-nota" data-testid="conta-cartao-adicionar">
            <Plus className="h-4 w-4" aria-hidden /> Adicionar cartão
          </Button>
        </div>
        <p id="pag-morador-nota" className="mt-3 text-sm text-muted">
          {NOTA_MORADOR}
        </p>
      </section>
    </div>
  );
}
