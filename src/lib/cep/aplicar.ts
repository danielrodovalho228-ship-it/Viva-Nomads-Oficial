import type { ResultadoCep } from "./buscar";

/*
  Prompt 22 (QA do Muse, 18/10): o CEP 38408-000 virava "Avenida das Torres, Sarandi/PR". O endereço não existe no
  nosso código: era o PREENCHIMENTO AUTOMÁTICO do navegador (endereço salvo no Chrome), que chegava antes do ViaCEP,
  somado à regra antiga "o CEP só preenche campo vazio". Regra nova: o resultado do CEP SUBSTITUI tudo o que a pessoa
  não DIGITOU com as próprias mãos — valor do autofill, valor antigo ou da matrícula não contam como digitado.
*/

export type CampoEndereco = "rua" | "bairro" | "cidade";

/**
 * O evento de mudança veio da pessoa? Digitar, colar, apagar e escolher na lista geram um InputEvent com `inputType`;
 * o preenchimento automático do Chrome dispara um "input" comum, sem `inputType`.
 */
export function digitadoPelaPessoa(ev: unknown): boolean {
  if (!ev || typeof ev !== "object" || !("inputType" in ev)) return false;
  const t = (ev as { inputType?: unknown }).inputType;
  return typeof t === "string" && t.length > 0;
}

export interface EnderecoAtual {
  rua: string;
  bairro: string;
  cidade: string;
}

export interface AplicacaoCep {
  rua?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  /** Bairro que a pessoa DIGITOU é diferente do bairro do CEP: pergunta qual vale (não troca sozinho). */
  perguntarBairro?: string;
}

/** O que o resultado do CEP muda no formulário (só substitui o que não foi digitado; vazio sempre recebe). */
export function aplicarResultadoCep(r: ResultadoCep, atual: EnderecoAtual, digitados: ReadonlySet<CampoEndereco>): AplicacaoCep {
  if (r.tipo !== "rua" && r.tipo !== "cidade") return {};
  const pode = (c: CampoEndereco, valor: string) => !digitados.has(c) || !valor.trim();
  const out: AplicacaoCep = {};
  if (r.uf) out.uf = r.uf.slice(0, 2);
  if (pode("cidade", atual.cidade)) out.cidade = r.cidade;
  if (r.tipo === "rua") {
    if (pode("rua", atual.rua)) out.rua = r.rua;
    if (r.bairro) {
      if (pode("bairro", atual.bairro)) out.bairro = r.bairro;
      else if (atual.bairro.trim().toLowerCase() !== r.bairro.trim().toLowerCase()) out.perguntarBairro = r.bairro;
    }
  } else if (!digitados.has("rua")) {
    // CEP da cidade toda: a rua que veio de outro lugar (autofill, endereço antigo) não vale para este CEP.
    out.rua = "";
  }
  return out;
}
