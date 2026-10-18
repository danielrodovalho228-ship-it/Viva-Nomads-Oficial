"use client";

import { useState } from "react";
import { MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";
import { ImportarAnuncio } from "@/components/property/importar-anuncio";
import { AjudaPublicar } from "@/components/property/ajuda-publicar";
import type { AnuncioOrganizado } from "@/lib/anuncio/importar-anuncio";
import { DocumentoUploader } from "@/components/documento-uploader";
import { DocumentoVinculo, type EstadoDocumentoTela } from "@/components/anuncio/documento-vinculo";
import type { PhotoItem } from "@/components/photo-uploader";
import { DOC_AUTORIZACAO, exigeAutorizacao, OPERACOES, type Operacao } from "@/lib/anuncio/operacao";
import { PROPERTY_TYPES } from "@/lib/amenities";
import { LocationDatalist } from "@/lib/locations";
import { CITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { mensagemCep, type OpcaoEndereco, type ResultadoCep } from "@/lib/cep/buscar";
import { Erro, Labeled, Toggle } from "./campos";
import { BuscaEndereco } from "./busca-endereco";
import type { InfoMatricula } from "@/components/anuncio/matricula-resultado";
import type { PreenchimentoMatricula } from "@/lib/documento/conferencia-matricula";

/** A cidade está entre as liberadas? (comparação sem acento e sem maiúscula). */
function cidadeLiberada(cidade: string): boolean {
  const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  return CITIES.some((c) => n(c.name) === n(cidade));
}

/**
 * Etapa 1 — Onde fica (prompt 10): tipo do imóvel, quem opera, CEP PRIMEIRO (com foco; ViaCEP e, se não achar,
 * BrasilAPI), número e complemento, aviso de cidade fora da lista e o documento do imóvel (prompt 11), conferido na
 * hora. Prompt 20: no topo, o cartão "Preencher com IA" (`topo`); o CEP sempre responde com uma mensagem (e, se não
 * existir, "buscar pelo endereço"); importar e pedir ajuda viram uma linha discreta no fim.
 */
export function EtapaOndeFica(p: {
  /** Cartão "Preencher com IA" (prompt 20), no topo do passo. */
  topo?: React.ReactNode;
  aplicarImportado: (a: AnuncioOrganizado) => void;
  propertyType: string;
  setPropertyType: (v: string) => void;
  tipoSugerido: boolean;
  ownershipType: Operacao;
  setOwnershipType: (v: Operacao) => void;
  subleaseAuthorized: boolean;
  setSubleaseAuthorized: (fn: (v: boolean) => boolean) => void;
  subleaseDoc: PhotoItem[];
  setSubleaseDoc: (d: PhotoItem[]) => void;
  docOperacaoAnexado: boolean;
  cep: string;
  setCep: (v: string) => void;
  cepLoading: boolean;
  /** Resposta da busca do CEP (prompt 20): sempre vira mensagem na tela. */
  cepResultado: ResultadoCep | null;
  onEscolherEndereco: (o: OpcaoEndereco) => void;
  street: string;
  setStreet: (v: string) => void;
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
  imovelId: string | null;
  docEstado: EstadoDocumentoTela;
  docMotivos: string[];
  onDocumento: (estado: EstadoDocumentoTela, motivos: string[]) => void;
  /** Prompt 19: a matrícula conferida preenche o anúncio. */
  onMatricula?: (m: InfoMatricula) => void;
  daMatricula?: Set<string>;
  /** Endereço da matrícula quando é diferente do CEP: o dono escolhe qual vale. */
  enderecoMatricula?: PreenchimentoMatricula["endereco"] | null;
  onEnderecoMatricula?: (usar: boolean) => void;
  erros: Record<string, string>;
}) {
  const doc = exigeAutorizacao(p.ownershipType) ? DOC_AUTORIZACAO[p.ownershipType as "subleased" | "managed"] : null;
  const foraDaArea = !!p.city.trim() && !cidadeLiberada(p.city);
  // Erro de formato do CEP só ao sair do campo (nunca enquanto a pessoa digita).
  const [cepSaiu, setCepSaiu] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [atalho, setAtalho] = useState<"importar" | "ajuda" | null>(null);
  const digitosCep = p.cep.replace(/\D/g, "").length;
  const r = p.cepResultado;
  const podeBuscarEndereco = r?.tipo === "nao_encontrado" || r?.tipo === "cidade";
  return (
    <div className="space-y-4" data-testid="etapa-onde-fica">
      {p.topo}
      <Labeled label="CEP">
        <div className="relative">
          <input
            value={p.cep}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 8);
              p.setCep(d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d);
            }}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={9}
            placeholder="00000-000"
            className="input"
            autoFocus
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
            className={cn("mt-1 flex items-start gap-1.5 text-xs", r.tipo === "rua" ? "text-forest" : "text-amber-900")}
          >
            {r.tipo === "rua" ? <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> : <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />}
            <span>
              {r.tipo === "nao_encontrado" ? (
                <>
                  Não encontramos esse CEP. Confira os números ou{" "}
                  <button type="button" className="font-semibold underline" onClick={() => setBuscaAberta(true)} data-testid="cep-buscar-endereco">
                    busque pelo endereço
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
          <input value={p.street} onChange={(e) => p.setStreet(e.target.value)} className="input" placeholder="Rua ou avenida" data-testid="cadastro-rua" />
          <Erro msg={p.erros.rua} />
        </Labeled>
        <Labeled label="Número">
          <input value={p.numero} onChange={(e) => p.setNumero(e.target.value.slice(0, 20))} className="input" placeholder="123" inputMode="text" data-testid="cadastro-numero" />
          <Erro msg={p.erros.numero} />
        </Labeled>
      </div>
      {p.enderecoMatricula && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status" data-testid="endereco-matricula-conflito">
          <p className="font-semibold">O endereço da matrícula é diferente do CEP — confira.</p>
          <p className="mt-0.5 text-xs">
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
        <input value={p.complemento} onChange={(e) => p.setComplemento(e.target.value.slice(0, 60))} className="input" placeholder="Apto 101, bloco B" data-testid="cadastro-complemento" />
      </Labeled>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Labeled label="Bairro">
          <input value={p.neighborhood} onChange={(e) => p.setNeighborhood(e.target.value)} list="novo-bairros" autoComplete="off" className="input" data-testid="cadastro-bairro" />
          <LocationDatalist id="novo-bairros" />
          <Erro msg={p.erros.bairro} />
          {p.bairroDoCep && (
            <span className="mt-1 block rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900" role="status">
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
          <input value={p.city} onChange={(e) => p.setCity(e.target.value)} className="input" data-testid="cadastro-cidade" />
          <Erro msg={p.erros.cidade} />
        </Labeled>
      </div>

      {foraDaArea && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status" data-testid="aviso-cidade-fora">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Por enquanto a Viva Nomads atende {CITIES.map((c) => c.name).join(", ")}. Você pode cadastrar e deixar o
            anúncio pronto: avisamos quando a sua cidade abrir.
          </span>
        </p>
      )}

      <p className="flex items-start gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
        <span>
          <strong className="text-ink">Rua e número NUNCA aparecem no anúncio público</strong>: mostramos só a região
          aproximada (um círculo do bairro). O endereço completo é liberado apenas <strong className="text-ink">após o aceite</strong>.
        </span>
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Labeled label="Tipo de imóvel" sugerido={p.tipoSugerido}>
          <select value={p.propertyType} onChange={(e) => p.setPropertyType(e.target.value)} className="input">
            {PROPERTY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Labeled>
        <div className="min-w-0">
          <span className="mb-1.5 block text-sm font-medium text-ink">Quem opera este imóvel?</span>
          <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label="Quem opera este imóvel?">
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
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">
              {doc.titulo} <span className="font-normal text-muted">(obrigatório para publicar)</span>
            </span>
            {p.docOperacaoAnexado && p.subleaseDoc.length === 0 && (
              <p className="mb-2 text-xs text-forest" data-testid="documento-operacao-anexado">
                Documento já anexado. Envie outro só se quiser substituir.
              </p>
            )}
            <DocumentoUploader docs={p.subleaseDoc} onChange={p.setSubleaseDoc} rotulo="Anexar documento" />
          </div>
          <Erro msg={p.erros.sublocacao} />
        </div>
      )}

      <DocumentoVinculo
        imovelId={p.imovelId}
        endereco={{ cep: p.cep, rua: p.street, numero: p.numero, bairro: p.neighborhood, cidade: p.city }}
        operacao={p.ownershipType}
        estado={p.docEstado}
        motivos={p.docMotivos}
        onResultado={p.onDocumento}
        onMatricula={p.onMatricula}
      />

      {/* Prompt 20: atalhos de exceção numa linha discreta (o caminho principal é o cartão da IA lá em cima). */}
      <p className="text-xs text-muted" data-testid="atalhos-passo1">
        Já tem anúncio em outro site?{" "}
        <button type="button" className="font-semibold text-forest underline underline-offset-2" onClick={() => setAtalho("importar")} data-testid="importar-abrir">
          Importar
        </button>
        {" · "}Prefere ajuda?{" "}
        <button type="button" className="font-semibold text-forest underline underline-offset-2" onClick={() => setAtalho("ajuda")} data-testid="ajuda-publicar-abrir">
          Falar com a equipe
        </button>
      </p>
      {/* Atalho (t115): importar o texto do próprio anúncio leva direto à etapa 3, com tudo preenchido. */}
      {atalho === "importar" && <ImportarAnuncio onAplicar={p.aplicarImportado} abertoInicial />}
      {atalho === "ajuda" && <AjudaPublicar abertoInicial />}
    </div>
  );
}
