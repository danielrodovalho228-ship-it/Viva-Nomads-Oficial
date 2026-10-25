"use client";

import { ROTULO_FALTA_CHACARA, linhasChacaraRevisao, type DadosChacara } from "@/lib/anuncio/chacara";
import Link from "next/link";
import { Check, CheckCircle2, Circle, Clock, ImageIcon, XCircle } from "lucide-react";
import type { ItemProntidao, Prontidao } from "@/lib/anuncio/prontidao";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { TERMO_IA_TEXTO, textoTermoJaAceito } from "@/lib/anuncio/termo-ia";
import { fraseDescontoCard, type Negociacao } from "@/lib/anuncio/negociacao";
import { conferenciaAssistente, etapaDoItemProntidao, type IdEtapaAssistente } from "@/lib/anuncio/assistente-dez-etapas";
import { TEXTOS_REVISAO, linhaRevisao, tituloPrevia } from "@/lib/anuncio/assistente-telas";
import { calcularTotalMensal } from "@/lib/precos";
import { SOMBRA_CARTAO_CADASTRO } from "@/lib/conta/visual-mockup";
import type { EstadoDocumentoTela } from "@/components/anuncio/documento-vinculo";
import { cn, formatBRL } from "@/lib/utils";
import { textoFaltaConfirmar } from "@/lib/conforto/exibicao";
import { ConviteFotoCandidatura } from "@/components/account/convite-foto-candidatura";
import { CONVITE_FOTO_ANUNCIO_TEXTO } from "@/lib/perfil/convite-foto";

/**
 * Passo 10 — Revise e publique (mockup cadastro-imovel-10). No computador, duas colunas: à esquerda a "Lista de
 * conferência" (uma linha por passo, com o que falta e "Resolver"); à direita o cartão do anúncio (foto, título,
 * quartos · banheiros · área, "R$ X/mês no total" pelo total mensal do anúncio). No celular, o cartão vem primeiro,
 * depois a lista ("Tudo certo para publicar" quando nada falta). CADASTRO-MOLDURA: o "Publicar anúncio" é o primário
 * do rodapé do fluxo, e o rascunho salva sozinho (sem botão de salvar no cadastro novo).
 * Ficam as travas que já existiam e o desenho não mostra: estado do documento (quando não está conferido), aceite do
 * termo da IA, o convite opcional da foto do anfitrião e o que falta para publicar.
 */
export function EtapaRevisar(p: {
  previewProperty: Property;
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
  const total = calcularTotalMensal(p.previewProperty).total;
  const linha = linhaRevisao(p.previewProperty.bedrooms, p.previewProperty.bathrooms, p.previewProperty.areaM2);
  const desconto = fraseDescontoCard(p.negociacao.descontos);
  const tudoCerto = conf.itens.every((i) => i.ok);
  const primeiroPendente = (id: IdEtapaAssistente) => p.completude.find((i) => !i.ok && etapaDoItemProntidao(i.key).id === id);

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
      <p className="mt-4 font-title text-xl font-semibold text-ink" data-testid="revisao-titulo">
        {tituloPrevia(p.titulo, p.tipo, p.bairro)}
      </p>
      {linha && (
        <p className="mt-1 text-base text-muted" data-testid="revisao-linha">
          {linha}
        </p>
      )}
      {total > 0 && (
        <>
          <p className="mt-3 font-title text-2xl font-semibold text-forest" data-testid="revisao-total">
            {formatBRL(total)}/mês no total
          </p>
          <p className="mt-1 text-sm text-muted">
            {TEXTOS_REVISAO.linhaTotal}
            {desconto ? ` · ${desconto}` : ""}
          </p>
        </>
      )}
    </section>
  );

  const lista = (
    <section className={cn("min-w-0 rounded-xl bg-white p-4 sm:p-6", SOMBRA_CARTAO_CADASTRO)} aria-labelledby="lista-conferencia-titulo" data-testid="lista-conferencia" data-faltam={conf.itens.filter((i) => !i.ok).length}>
      <h2 id="lista-conferencia-titulo" className="font-title text-2xl font-semibold text-ink">
        <span className="lg:hidden">{tudoCerto ? TEXTOS_REVISAO.listaTudoCerto : TEXTOS_REVISAO.lista}</span>
        <span className="hidden lg:inline">{TEXTOS_REVISAO.lista}</span>
      </h2>
      <ul className="mt-3 divide-y divide-line">
        {conf.itens.map((i) => {
          const pendente = i.ok ? undefined : primeiroPendente(i.id);
          // Os itens da prontidão que seguram este passo (ex.: "privacidade", "conforto" em Comodidades).
          const itens = p.completude.filter((c) => !c.ok && etapaDoItemProntidao(c.key).id === i.id).map((c) => c.key).join(" ");
          return (
            <li key={i.id} className="flex items-start gap-3 py-3" data-testid={`conferencia-${i.id}`} data-ok={i.ok ? "1" : "0"} data-itens={itens || undefined}>
              {i.ok ? <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 fill-forest text-white" aria-hidden /> : <Circle className="mt-1 h-6 w-6 shrink-0 text-muted" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block text-lg text-ink">
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
    <div className="space-y-6" data-testid="etapa-revisar">
      {/* Estado do documento (prompt 11): aparece quando ainda segura a publicação; conferido, some (a lista já diz). */}
      {!p.editingId && <DocumentoEstado estado={p.docEstado} motivos={p.docMotivos} onEnviar={() => document.querySelector('[data-testid="antes-de-publicar"]')?.scrollIntoView({ behavior: "smooth", block: "start" })} />}

      {/* Um "Publicar anúncio" só. Celular: cartão, lista, aceite e botão. Computador: lista à esquerda; cartão e botão à
          direita; o aceite embaixo, na largura toda. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 lg:col-start-2 lg:row-start-1">{cartao}</div>
        <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">{lista}</div>
        <div className="min-w-0 space-y-6 lg:col-span-2 lg:row-start-3">
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
            <label className="flex items-start gap-3 rounded-xl border border-sage-200 bg-white px-4 py-3 text-sm text-ink" data-testid="aceite-ia">
              <input type="checkbox" checked={p.aceitouIa} onChange={(e) => p.setAceitouIa(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-forest" />
              <span>{TERMO_IA_TEXTO}</span>
            </label>
          )}
          {p.publishError && <p className="text-sm text-red-600">{p.publishError}</p>}
          {/* Ordem 504d9679, peça 3: convite opcional; nunca entra na conta de podePublicar. */}
          {!p.editingId && <ConviteFotoCandidatura texto={CONVITE_FOTO_ANUNCIO_TEXTO} testId="convite-foto-anuncio" />}
        </div>
        {/* CADASTRO-MOLDURA: o "Publicar anúncio" é o primário do rodapé do fluxo (um só por tela). */}
        <div className="min-w-0 lg:col-start-2 lg:row-start-2">
          <p className="text-center text-sm text-muted lg:hidden">{TEXTOS_REVISAO.editarDepois}</p>
        </div>
      </div>
      {/* Prompt 59-A (critério f da varredura): o botão nunca fica desabilitado em silêncio — diz o que falta. */}
      {!p.podePublicar && !p.publishing && <FaltaParaPublicar {...p} />}

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
  );
}

function DocumentoEstado({ estado, motivos, onEnviar }: { estado: EstadoDocumentoTela; motivos: string[]; onEnviar: () => void }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
        estado === "aprovado" && "sr-only",
        estado === "corrija" && "border-red-200 bg-red-50 text-red-800",
        estado === "revisao" && "border-amber-200 bg-amber-50 text-amber-900",
        estado === "nenhum" && "border-sage-200 bg-white text-ink",
      )}
      data-testid="revisar-documento"
      data-estado={estado}
    >
      {estado === "revisao" ? <Clock className="mt-1 h-4 w-4 shrink-0" aria-hidden /> : estado === "aprovado" ? null : <XCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden />}
      <span>
        {estado === "aprovado" && "Documentação conferida"}
        {estado === "revisao" && (
          <>
            <strong>Em revisão.</strong> A equipe confere em até 48 horas. Você pode salvar como rascunho; a publicação libera
            depois da conferência.
          </>
        )}
        {estado === "corrija" && (
          <>
            <strong>Corrija o documento.</strong> {motivos.join(" ")}{" "}
            <button type="button" className="font-medium underline" onClick={onEnviar}>
              Reenviar no passo Endereço
            </button>
          </>
        )}
        {estado === "nenhum" && (
          <>
            <strong>Documento do imóvel ainda não enviado.</strong>{" "}
            <button type="button" className="font-medium underline" onClick={onEnviar}>
              Enviar no passo Endereço
            </button>
          </>
        )}
      </span>
    </div>
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
      {outros.length > 0 && <p data-testid="publicar-falta-outros">Falta resolver: {outros.join(", ")}.</p>}
    </div>
  );
}
