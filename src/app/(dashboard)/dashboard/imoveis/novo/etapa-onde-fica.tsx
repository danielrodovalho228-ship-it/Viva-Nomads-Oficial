"use client";

import { CartaoEscolha } from "@/components/anuncio/escolha-assistente";
import { useEffect, useState, type ReactNode } from "react";
import { MapPin, AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import { ImportarAnuncio } from "@/components/property/importar-anuncio";
import { AjudaPublicar } from "@/components/property/ajuda-publicar";
import type { AnuncioOrganizado } from "@/lib/anuncio/importar-anuncio";
import { DocumentoUploader } from "@/components/documento-uploader";
import { DocumentoVinculo, type EstadoDocumentoTela } from "@/components/anuncio/documento-vinculo";
import type { CampoEnderecoDoc, EnderecoDoc } from "@/lib/documento/endereco-documento";
import { EtapaIdentidade } from "@/components/anuncio/etapa-identidade";
import type { PhotoItem } from "@/components/photo-uploader";
import { DOC_AUTORIZACAO, exigeAutorizacao, OPERACOES, TIPOS_DOC_GESTAO, type Operacao } from "@/lib/anuncio/operacao";
import { LocationDatalist } from "@/lib/locations";
import { CITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { mensagemCep, type OpcaoEndereco, type ResultadoCep } from "@/lib/cep/buscar";
import { digitadoPelaPessoa, type CampoEndereco } from "@/lib/cep/aplicar";
import { Erro, Labeled, Toggle } from "./campos";
import { BuscaEndereco } from "./busca-endereco";
import { DeclaracoesDoImovel } from "./declaracoes-passo10";
import type { DeclaracoesPasso10 } from "@/lib/anuncio/requisitos-passo10";
import { EVENTO_ABRIR_SECAO, secoesAntesDePublicar, type EstadoSecao, type SecaoAntesDePublicar } from "@/lib/anuncio/passo10-colunas";
import { useEstadoIdentidade } from "@/lib/identidade/use-estado-identidade";
import { ResumoEndereco, enderecoCompletoParaResumo } from "./resumo-endereco";
import type { InfoMatricula } from "@/components/anuncio/matricula-resultado";
import type { PreenchimentoMatricula } from "@/lib/documento/conferencia-matricula";

/** A cidade está entre as liberadas? (comparação sem acento e sem maiúscula). */
function cidadeLiberada(cidade: string): boolean {
  const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return CITIES.some((c) => n(c.name) === n(cidade));
}

/** E104: o Complemento serve a casa, chácara e apartamento — o exemplo não supõe o tipo do imóvel. */
export const PLACEHOLDER_COMPLEMENTO = "Bloco, apartamento, casa ou referência";

/**
 * Passo 3 — Endereço (mockup cadastro-imovel-03; E104): SÓ o endereço. CEP primeiro (com foco; ViaCEP e, se não achar,
 * BrasilAPI; sempre responde com uma mensagem e, se não existir, "buscar pelo endereço"), rua e número, complemento,
 * bairro e cidade, aviso de cidade fora da lista; com o endereço completo, a linha do endereço e o mapa do bairro.
 * Quem opera, identidade, documento do imóvel e importar/ajuda NÃO moram aqui (ver AntesDePublicar e AtalhosCadastro).
 */
export function EtapaOndeFica(p: {
  cep: string;
  setCep: (v: string) => void;
  cepLoading: boolean;
  /** Resposta da busca do CEP (prompt 20): sempre vira mensagem na tela. */
  cepResultado: ResultadoCep | null;
  onEscolherEndereco: (o: OpcaoEndereco) => void;
  street: string;
  setStreet: (v: string) => void;
  /** Prompt 22: a pessoa digitou neste campo (o CEP não troca mais). O autofill do navegador não marca. */
  marcarDigitado: (c: CampoEndereco) => void;
  numero: string;
  setNumero: (v: string) => void;
  complemento: string;
  setComplemento: (v: string) => void;
  neighborhood: string;
  setNeighborhood: (v: string) => void;
  bairroDoCep: string | null;
  setBairroDoCep: (v: string | null) => void;
  city: string;
  setCity: (v: string) => void;
  uf: string;
  daMatricula?: Set<string>;
  /** Endereço da matrícula quando é diferente do CEP: o dono escolhe qual vale. */
  enderecoMatricula?: PreenchimentoMatricula["endereco"] | null;
  onEnderecoMatricula?: (usar: boolean) => void;
  erros: Record<string, string>;
}) {
  const foraDaArea = !!p.city.trim() && !cidadeLiberada(p.city);
  // Erro de formato do CEP só ao sair do campo (nunca enquanto a pessoa digita).
  const [cepSaiu, setCepSaiu] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const digitosCep = p.cep.replace(/\D/g, "").length;
  const r = p.cepResultado;
  const podeBuscarEndereco = r?.tipo === "nao_encontrado" || r?.tipo === "cidade";
  const avisoPrivacidade = (
    <p className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted" data-testid="endereco-privacidade">
      <MapPin className="mt-1 h-3.5 w-3.5 shrink-0 text-sage" />
      <span>
        <strong className="text-ink">Rua e número NUNCA aparecem no anúncio público</strong>: mostramos só a região
        aproximada (um círculo do bairro). O endereço completo é liberado apenas <strong className="text-ink">após o aceite</strong>.
      </span>
    </p>
  );
  return (
    <div className="space-y-4" data-testid="etapa-onde-fica">
      <Labeled label="CEP">
        <div className="relative">
          <input
            value={p.cep}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 8);
              p.setCep(d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d);
            }}
            inputMode="numeric"
            // Prompt 22: sem autofill no endereço — o Chrome preenchia o endereço SALVO (outra cidade) antes do ViaCEP.
            autoComplete="off"
            name="vn-cadastro-a1"
            id="vn-cadastro-a1"
            maxLength={9}
            placeholder="00000-000"
            className="input"
            autoFocus
            aria-invalid={!!p.erros.cep}
            onBlur={() => setCepSaiu(true)}
            onFocus={() => setCepSaiu(false)}
            data-testid="cadastro-cep"
          />
          {p.cepLoading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">buscando…</span>}
        </div>
        {!p.cepLoading && r && digitosCep === 8 ? (
          <span
            role="status"
            data-testid="cep-resultado"
            data-tipo={r.tipo}
            className={cn("mt-1 flex items-start gap-2 text-xs", r.tipo === "rua" ? "text-forest" : "text-amber-900")}
          >
            {r.tipo === "rua" ? <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> : <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />}
            <span>
              {r.tipo === "nao_encontrado" ? (
                <>
                  Não encontramos esse CEP —{" "}
                  <button type="button" className="font-semibold underline" onClick={() => setBuscaAberta(true)} data-testid="cep-buscar-endereco">
                    buscar pelo endereço
                  </button>
                </>
              ) : (
                mensagemCep(r)
              )}
              {r.tipo === "cidade" && (
                <>
                  {" · "}
                  <button type="button" className="font-semibold underline" onClick={() => setBuscaAberta(true)} data-testid="cep-buscar-endereco">
                    buscar pelo endereço
                  </button>
                </>
              )}
            </span>
          </span>
        ) : cepSaiu && digitosCep > 0 && digitosCep < 8 ? (
          <span className="mt-1 block text-xs text-red-700" role="alert" data-testid="cep-incompleto">
            O CEP tem 8 números.
          </span>
        ) : (
          <span className="mt-1 block text-xs text-muted">Com o CEP, preenchemos rua, bairro e cidade.</span>
        )}
        <Erro msg={p.erros.cep} />
      </Labeled>
      {buscaAberta && podeBuscarEndereco && (
        <BuscaEndereco
          ufInicial={p.uf}
          cidadeInicial={r?.tipo === "cidade" ? r.cidade : p.city}
          ruaInicial={p.street}
          onEscolher={(o) => {
            p.onEscolherEndereco(o);
            setBuscaAberta(false);
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <Labeled label="Rua" daMatricula={p.daMatricula?.has("endereco")}>
          <input
            value={p.street}
            onChange={(e) => {
              if (digitadoPelaPessoa(e.nativeEvent)) p.marcarDigitado("rua");
              p.setStreet(e.target.value);
            }}
            autoComplete="off"
            name="vn-cadastro-a2"
            className="input"
            placeholder="Rua ou avenida"
            aria-invalid={!!p.erros.rua}
            data-testid="cadastro-rua"
          />
          <Erro msg={p.erros.rua} />
        </Labeled>
        <Labeled label="Número">
          <input
            value={p.numero}
            onChange={(e) => p.setNumero(e.target.value.slice(0, 20))}
            autoComplete="off"
            name="vn-cadastro-a3"
            className="input"
            placeholder="123"
            aria-invalid={!!p.erros.numero}
            inputMode="text"
            data-testid="cadastro-numero"
          />
          <Erro msg={p.erros.numero} />
        </Labeled>
      </div>
      {p.enderecoMatricula && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status" data-testid="endereco-matricula-conflito">
          <p className="font-semibold">O endereço da matrícula é diferente do CEP — confira.</p>
          <p className="mt-1 text-xs">
            Na matrícula:{" "}
            {[p.enderecoMatricula.rua, p.enderecoMatricula.numero, p.enderecoMatricula.bairro, p.enderecoMatricula.cidade].filter(Boolean).join(", ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <button type="button" className="font-semibold underline" onClick={() => p.onEnderecoMatricula?.(true)} data-testid="endereco-matricula-usar">
              Usar o endereço da matrícula
            </button>
            <button type="button" className="font-semibold underline" onClick={() => p.onEnderecoMatricula?.(false)} data-testid="endereco-matricula-manter">
              Manter o do CEP
            </button>
          </div>
        </div>
      )}
      <Labeled label="Complemento" ajuda="(opcional)" daMatricula={p.daMatricula?.has("complemento")}>
        <input
          value={p.complemento}
          onChange={(e) => p.setComplemento(e.target.value.slice(0, 60))}
          autoComplete="off"
          name="vn-cadastro-a4"
          className="input"
          placeholder={PLACEHOLDER_COMPLEMENTO}
          data-testid="cadastro-complemento"
        />
      </Labeled>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Labeled label="Bairro">
          <input
            value={p.neighborhood}
            onChange={(e) => {
              if (digitadoPelaPessoa(e.nativeEvent)) p.marcarDigitado("bairro");
              p.setNeighborhood(e.target.value);
            }}
            list="novo-bairros"
            autoComplete="off"
            name="vn-cadastro-a5"
            className="input"
            data-testid="cadastro-bairro"
          />
          <LocationDatalist id="novo-bairros" />
          <Erro msg={p.erros.bairro} />
          {p.bairroDoCep && (
            <span className="mt-1 block rounded-lg bg-amber-50 px-2 py-2 text-xs text-amber-900" role="status">
              O CEP indica <strong>{p.bairroDoCep}</strong> — confirmar?{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => {
                  p.setNeighborhood(p.bairroDoCep!);
                  p.setBairroDoCep(null);
                }}
              >
                Usar {p.bairroDoCep}
              </button>{" "}
              ·{" "}
              <button type="button" className="font-semibold underline" onClick={() => p.setBairroDoCep(null)}>
                Manter {p.neighborhood}
              </button>
            </span>
          )}
        </Labeled>
        <Labeled label={`Cidade${p.uf ? ` (${p.uf})` : ""}`}>
          <input
            value={p.city}
            onChange={(e) => {
              if (digitadoPelaPessoa(e.nativeEvent)) p.marcarDigitado("cidade");
              p.setCity(e.target.value);
            }}
            autoComplete="off"
            name="vn-cadastro-a6"
            className="input"
            data-testid="cadastro-cidade"
          />
          <Erro msg={p.erros.cidade} />
        </Labeled>
      </div>

      {foraDaArea && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status" data-testid="aviso-cidade-fora">
          <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
          <span>
            Por enquanto a Viva Nomads atende {CITIES.map((c) => c.name).join(", ")}. Você pode cadastrar e deixar o
            anúncio pronto: avisamos quando a sua cidade abrir.
          </span>
        </p>
      )}

      {/* Mockup cadastro-imovel-03: com o endereço preenchido, a linha do endereço completo, o mapa do bairro, o aviso de
          privacidade e as etiquetas do bairro e da cidade. Antes disso, só o aviso. */}
      {enderecoCompletoParaResumo({ rua: p.street, numero: p.numero, bairro: p.neighborhood, cidade: p.city }) ? (
        <ResumoEndereco
          rua={p.street}
          numero={p.numero}
          complemento={p.complemento}
          bairro={p.neighborhood}
          cidade={p.city}
          uf={p.uf}
          aviso={avisoPrivacidade}
        />
      ) : (
        avisoPrivacidade
      )}

    </div>
  );
}

/**
 * E104: o que o Passo 3 carregava e não é endereço — quem opera (e o documento da sublocação/gestão), a identidade
 * (CAF) e o documento do imóvel (matrícula) — mora na Revisão (Passo 10), num cartão "Antes de publicar". As regras
 * não mudam: a prontidão continua barrando a publicação sem eles (itens "sublocacao" e "documento", agora resolvidos na
 * Revisão). A ordem da decisão do Daniel (18/10) segue: endereço (Passo 3) → identidade → matrícula.
 */
export function AntesDePublicar(p: {
  ownershipType: Operacao;
  setOwnershipType: (v: Operacao) => void;
  subleaseAuthorized: boolean;
  setSubleaseAuthorized: (fn: (v: boolean) => boolean) => void;
  subleaseDoc: PhotoItem[];
  setSubleaseDoc: (d: PhotoItem[]) => void;
  docOperacaoAnexado: boolean;
  subleaseDocTipo: string;
  setSubleaseDocTipo: (t: string) => void;
  cep: string;
  street: string;
  numero: string;
  neighborhood: string;
  city: string;
  imovelId: string | null;
  docEstado: EstadoDocumentoTela;
  docMotivos: string[];
  onDocumento: (estado: EstadoDocumentoTela, motivos: string[]) => void;
  /** Prompt 19: a matrícula conferida preenche o anúncio. */
  onMatricula?: (m: InfoMatricula) => void;
  /** O que ainda falta na operação (declaração, tipo do documento ou o anexo); "" = nada. */
  faltaOperacao: string;
  /** L1-1: endereço já gravado do imóvel (rascunho retomado) — o "Enviar documento" não trava se ele estiver completo. */
  enderecoSalvo?: EnderecoDoc | null;
  /** L1-1: o toque em "Enviar documento" sem CEP/rua/número marca os campos que faltam. */
  onFaltaDocumento?: (campos: CampoEnderecoDoc[]) => void;
  /** E149-A: o documento já foi enviado no começo do cadastro ("Documento enviado no início · em análise"). */
  linhaDocumentoInicio?: string | null;
  /** E132-A: as declarações de um toque (IPTU, água/luz/gás e, em condomínio, a convenção). */
  declaracoes: DeclaracoesPasso10;
  setDeclaracoes: (d: DeclaracoesPasso10) => void;
  emCondominio: boolean;
}) {
  const doc = exigeAutorizacao(p.ownershipType) ? DOC_AUTORIZACAO[p.ownershipType as "subleased" | "managed"] : null;
  // E251: cada seção legal é um item com estado (✓ ou "falta") que abre no lugar. O conteúdo fica montado (só escondido)
  // para não perder um envio de documento ou de autorização no meio.
  const { situacao: identidade, recarregar: recarregarIdentidade } = useEstadoIdentidade();
  const estadoIdentidade = !identidade
    ? "carregando"
    : identidade.identidade.estado === "confirmada"
      ? "ok"
      : identidade.identidade.estado === "em_breve"
        ? "em_breve"
        : identidade.temCpf
          ? "pendente"
          : "sem_cpf";
  const secoes = secoesAntesDePublicar({
    faltaOperacao: p.faltaOperacao,
    rotuloOperacao: OPERACOES.find((o) => o.valor === p.ownershipType)?.rotulo ?? "",
    identidade: estadoIdentidade,
    documento: p.docEstado,
    linhaDocumentoInicio: p.linhaDocumentoInicio,
    declaracoes: p.declaracoes,
    emCondominio: p.emCondominio,
  });
  const [abertas, setAbertas] = useState<Set<SecaoAntesDePublicar>>(() => new Set());
  const alternar = (id: SecaoAntesDePublicar) => setAbertas((a) => (a.has(id) ? new Set([...a].filter((x) => x !== id)) : new Set([...a, id])));
  // "Resolver" (lista de conferência) e o motivo do botão travado abrem a seção certa.
  useEffect(() => {
    const abrir = (e: Event) => {
      const id = (e as CustomEvent<SecaoAntesDePublicar>).detail;
      setAbertas((a) => new Set([...a, id]));
    };
    window.addEventListener(EVENTO_ABRIR_SECAO, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_SECAO, abrir);
  }, []);

  const conteudo: Record<SecaoAntesDePublicar, ReactNode> = {
    operacao: (
      <div className="space-y-4">
        <div className="min-w-0">
          <span className="mb-2 block text-sm font-medium text-ink">Quem opera este imóvel?</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Quem opera este imóvel?">
            {OPERACOES.map(({ valor, rotulo }) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={p.ownershipType === valor}
                onClick={() => p.setOwnershipType(valor)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors",
                  p.ownershipType === valor ? "border-forest bg-forest text-white" : "border-sage-200 text-ink hover:border-sage"
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        {doc && (
          <div className="space-y-3 rounded-xl border border-sage-200 p-4" data-testid="documento-operacao">
            <div className="rounded-lg bg-champagne/10 px-3 py-2 text-xs text-ink">{doc.aviso}</div>
            <Toggle
              checked={p.subleaseAuthorized}
              onChange={() => p.setSubleaseAuthorized((v) => !v)}
              label={doc.declaracao}
              hint="Declaração obrigatória. A equipe confere o documento antes de publicar."
            />
            {p.ownershipType === "managed" && (
              <fieldset className="space-y-2" data-testid="documento-operacao-tipo">
                <legend className="mb-1 text-sm font-medium text-ink">O que você vai anexar?</legend>
                {/* E193: escolha única no cartão da Qualificação (antes, botões redondos de rádio). */}
                <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="O que você vai anexar?">
                  {TIPOS_DOC_GESTAO.map((t) => (
                    <CartaoEscolha key={t.valor} on={p.subleaseDocTipo === t.valor} onClick={() => p.setSubleaseDocTipo(t.valor)} rotulo={t.rotulo} testid={`tipo-doc-operacao-${t.valor}`} />
                  ))}
                </div>
              </fieldset>
            )}
            <div>
              <span className="mb-2 block text-sm font-medium text-ink">
                {doc.titulo} <span className="font-normal text-muted">(obrigatório para publicar)</span>
              </span>
              {p.docOperacaoAnexado && p.subleaseDoc.length === 0 && (
                <p className="mb-2 text-xs text-forest" data-testid="documento-operacao-anexado">
                  Documento já anexado. Envie outro só se quiser substituir.
                </p>
              )}
              <DocumentoUploader docs={p.subleaseDoc} onChange={p.setSubleaseDoc} rotulo="Anexar documento" />
            </div>
            <Erro msg={p.faltaOperacao || undefined} />
          </div>
        )}
      </div>
    ),
    // Ordem (decisão do Daniel, 18/10): endereço → identidade (CAF) → matrícula. Com laudo válido a etapa já vem feita.
    identidade: <EtapaIdentidade onConfirmada={() => void recarregarIdentidade()} />,
    documento: (
      <div className="space-y-3">
        {p.linhaDocumentoInicio && (
          <p className="text-sm font-medium text-ink" data-testid="documento-do-inicio">
            {p.linhaDocumentoInicio}
          </p>
        )}
        <DocumentoVinculo
          imovelId={p.imovelId}
          endereco={{ cep: p.cep, rua: p.street, numero: p.numero, bairro: p.neighborhood, cidade: p.city }}
          operacao={p.ownershipType}
          estado={p.docEstado}
          motivos={p.docMotivos}
          onResultado={p.onDocumento}
          onMatricula={p.onMatricula}
          enderecoSalvo={p.enderecoSalvo}
          onFalta={p.onFaltaDocumento}
        />
      </div>
    ),
    declaracoes: <DeclaracoesDoImovel valor={p.declaracoes} onChange={p.setDeclaracoes} emCondominio={p.emCondominio} />,
  };

  return (
    <section className="space-y-2" data-testid="antes-de-publicar" aria-label="Seções antes de publicar">
      <ul className="divide-y divide-line rounded-xl border border-line">
        {secoes.map((s) => {
          const aberta = abertas.has(s.id);
          return (
            <li key={s.id} data-testid={`antes-secao-${s.id}`} data-estado={s.estado} data-aberta={aberta ? "1" : "0"}>
              <button
                type="button"
                aria-expanded={aberta}
                aria-controls={`antes-conteudo-${s.id}`}
                onClick={() => alternar(s.id)}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
                data-testid={`antes-secao-${s.id}-abrir`}
              >
                <SinalSecao estado={s.estado} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{s.titulo}</span>
                  <span className={cn("block truncate text-sm", s.estado === "falta" ? "text-red-700" : "text-muted")}>{s.resumo}</span>
                </span>
                <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted transition-transform", aberta && "rotate-180")} aria-hidden />
              </button>
              <div id={`antes-conteudo-${s.id}`} hidden={!aberta} className="px-4 pb-4" data-testid={`antes-conteudo-${s.id}`}>
                {conteudo[s.id]}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** ✓ (feito), "falta" (segura a publicação) ou um aviso neutro (em andamento ou opcional). */
function SinalSecao({ estado }: { estado: EstadoSecao }) {
  if (estado === "ok") return <CheckCircle2 className="h-6 w-6 shrink-0 fill-forest text-white" aria-label="feito" />;
  if (estado === "falta")
    return (
      <span className="shrink-0 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700" data-testid="sinal-falta">
        falta
      </span>
    );
  return <span className="h-6 w-6 shrink-0 rounded-full border-2 border-sage-200" aria-label="em andamento" />;
}

/**
 * E104: os atalhos de exceção (prompt 20) — importar o texto de um anúncio de outro site ou pedir ajuda à equipe —
 * numa linha discreta no fim do Passo 1, o começo do cadastro (no Passo 3 só fica o endereço).
 */
export function AtalhosCadastro(p: { aplicarImportado: (a: AnuncioOrganizado) => void; /** E149-A */ onComecePelaMatricula?: () => void }) {
  const [atalho, setAtalho] = useState<"importar" | "ajuda" | null>(null);
  return (
    <div className="space-y-4">
      {/* Prompt 20: atalhos de exceção numa linha discreta (o caminho principal é o cartão da IA lá em cima). */}
      {/* E132-A, item 6: UMA linha de texto, só no cadastro novo (links, não botões cheios). */}
      <p className="text-sm leading-relaxed text-muted" data-testid="atalhos-passo1">
        {/* E149-A: a matrícula no início — o mesmo documento do Passo 10, lido agora para preencher o cadastro. */}
        {p.onComecePelaMatricula && (
          <>
            Tem a matrícula à mão?{" "}
            <button type="button" className="font-semibold text-forest underline underline-offset-2" onClick={p.onComecePelaMatricula} data-testid="matricula-inicio-abrir">
              Comece por ela
            </button>
            {" · "}
          </>
        )}
        Já anuncia em outro site?{" "}
        <button type="button" className="font-semibold text-forest underline underline-offset-2" onClick={() => setAtalho("importar")} data-testid="importar-abrir">
          Importar
        </button>
        {" · "}Prefere ajuda?{" "}
        <button type="button" className="font-semibold text-forest underline underline-offset-2" onClick={() => setAtalho("ajuda")} data-testid="ajuda-publicar-abrir">
          Fale com a Viva
        </button>
      </p>
      {/* Atalho (t115): importar o texto do próprio anúncio leva direto à etapa 3, com tudo preenchido. */}
      {atalho === "importar" && <ImportarAnuncio onAplicar={p.aplicarImportado} abertoInicial />}
      {atalho === "ajuda" && <AjudaPublicar abertoInicial />}
    </div>
  );
}
