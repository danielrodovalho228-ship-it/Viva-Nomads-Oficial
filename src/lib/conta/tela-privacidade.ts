/*
  A5 — Conta › Privacidade (mockup perfil-05): as três chaves, o rodapé e as regras puras de "Baixar meus dados".
  As chaves GRAVAM a preferência da pessoa (dados da conta, sem migração). O efeito de cada uma no produto depende de
  regra que ainda não existe (quem deixa de ver o quê) e fica para a decisão do Daniel; nada aqui esconde perfil,
  tira de busca nem desliga medição.
*/
export type ChavePrivacidade = "mostrar_perfil" | "aparecer_busca" | "dados_uso";
export type Privacidade = Record<ChavePrivacidade, boolean>;

export const CHAVES_PRIVACIDADE: readonly { chave: ChavePrivacidade; titulo: string; texto: string; padrao: boolean }[] = [
  { chave: "mostrar_perfil", titulo: "Mostrar meu perfil para proprietários", texto: "Outros proprietários poderão ver seu perfil ao receber uma solicitação", padrao: true },
  { chave: "aparecer_busca", titulo: "Aparecer nas buscas da Viva", texto: "Seu perfil poderá ser exibido nos resultados de busca da plataforma", padrao: true },
  { chave: "dados_uso", titulo: "Compartilhar dados de uso para melhorar o app", texto: "Envia dados anônimos de uso para aprimorar recursos e performance", padrao: false },
];

export const RODAPE_PRIVACIDADE = "Você pode alterar essas permissões a qualquer momento nas configurações.";

/** Sem preferência gravada = o padrão do desenho (ligado, ligado, desligado). */
export function normalizarPrivacidade(b: unknown): Privacidade {
  const o = (b && typeof b === "object" ? b : {}) as Partial<Record<ChavePrivacidade, unknown>>;
  return Object.fromEntries(CHAVES_PRIVACIDADE.map((c) => [c.chave, typeof o[c.chave] === "boolean" ? o[c.chave] : c.padrao])) as Privacidade;
}

/** Colunas que nunca saem no arquivo, mesmo sendo da própria pessoa: credenciais e chaves técnicas. */
const SENSIVEL = /token|secret|segredo|hash|senha|password|chave_api|api_key/i;

/** Uma linha do banco pronta para o arquivo: sem as colunas sensíveis. */
export function limparLinha<T extends Record<string, unknown>>(linha: T | null | undefined): Record<string, unknown> | null {
  if (!linha) return null;
  return Object.fromEntries(Object.entries(linha).filter(([k]) => !SENSIVEL.test(k)));
}

export const NOME_ARQUIVO_DADOS = "meus-dados-viva-nomads.json";

/*
  Colunas de cada tabela no arquivo. Lista explícita: contratos, leads e avaliações têm grant por coluna (taxa, notas
  privadas e motivos da equipe ficam fora) e select("*") quebraria; aqui também saem faixa, plano e tipo de cobrança.
*/
export const COLUNAS_EXPORT_CONTRATOS =
  "id, property_id, tenant_id, lead_id, status, periodo, prazo_total_dias, tamanho_bloco_meses, aluguel_mensal, garantia, qtd_ocupantes, assinado_proprietario_em, assinado_inquilino_em, encerrado_em, created_at";
export const COLUNAS_EXPORT_LEADS = "id, property_id, status, contact_unlocked, accepted_at, rejected_at, created_at";
export const COLUNAS_EXPORT_AVALIACOES =
  "id, contrato_id, imovel_id, papel_autor, nota_geral, notas_categorias, comentario_publico, recomendaria, etiquetas, status, enviada_em, publicada_em";
