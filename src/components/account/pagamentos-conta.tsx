"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, Check, Copy, CreditCard } from "lucide-react";
import { meusPapeis } from "@/lib/data/papeis-actions";
import { minhaChavePix, removerChavePix, salvarChavePix, type MinhaChavePix } from "@/lib/data/recebimento-actions";
import { TIPOS_CHAVE_PIX, type TipoChavePix } from "@/lib/conta/chave-pix";
import {
  AVISE_CARTAO,
  AVISO_CARTAO_GRAVADO,
  BOTAO_PARCEIRO,
  BOTAO_PARCEIRO_ATIVO,
  CARTAO_EM_BREVE,
  CONVITE_PARCEIRO,
  DICA_SALVAR_CHAVE,
  NOTA_MORADOR,
  NOTA_PARCEIRO,
  NOTA_RECEBE,
  SEM_CARTAO,
  TITULO_MORADOR,
  TITULO_PARCEIRO,
  TITULO_RECEBE,
} from "@/lib/conta/tela-pagamentos";
import { Button, ButtonLink } from "@/components/ui/button";
import { CartaoComFoto } from "@/components/account/cartao-com-foto";
import { PHOTOS } from "@/lib/media";
import { useParceiroAprovado } from "@/lib/use-papel-barra";
import { gravarLocalStorageBruto, useLocalStorageBruto } from "@/lib/use-client-state";

const campo = "w-full min-h-[44px] rounded-lg border border-line bg-white px-3 text-sm text-ink";

/**
 * A7 — Conta › Pagamentos (mockup perfil-07). "Como você recebe (proprietário)": a chave Pix em que o morador paga o
 * valor mensal direto ao proprietário (PERFIL-B, 0236; só o dono lê e grava), no campo com o botão de copiar.
 * "Para suas estadias (morador)": a linha do cartão e o estado honesto do pagamento com cartão (E70: "em breve" +
 * "Avise-me", sem botão morto; nada de cadastro nem cobrança — a Viva não recebe o valor mensal).
 * "Como você recebe (parceiro)" (E70): informativo enquanto o pagamento de parceiros está desligado; para quem ainda
 * não é parceiro, o convite "Cadastrar meu serviço". Os três cartões com a foto pequena do padrão dos Papéis.
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
  const parceiro = useParceiroAprovado();
  const interesseCartao = useLocalStorageBruto("vivanomads-cartao-interesse");
  const [aviseLocal, setAviseLocal] = useState(false);
  const avise = aviseLocal || !!interesseCartao;

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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4" data-testid="conta-pagamentos">
      {dono && (
        <CartaoComFoto foto={PHOTOS.pagamentos.proprietario} testId="conta-pix">
          <h2 id="pag-recebe-titulo" className="font-title text-2xl font-semibold text-ink">
            {TITULO_RECEBE}
          </h2>
          {pix && !editando ? (
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">
              <div className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg border border-line px-4">
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={salvar}
                disabled={pendente || !chave.trim()}
                aria-describedby={chave.trim() ? undefined : "conta-pix-dica"}
                data-testid="conta-pix-salvar"
              >
                Salvar chave
              </Button>
              {!chave.trim() && (
                <p id="conta-pix-dica" className="text-xs text-muted sm:col-span-3" data-testid="conta-pix-dica">
                  {DICA_SALVAR_CHAVE}
                </p>
              )}
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
        </CartaoComFoto>
      )}

      <CartaoComFoto foto={PHOTOS.pagamentos.morador} testId="conta-pag-morador">
        <h2 id="pag-morador-titulo" className="font-title text-2xl font-semibold text-ink">
          {TITULO_MORADOR}
        </h2>
        <div className="mt-3 flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-sage-100 text-forest" aria-hidden>
            <CreditCard className="h-5 w-5" />
          </span>
          <span className="text-base text-ink" data-testid="conta-cartao">
            {SEM_CARTAO}
          </span>
        </div>
        {/* E70: sem botão morto — o pagamento com cartão ainda não existe; quem quiser, pede o aviso. */}
        <p className="mt-3 text-sm font-semibold text-ink" data-testid="conta-cartao-em-breve">
          {CARTAO_EM_BREVE}
        </p>
        {avise ? (
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-sage-100 px-4 py-2 text-sm font-medium text-forest" role="status" data-testid="conta-cartao-avisado">
            <Check className="h-4 w-4" aria-hidden /> {AVISO_CARTAO_GRAVADO}
          </p>
        ) : (
          <Button
            type="button"
            variant="secondary"
            // No celular o texto quebra em duas linhas em vez de passar da tela (t402: 42 px de rolagem lateral a 390).
            className="mt-2 h-auto min-h-11 max-w-full whitespace-normal py-2 text-left"
            onClick={() => {
              gravarLocalStorageBruto("vivanomads-cartao-interesse", "1");
              setAviseLocal(true);
            }}
            data-testid="conta-cartao-avise"
          >
            <BellRing className="h-4 w-4" aria-hidden /> {AVISE_CARTAO}
          </Button>
        )}
        <p className="mt-3 text-sm text-muted">{NOTA_MORADOR}</p>
      </CartaoComFoto>

      <CartaoComFoto foto={PHOTOS.pagamentos.parceiro} testId="conta-pag-parceiro">
        <h2 className="font-title text-2xl font-semibold text-ink">{TITULO_PARCEIRO}</h2>
        <p className="mt-2 text-sm text-ink" data-testid="conta-parceiro-nota">
          {parceiro ? NOTA_PARCEIRO : CONVITE_PARCEIRO}
        </p>
        {!parceiro && <p className="mt-1 text-sm text-muted">{NOTA_PARCEIRO}</p>}
        <ButtonLink href="/dashboard/parceiro" variant={parceiro ? "secondary" : "primary"} className="mt-3" data-testid="conta-parceiro-botao">
          {parceiro ? BOTAO_PARCEIRO_ATIVO : BOTAO_PARCEIRO}
        </ButtonLink>
      </CartaoComFoto>
    </div>
  );
}
