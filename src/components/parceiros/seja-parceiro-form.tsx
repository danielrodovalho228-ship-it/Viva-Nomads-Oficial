"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { CATEGORIAS_CATALOGO, CIDADES_MAX, DESCRICAO_MAX, rotuloCategoria, validarSolicitacao } from "@/lib/parceiros/regras";
import { enviarSolicitacao, type MinhaParceria } from "@/lib/parceiros/solicitacao-actions";
import { TEXTO_REGRA_90_10 } from "@/config/taxa-servico-parceiros";
import { CONVITE_SEJA_PARCEIRO } from "@/lib/parceiros/convite-avaliacao";
import { PERGUNTA_NOTA } from "@/lib/parceiros/fiscal";

/**
 * "Seja parceiro" (Prompt 31a, item 2). Exige conta com e-mail confirmado: quem não entrou preenche, vai criar a
 * conta (ou entrar) e volta com o formulário preenchido (rascunho só neste navegador). O e-mail é o da conta e o
 * telefone é opcional e nunca aparece em público.
 */
const RASCUNHO = "vn-parceria-rascunho";
const VOLTA = "/parceiros?seja=1#quero-ser-parceiro";

const STATUS_TEXTO: Record<string, string> = {
  aguardando_email: "A equipe começou um pedido em seu nome. Confira os dados abaixo e confirme o envio.",
  pendente: "Aguardando aprovação da Viva. Resposta em até 1 dia útil, por e-mail.",
  aprovada: "Sua parceria foi aprovada. Veja o e-mail com o link para ativar a sua página.",
};

interface Campos {
  nome: string;
  tipoPessoa: "pf" | "pj";
  documento: string;
  categorias: string[];
  cidades: string;
  portfolioUrl: string;
  descricao: string;
  telefone: string;
  empresa: string;
  veiculo: string;
  /** FISCAL-PARCEIRO-B: só na trilha PJ; "" = ainda não respondeu (o envio não conclui). */
  emiteNota: "" | "sim" | "nao";
  aceite: boolean;
}

const input = "mt-1 w-full rounded-lg border border-sage-200 bg-white px-3 py-2 text-base text-ink";

export function SejaParceiroForm({ estado, origem = "site", categoriaInicial }: { estado: MinhaParceria; origem?: "site" | "conta"; categoriaInicial?: string }) {
  const sol = estado.solicitacao;
  const [c, setC] = useState<Campos>(() => ({
    nome: sol?.nome ?? estado.nome ?? "",
    tipoPessoa: sol?.tipoPessoa === "pj" ? "pj" : "pf",
    documento: "",
    categorias: sol?.categorias?.length ? sol.categorias : categoriaInicial ? [categoriaInicial] : [],
    cidades: sol?.cidades?.join(", ") ?? "",
    portfolioUrl: sol?.portfolioUrl ?? "",
    descricao: sol?.descricao ?? "",
    telefone: "",
    empresa: "",
    veiculo: "",
    emiteNota: sol?.emiteNota === true ? "sim" : sol?.emiteNota === false ? "nao" : "",
    aceite: false,
  }));
  const [armadilha, setArmadilha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [pendente, iniciar] = useTransition();

  // Volta do login/cadastro: recupera o que a pessoa já tinha digitado (nunca o documento). Depois da hidratação,
  // para o HTML do servidor e o do navegador começarem iguais.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const r = sessionStorage.getItem(RASCUNHO);
        if (!r) return;
        const salvo = JSON.parse(r) as Partial<Campos>;
        setC((x) => ({ ...x, ...salvo, documento: x.documento, aceite: false }));
        if (estado.logado) sessionStorage.removeItem(RASCUNHO);
      } catch {
        /* sem armazenamento: segue em branco */
      }
    }, 0);
    return () => clearTimeout(t);
  }, [estado.logado]);

  const set = <K extends keyof Campos>(k: K, v: Campos[K]) => setC((x) => ({ ...x, [k]: v }));
  const temCategoria = (v: string) => c.categorias.includes(v);
  const outras = c.categorias.some((x) => x !== "fotografia" && x !== "mudanca");

  if (estado.parceiro) {
    return (
      <div data-testid="seja-parceiro-ja-parceiro">
        <p className="font-semibold text-ink">Esta conta já é parceira da Viva.</p>
        <ButtonLink href="/dashboard/parceiro" className="mt-3">
          Abrir o meu painel de parceiro
        </ButtonLink>
      </div>
    );
  }
  if (enviado || (sol && sol.status !== "aguardando_email" && ["pendente", "aprovada"].includes(sol.status))) {
    return (
      <div className="flex gap-3" role="status" data-testid="seja-parceiro-recebido">
        <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-forest" aria-hidden />
        <div>
          <p className="font-semibold text-ink">{enviado ? STATUS_TEXTO.pendente : STATUS_TEXTO[sol!.status]}</p>
          <p className="mt-1 text-sm text-muted">Mandamos a confirmação para {estado.email}. Você acompanha pela sua conta.</p>
          <p className="mt-2 text-sm text-ink" data-testid="seja-parceiro-regra">{TEXTO_REGRA_90_10}</p>
        </div>
      </div>
    );
  }

  function irParaConta() {
    try {
      const { documento: _doc, aceite: _a, ...resto } = c;
      void _doc;
      void _a;
      sessionStorage.setItem(RASCUNHO, JSON.stringify(resto));
    } catch {
      /* segue sem rascunho */
    }
    window.location.href = `/auth?cadastro=1&redirect=${encodeURIComponent(VOLTA)}`;
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!estado.logado) return irParaConta();
    const entrada = {
      ...c,
      cidades: c.cidades.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean),
      emiteNota: c.tipoPessoa === "pj" && c.emiteNota ? c.emiteNota === "sim" : undefined,
    };
    const v = validarSolicitacao(entrada);
    if (!v.ok) return setErro(v.erro);
    iniciar(async () => {
      const r = await enviarSolicitacao({ ...entrada, armadilha, origem }).catch(() => ({ ok: false as const, erro: "Sem conexão. Tente de novo." }));
      if (r.ok) setEnviado(true);
      else setErro(r.erro);
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4" data-testid="seja-parceiro-form">
      {sol?.status === "recusada" && sol.motivoRecusa && (
        <p className="rounded-xl border border-line bg-surface-2 p-3 text-sm text-ink" data-testid="seja-parceiro-recusa">
          O pedido anterior não foi aprovado: {sol.motivoRecusa} Você pode enviar um novo pedido.
        </p>
      )}
      {sol?.status === "aguardando_email" && <p className="rounded-xl border border-line bg-surface-2 p-3 text-sm text-ink">{STATUS_TEXTO.aguardando_email}</p>}
      {!estado.logado && (
        <p className="rounded-xl border border-sage-200 bg-sage-50 p-3 text-sm text-ink" data-testid="seja-parceiro-precisa-conta">
          Para pedir a parceria, você precisa de uma conta com e-mail confirmado. Preencha e toque em continuar: você cria a conta (ou entra) e volta com tudo preenchido.
        </p>
      )}
      {estado.logado && !estado.emailConfirmado && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-ink" role="alert" data-testid="seja-parceiro-confirmar-email">
          Confirme o seu e-mail ({estado.email}) pelo link que enviamos e depois volte aqui para enviar o pedido.
        </p>
      )}

      <div>
        <label htmlFor="sp-nome" className="block text-sm font-medium text-ink">Nome (ou nome da empresa)</label>
        <input id="sp-nome" autoComplete="name" value={c.nome} onChange={(e) => set("nome", e.target.value)} className={input} />
      </div>
      {estado.logado && (
        <div>
          <label htmlFor="sp-email" className="block text-sm font-medium text-ink">E-mail (o da sua conta)</label>
          <input id="sp-email" value={estado.email ?? ""} readOnly className={`${input} bg-surface-2`} />
        </div>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-ink">Você atende como</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(["pf", "pj"] as const).map((t) => (
            <label key={t} className={`flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold ${c.tipoPessoa === t ? "border-blue-500 bg-blue-50 text-blue-700" : "border-sage-200 bg-white text-ink"}`}>
              <input type="radio" name="sp-tipo" value={t} checked={c.tipoPessoa === t} onChange={() => set("tipoPessoa", t)} className="sr-only" />
              {t === "pf" ? "Pessoa física (CPF)" : "Empresa ou MEI (CNPJ)"}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="sp-doc" className="block text-sm font-medium text-ink">{c.tipoPessoa === "pf" ? "CPF" : "CNPJ"}</label>
        <input id="sp-doc" inputMode="numeric" autoComplete="off" value={c.documento} onChange={(e) => set("documento", e.target.value)} placeholder={c.tipoPessoa === "pf" ? "000.000.000-00" : "00.000.000/0000-00"} className={input} />
        <p className="mt-1 text-xs text-muted">Usado só pela equipe para conferir a parceria. Nunca aparece na sua página.</p>
      </div>
      {c.tipoPessoa === "pj" && (
        <fieldset data-testid="sp-emite-nota">
          <legend className="text-sm font-medium text-ink">{PERGUNTA_NOTA}</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(["sim", "nao"] as const).map((v) => (
              <label key={v} className={`flex h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold ${c.emiteNota === v ? "border-blue-500 bg-blue-50 text-blue-700" : "border-sage-200 bg-white text-ink"}`}>
                <input type="radio" name="sp-emite-nota" value={v} checked={c.emiteNota === v} onChange={() => set("emiteNota", v)} className="sr-only" data-testid={`sp-emite-nota-${v}`} />
                {v === "sim" ? "Sim" : "Não"}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">A nota (ou o recibo) do serviço é sua, para o cliente. A Viva emite o documento só da taxa dela.</p>
        </fieldset>
      )}

      <fieldset>
        <legend className="text-sm font-medium text-ink">Categorias</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {CATEGORIAS_CATALOGO.map((k) => (
            <label key={k.valor} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-sage-200 bg-white px-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={temCategoria(k.valor)}
                onChange={(e) => set("categorias", e.target.checked ? [...c.categorias, k.valor] : c.categorias.filter((x) => x !== k.valor))}
                data-testid={`sp-cat-${k.valor}`}
              />
              {k.rotulo}
            </label>
          ))}
        </div>
        {/* Prompt 62-A, item 1: avaliação de imóveis é credenciamento à parte (nunca categoria do catálogo). */}
        <div className="mt-2 rounded-lg border border-sage-200 bg-white p-3 text-sm" data-testid="sp-convite-avaliacao">
          <p className="font-semibold text-ink">{CONVITE_SEJA_PARCEIRO.titulo}</p>
          <p className="mt-1 text-muted">{CONVITE_SEJA_PARCEIRO.texto}</p>
          <Link href="/dashboard/parceiro/avaliacao" className="mt-1 inline-block font-semibold text-forest underline underline-offset-2">
            {CONVITE_SEJA_PARCEIRO.link}
          </Link>
        </div>
      </fieldset>

      <div>
        <label htmlFor="sp-cidades" className="block text-sm font-medium text-ink">Cidades atendidas</label>
        <input id="sp-cidades" value={c.cidades} onChange={(e) => set("cidades", e.target.value)} placeholder="Uberlândia, Araguari" className={input} />
        <p className="mt-1 text-xs text-muted">Separe por vírgula (até {CIDADES_MAX}).</p>
      </div>

      {temCategoria("fotografia") && (
        <div>
          <label htmlFor="sp-portfolio" className="block text-sm font-medium text-ink">Link do portfólio (obrigatório para fotografia)</label>
          <input id="sp-portfolio" type="url" inputMode="url" value={c.portfolioUrl} onChange={(e) => set("portfolioUrl", e.target.value)} placeholder="https://" className={input} />
        </div>
      )}
      {temCategoria("mudanca") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="sp-empresa" className="block text-sm font-medium text-ink">Empresa de mudança</label>
            <input id="sp-empresa" value={c.empresa} onChange={(e) => set("empresa", e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="sp-veiculo" className="block text-sm font-medium text-ink">Veículo (tipo e capacidade)</label>
            <input id="sp-veiculo" value={c.veiculo} onChange={(e) => set("veiculo", e.target.value)} placeholder="Caminhão baú 3/4" className={input} />
          </div>
        </div>
      )}
      <div>
        <label htmlFor="sp-descricao" className="block text-sm font-medium text-ink">
          Descrição do serviço{outras ? "" : " (opcional)"}
        </label>
        <textarea id="sp-descricao" rows={4} maxLength={DESCRICAO_MAX} value={c.descricao} onChange={(e) => set("descricao", e.target.value)} className={input} />
      </div>
      <div>
        <label htmlFor="sp-telefone" className="block text-sm font-medium text-ink">Telefone (opcional)</label>
        <input id="sp-telefone" type="tel" inputMode="tel" autoComplete="tel" value={c.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(34) 99999-0000" className={input} />
        <p className="mt-1 text-xs text-muted">Só para a equipe falar com você sobre o pedido. Nunca aparece em público; com clientes, a conversa é pelas mensagens da Viva.</p>
      </div>

      {/* Armadilha para robôs: invisível para pessoas. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="sp-site-empresa">Não preencha</label>
        <input id="sp-site-empresa" tabIndex={-1} autoComplete="off" value={armadilha} onChange={(e) => setArmadilha(e.target.value)} />
      </div>

      {estado.logado && (
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" checked={c.aceite} onChange={(e) => set("aceite", e.target.checked)} className="mt-1" data-testid="sp-aceite" />
          <span>Confirmo os dados e autorizo a Viva a usá-los para analisar a parceria.</span>
        </label>
      )}

      <p className="text-sm text-ink" data-testid="seja-parceiro-regra-90-10">
        {TEXTO_REGRA_90_10}
      </p>
      {erro && (
        <p className="text-sm text-red-700" role="alert" data-testid="seja-parceiro-erro">
          {erro}
        </p>
      )}
      <Button type="submit" className="w-full sm:w-auto" disabled={pendente || (estado.logado && !estado.emailConfirmado)} data-testid="seja-parceiro-enviar">
        {pendente && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {estado.logado ? "Enviar pedido de parceria" : "Continuar: criar conta ou entrar"}
      </Button>
      {c.categorias.length > 0 && <p className="text-xs text-muted">Categorias: {c.categorias.map(rotuloCategoria).join(", ")}.</p>}
    </form>
  );
}
