"use client";

import { CartaoEscolha } from "@/components/anuncio/escolha-assistente";
import { ROTULO_FALTA_CHACARA, linhasChacaraRevisao, type DadosChacara } from "@/lib/anuncio/chacara";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, CheckCircle2, ChevronDown, Circle, ImageIcon } from "lucide-react";
import type { ItemProntidao, Prontidao } from "@/lib/anuncio/prontidao";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { TERMO_IA_TEXTO, textoTermoJaAceito } from "@/lib/anuncio/termo-ia";
import { fraseDescontoCard, type Negociacao } from "@/lib/anuncio/negociacao";
import { conferenciaAssistente, etapaDoItemProntidao, type IdEtapaAssistente } from "@/lib/anuncio/assistente-dez-etapas";
import { TEXTOS_REVISAO, linhaRevisao, tituloPrevia } from "@/lib/anuncio/assistente-telas";
import { precosDaPrevia } from "@/lib/anuncio/passo10-colunas";
import { SOMBRA_CARTAO_CADASTRO } from "@/lib/conta/visual-mockup";
import type { EstadoDocumentoTela } from "@/components/anuncio/documento-vinculo";
import { cn, formatBRL } from "@/lib/utils";
import { textoFaltaConfirmar } from "@/lib/conforto/exibicao";
import { ConviteFotoCandidatura } from "@/components/account/convite-foto-candidatura";
import { CONVITE_FOTO_ANUNCIO_TEXTO } from "@/lib/perfil/convite-foto";

/**
 * Passo 10 — Revise e publique. E251 (desenho aprovado pelo coordenador em 29/10), duas colunas no computador:
 *  • à esquerda, "Antes de publicar": a lista de conferência (uma linha por passo, "Resolver") e as seções legais
 *    (quem opera, identidade, documento, declarações), cada uma com estado (✓ ou "falta") que abre no lugar;
 *  • à direita, fixa: a prévia do anúncio com os preços nos três nomes fixos (Mensal · Total por mês (com contas) ·
 *    Estadia mínima (N meses)) e UM "Publicar anúncio", travado com o motivo em uma linha enquanto faltar algo.
 * No celular, coluna única: a lista primeiro, a prévia recolhida ("Ver como fica o anúncio") e o "Publicar anúncio" no
 * rodapé fixo, no lugar do "Continuar". As regras de publicar não mudam (12 itens do essencial + isEligible + aceite).
 */
export function EtapaRevisar(p: {
  previewProperty: Property;
  /** E251: as seções legais em acordeão (AntesDePublicar), na coluna da lista. */
  antesDePublicar?: ReactNode;
  /** E251: no computador o "Publicar anúncio" mora na coluna da prévia; no celular, no rodapé do fluxo. */
  telaLarga: boolean;
  rotuloPublicar: string;
  /** O motivo em uma linha ("Falta: documento do imóvel"); null quando nada falta. */
  motivoTravado: string | null;
  /** Tocar no motivo leva ao primeiro item que falta. */
  onMotivo: () => void;
  /** E242: o "Ver no tamanho real" (computador), embaixo da foto do cartão; no celular ele fica no fim do passo. */
  tamanhoReal?: ReactNode;
  titulo: string;
  tipo: string;
  bairro: string;
  fotos: string[];
  negociacao: Negociacao;
  prontidao: Prontidao;
  completude: ItemProntidao[];
  /** "Resolver" de cada passo pendente (a qualificação abre no painel lateral). */
  onResolver: (item: ItemProntidao) => void;
  /** Opcionais que faltam (65-B: o vídeo leva ao bloco de vídeo do passo Fotos pelo onResolver). */
  melhorar: ItemProntidao[];
  docEstado: EstadoDocumentoTela;
  docMotivos: string[];
  editingId: string | null;
  publishing: boolean;
  publish: (asDraft?: boolean, irParaQualificacao?: boolean) => void;
  irPara: (i: number) => void;
  aceitouIa: boolean;
  setAceitouIa: (v: boolean) => void;
  /** 64-B: o texto mudou depois do aceite — aviso logo acima da caixa. */
  avisoAceite?: string | null;
  /** L2-B item 23: o dono já aceitou a versão atual do termo (servidor) → linha no lugar da caixa. */
  termoJaAceito?: { aceitoEm: string } | null;
  conforto: string[];
  publishError: string | null;
  podePublicar: boolean;
  /** E102-A: só no tipo Chácara/Sítio — os dados preenchidos do grupo rural. */
  chacara?: DadosChacara | null;
}) {
  const conf = conferenciaAssistente(p.prontidao);
  const precos = precosDaPrevia(p.previewProperty);
  // E139: sem valor mensal não há total — condomínio ou contas sozinhos não viram preço.
  const temValorMensal = (p.previewProperty.monthlyPrice ?? 0) > 0;
  const linha = linhaRevisao(p.previewProperty.bedrooms, p.previewProperty.bathrooms, p.previewProperty.areaM2);
  const desconto = fraseDescontoCard(p.negociacao.descontos);
  const tudoCerto = conf.itens.every((i) => i.ok);
  const primeiroPendente = (id: IdEtapaAssistente) => p.completude.find((i) => !i.ok && etapaDoItemProntidao(i.key).id === id);
  const [previaAberta, setPreviaAberta] = useState(false);
  const travado = !p.podePublicar || p.publishing;

  const cartao = (
    <section className={cn("min-w-0 rounded-xl bg-white p-4 sm:p-6", SOMBRA_CARTAO_CADASTRO)} aria-label="Seu anúncio" data-testid="revisao-cartao">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-2">
        {p.fotos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto do próprio dono (URL do armazenamento ou blob local)
          <img src={p.fotos[0]} alt="Foto principal do anúncio" className="h-full w-full object-cover" data-testid="revisao-foto" />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted">
            <ImageIcon className="h-8 w-8" aria-hidden /> A foto principal aparece aqui
          </span>
        )}
      </div>
      {p.tamanhoReal}
      <p className="mt-4 font-title text-xl font-semibold text-ink" data-testid="revisao-titulo">
        {tituloPrevia(p.titulo, p.tipo, p.bairro)}
      </p>
      {linha && (
        <p className="mt-1 text-base text-muted" data-testid="revisao-linha">
          {linha}
        </p>
      )}
      {!temValorMensal ? (
        <p className="mt-3 text-sm text-muted" data-testid="revisao-sem-valor">
          Valor mensal ainda não definido.
        </p>
      ) : (
        // PROP-2: os três preços com nome; a estadia mínima com a conta aberta (E251 d: ainda não há contrato).
        <dl className="mt-3 space-y-1 text-sm" data-testid="previa-precos">
          {precos.map((l, n) => (
            <div key={l.rotulo} className="flex items-baseline justify-between gap-3" data-testid={`previa-preco-${["mensal", "total-mes", "estadia-minima"][n]}`}>
              <dt className="text-muted">{l.rotulo}</dt>
              <dd className={cn("text-right font-semibold", n === 1 ? "font-title text-lg text-forest" : "text-ink")}>{l.valor == null ? "—" : formatBRL(l.valor)}</dd>
            </div>
          ))}
          {precos[2].conta && <p className="text-right text-xs text-muted" data-testid="previa-conta-estadia">{precos[2].conta}</p>}
          {desconto && <p className="text-xs text-muted">{desconto}</p>}
        </dl>
      )}
      {/* Computador: o único "Publicar anúncio" da tela, com o motivo em uma linha enquanto faltar algo. */}
      {p.telaLarga && (
        <div className="mt-6 space-y-2">
          <Button className="w-full" size="lg" onClick={() => p.publish(false)} disabled={travado} data-testid="publicar-anuncio">
            {p.rotuloPublicar}
          </Button>
          <MotivoTravado motivo={p.publishing ? null : p.motivoTravado} onMotivo={p.onMotivo} />
        </div>
      )}
    </section>
  );

  const lista = (
    <section className="min-w-0" aria-labelledby="lista-conferencia-titulo" data-testid="lista-conferencia" data-faltam={conf.itens.filter((i) => !i.ok).length}>
      <h3 id="lista-conferencia-titulo" className="text-base font-semibold text-ink">
        {tudoCerto ? TEXTOS_REVISAO.listaTudoCerto : TEXTOS_REVISAO.lista}
      </h3>
      <ul className="mt-1 divide-y divide-line">
        {conf.itens.map((i) => {
          const pendente = i.ok ? undefined : primeiroPendente(i.id);
          // Os itens da prontidão que seguram este passo (ex.: "privacidade", "conforto" em Comodidades).
          const itens = p.completude.filter((c) => !c.ok && etapaDoItemProntidao(c.key).id === i.id).map((c) => c.key).join(" ");
          return (
            <li key={i.id} className="flex items-start gap-3 py-3" data-testid={`conferencia-${i.id}`} data-ok={i.ok ? "1" : "0"} data-itens={itens || undefined}>
              {i.ok ? <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 fill-forest text-white" aria-hidden /> : <Circle className="mt-1 h-6 w-6 shrink-0 text-muted" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block text-base text-ink">
                  {i.rotulo}
                  <span className="sr-only">{i.ok ? " — feito" : " — falta"}</span>
                </span>
                {!i.ok && i.faltam.length > 0 && <span className="block text-sm text-muted">Falta: {i.faltam.join("; ")}</span>}
              </span>
              {pendente && (
                <button
                  type="button"
                  onClick={() => p.onResolver(pendente)}
                  className="inline-flex min-h-11 shrink-0 items-center text-sm font-semibold text-forest underline underline-offset-2"
                  data-testid={`conferencia-resolver-${i.id}`}
                >
                  {pendente.key === "qualificacao" ? "Responder aqui" : "Resolver"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {p.chacara && (
        <div className="mt-4 rounded-lg border border-line p-3" data-testid="revisao-chacara">
          <p className="text-sm font-semibold text-ink">{ROTULO_FALTA_CHACARA}</p>
          <ul className="mt-1 space-y-1 text-sm">
            {linhasChacaraRevisao(p.chacara).map((l) => (
              <li key={l.chave} className={cn("flex items-center gap-1", l.ok ? "text-ink" : "text-muted")} data-testid={`revisao-chacara-${l.chave}`}>
                {l.texto}
                {l.ok && <Check className="h-4 w-4 text-forest" aria-label="feito" />}
              </li>
            ))}
          </ul>
        </div>
      )}
      {conf.pendentesNaRevisao.length > 0 && (
        <p className="mt-2 text-sm text-ink" data-testid="conferencia-revisao">
          Falta: {conf.pendentesNaRevisao.join("; ")}
        </p>
      )}
      {p.melhorar.length > 0 && (
        <p className="mt-3 text-sm text-muted" data-testid="prontidao-opcionais">
          Para melhorar (opcional, não impede publicar):{" "}
          {p.melhorar.map((o, n) => (
            <span key={o.key}>
              {n > 0 && " · "}
              {o.key === "video" ? (
                <button type="button" onClick={() => p.onResolver(o)} className="font-medium text-forest underline" data-testid="melhorar-video">
                  {o.label}
                </button>
              ) : (
                o.label
              )}
            </span>
          ))}
        </p>
      )}
    </section>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start xl:gap-12" data-testid="etapa-revisar">
      {/* Coluna da esquerda: "Antes de publicar" — a lista de conferência, as seções legais em acordeão e o aceite. */}
      <div className={cn("min-w-0 space-y-6 rounded-xl bg-white p-4 sm:p-6", SOMBRA_CARTAO_CADASTRO)} data-testid="passo10-coluna-lista">
        <h2 className="font-title text-2xl font-semibold text-ink">Antes de publicar</h2>
        {lista}
        {p.antesDePublicar}
        {p.avisoAceite && (
          <p role="status" className="text-sm font-medium text-ink" data-testid="aceite-ia-aviso">
            {p.avisoAceite}
          </p>
        )}
        {p.termoJaAceito ? (
          <p className="text-sm text-muted" data-testid="aceite-ia-ja-aceito">
            {textoTermoJaAceito(p.termoJaAceito.aceitoEm)}
          </p>
        ) : (
          // E193: o aceite no cartão da Qualificação (antes, caixa quadrada); continua uma caixa de marcar para o leitor de tela.
          <div data-testid="aceite-ia">
            <CartaoEscolha papel="checkbox" on={p.aceitouIa} onClick={() => p.setAceitouIa(!p.aceitouIa)} rotulo={<span className="font-normal">{TERMO_IA_TEXTO}</span>} />
          </div>
        )}
        {p.publishError && <p className="text-sm text-red-600">{p.publishError}</p>}
        {/* Prompt 59-A (critério f da varredura): o que falta, por extenso, logo abaixo da lista. */}
        {!p.podePublicar && !p.publishing && <FaltaParaPublicar {...p} />}
        {/* Ordem 504d9679, peça 3: convite opcional; nunca entra na conta de podePublicar. */}
        {!p.editingId && <ConviteFotoCandidatura texto={CONVITE_FOTO_ANUNCIO_TEXTO} testId="convite-foto-anuncio" />}
        {/* Celular: o motivo do "Publicar anúncio" do rodapé, em uma linha, logo acima dele. */}
        {!p.telaLarga && <MotivoTravado motivo={p.publishing ? null : p.motivoTravado} onMotivo={p.onMotivo} />}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          {/* O rascunho salva sozinho ("Salvo às HH:MM"): sem "Salvar como rascunho". Na edição de um anúncio, salvar sem
              publicar continua possível. */}
          {p.editingId ? (
            <Button variant="outline" onClick={() => p.publish(true)} disabled={p.publishing}>
              Salvar sem publicar
            </Button>
          ) : (
            <span aria-hidden />
          )}
          <p className="text-center text-sm text-muted" data-testid="revisao-termos">
            Ao publicar, você concorda com os{" "}
            <Link href="/termos" className="underline underline-offset-2">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="underline underline-offset-2">
              Política de Privacidade
            </Link>{" "}
            da Viva Nomads.
          </p>
        </div>
      </div>

      {/* Coluna da direita, fixa no computador: a prévia e o "Publicar anúncio". No celular, a prévia vem recolhida. */}
      <aside className="min-w-0 lg:sticky lg:top-4" aria-label="Prévia do anúncio" data-testid="passo10-coluna-previa">
        <button
          type="button"
          aria-expanded={previaAberta}
          onClick={() => setPreviaAberta((v) => !v)}
          className={cn("flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 text-left font-semibold text-forest lg:hidden", SOMBRA_CARTAO_CADASTRO)}
          data-testid="previa-recolhida"
        >
          Ver como fica o anúncio
          <ChevronDown className={cn("h-5 w-5 shrink-0 transition-transform", previaAberta && "rotate-180")} aria-hidden />
        </button>
        <div className={cn("mt-3 lg:mt-0 lg:block", !previaAberta && "hidden")} data-testid="previa-conteudo">
          {cartao}
        </div>
        <p className="mt-3 hidden text-center text-sm text-muted lg:block">{TEXTOS_REVISAO.editarDepois}</p>
      </aside>
    </div>
  );
}

/** O motivo do "Publicar anúncio" travado, em UMA linha; tocar leva ao primeiro item que falta. */
function MotivoTravado({ motivo, onMotivo }: { motivo: string | null; onMotivo: () => void }) {
  if (!motivo) return null;
  return (
    <button type="button" onClick={onMotivo} className="block w-full truncate text-center text-sm font-medium text-red-700 underline-offset-2 hover:underline" title={motivo} data-testid="publicar-motivo">
      {motivo}
    </button>
  );
}

/** "Falta confirmar: Água quente, Iluminação." e o resto do que trava a publicação, visível embaixo do botão. */
function FaltaParaPublicar(p: { editingId?: string | null; conforto: string[]; completude: ItemProntidao[]; aceitouIa: boolean; onResolver: (i: ItemProntidao) => void }) {
  const conforto = p.editingId ? null : textoFaltaConfirmar(p.conforto);
  const itemConforto = p.completude.find((i) => i.key === "conforto" && !i.ok);
  const outros = p.completude.filter((i) => !i.ok && i.key !== "conforto").map((i) => i.label);
  if (!p.aceitouIa) outros.push("aceite do termo da IA");
  if (!conforto && outros.length === 0) return null;
  return (
    <div className="space-y-1 text-sm text-ink" data-testid="publicar-falta">
      {conforto && (
        <p data-testid="publicar-falta-conforto">
          {conforto}{" "}
          {itemConforto && (
            <button type="button" data-testid="publicar-falta-conforto-resolver" onClick={() => p.onResolver(itemConforto)} className="font-semibold text-forest underline underline-offset-2">
              Confirmar agora
            </button>
          )}
        </p>
      )}
      {/* E251: no celular o motivo do "Publicar anúncio" (uma linha, logo abaixo) já diz isso — não repete. */}
      {outros.length > 0 && (
        <p className="hidden lg:block" data-testid="publicar-falta-outros">
          Falta resolver: {outros.join(", ")}.
        </p>
      )}
    </div>
  );
}
