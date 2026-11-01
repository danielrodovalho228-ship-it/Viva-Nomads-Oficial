import Image from "next/image";
import { UserPlus } from "lucide-react";
import { fotoDaCategoria } from "@/config/fotos-categorias-parceiro";
import { BRAND_BLUR } from "@/lib/media";
import { ButtonLink } from "@/components/ui/button";
import { AvisoFotografo } from "@/app/(public)/parceiros/fotografos/aviso-fotografo";
import { mostrarParceiroGeral, rotuloCategoria, type ParceiroGeral } from "@/lib/parceiros/regras";
import { MUNICIPIOS, UFS } from "@/lib/municipios";
import { ufUnicaDaCidade, ufsDaCidade } from "@/lib/parceiros/indicacao";
import { IndicarProfissional } from "@/components/parceiros/indicar-profissional";

/**
 * Busca sem parceiro (Prompt 31a, item 6): avise-me (qualquer categoria), "Indique um profissional" e, se a equipe
 * ligar a chave PARCEIRO_GERAL_FALLBACK, o cartão do parceiro geral (sem logo de terceiros).
 * E277 (mockup aprovado): um cartão só, com a foto da categoria ao lado (em cima no celular), reunindo o aviso
 * ("Quero ser avisado") e o "Indique um profissional". Os dois continuam funcionando como antes.
 * E285 (folha aprovada, Tela 2): os dois lado a lado, e o "Quero ser avisado" aparece SEMPRE — sem cidade na busca,
 * ele pede a cidade (ou o CEP) no formulário acima, já que o aviso é gravado por cidade.
 */
export function BuscaVazia({
  categoria,
  cidade,
  uf,
  logado,
  voltarPara,
  autoAvisar,
  geral,
}: {
  categoria: string;
  cidade: string;
  uf: string;
  logado: boolean;
  voltarPara: string;
  autoAvisar: boolean;
  geral: ParceiroGeral;
}) {
  // Sem categoria ("Todas"): a foto de manutenção (caixa de ferramentas), a mais geral das seis.
  const foto = fotoDaCategoria(categoria) ?? fotoDaCategoria("manutencao");
  // E304 (QA 31/10): cidade digitada sem a UF deixava o "Quero ser avisado" desligado. Com o nome único no Brasil, a UF
  // vem da lista do IBGE; ambígua (ex.: "Bom Jesus"), o aviso continua pedindo a UF.
  const ufEfetiva = uf || (cidade ? ufUnicaDaCidade(cidade, MUNICIPIOS)?.uf ?? "" : "");
  // E304 (vigia 31/10): o "Quero ser avisado" fica ligado com cidade OU categoria. Cidade ambígua: escolhe-se o estado
  // no cartão (só os estados que têm essa cidade; nome fora da lista: todos). Só categoria: cidade e estado no cartão.
  const opcoesUf = ufEfetiva ? undefined : cidade ? (ufsDaCidade(cidade, MUNICIPIOS).length ? ufsDaCidade(cidade, MUNICIPIOS) : UFS) : UFS;
  return (
    <div className="mt-4 space-y-4" data-testid="busca-parceiros-vazia">
      <div className="grid overflow-hidden rounded-xl border border-line bg-white md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {foto && (
          <div className="relative aspect-[16/10] bg-surface-2 md:aspect-auto md:min-h-full" data-testid="busca-parceiros-vazia-foto">
            <Image src={foto.src} alt={foto.alt} fill sizes="(min-width: 768px) 40vw, 100vw" placeholder="blur" blurDataURL={BRAND_BLUR} className="object-cover" />
          </div>
        )}
        <div className="space-y-4 p-4 sm:p-6">
          {/* Uma frase = um texto só: em pedaços, leitores que aparam cada pedaço colavam as palavras (QA 22/10). */}
          <p className="font-title text-lg font-semibold text-ink" data-testid="busca-parceiros-vazia-texto">
            {`Ainda não temos parceiro${categoria ? ` de ${rotuloCategoria(categoria).toLowerCase()}` : ""}${cidade ? ` em ${cidade}` : " nesta busca"}.`}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <AvisoFotografo
              cidade={cidade}
              uf={ufEfetiva}
              logado={logado}
              voltarPara={voltarPara}
              autoAvisar={autoAvisar}
              categoria={categoria || "outro"}
              ladoALado
              opcoesUf={opcoesUf}
              pedirCidade={!cidade}
            />
            <div className="h-full rounded-xl border border-line bg-white p-4" data-testid="indique-profissional">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <UserPlus className="h-5 w-5 shrink-0 text-forest" aria-hidden /> Indique um profissional
              </p>
              <p className="mt-1 text-sm text-muted">Conhece alguém bom que atende aí? Mande o link: o pedido de parceria é feito pela própria pessoa, com a conta dela.</p>
              <IndicarProfissional categoria={categoria} />
            </div>
          </div>
        </div>
      </div>
      {mostrarParceiroGeral(geral, 0) && (
        <div className="rounded-xl border border-sage-200 bg-sage-50 p-4" data-testid="parceiro-geral">
          <p className="text-xs font-semibold text-forest">Parceiro geral da Viva</p>
          <p className="mt-1 font-title text-lg font-semibold text-ink">{geral.nome}</p>
          {geral.cidade && <p className="text-sm text-muted">{geral.cidade}</p>}
          {geral.descricao && <p className="mt-2 text-sm text-ink">{geral.descricao}</p>}
          <ButtonLink href="/ajuda" variant="secondary" size="sm" className="mt-3">
            Pedir pela Central de Ajuda
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
