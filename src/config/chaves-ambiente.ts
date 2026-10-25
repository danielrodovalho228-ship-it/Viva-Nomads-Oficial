/*
  ADMIN-3 — as chaves de AMBIENTE (src/lib/flags.ts) com rótulo humano, para a lista SÓ DE LEITURA de /admin/sistema.
  Cada uma muda na Vercel (Daniel); a tela não tem botão. Só o estado ligada/desligada aparece — nunca o valor de um
  segredo. O teste confere que toda exportação de flags.ts está aqui. PURO.
*/
export interface ChaveAmbiente {
  /** Nome da exportação em src/lib/flags.ts. */
  nome: string;
  rotulo: string;
  /** Variável da Vercel que liga a chave. */
  variavel: string;
}

export const CHAVES_AMBIENTE: readonly ChaveAmbiente[] = [
  { nome: "PRE_LANCAMENTO", rotulo: "Pré-lançamento (aviso de 2027 e assinatura travada)", variavel: "NEXT_PUBLIC_PRE_LANCAMENTO" },
  { nome: "PROGRAMA_INDICACAO", rotulo: "Programa de indicação", variavel: "NEXT_PUBLIC_PROGRAMA_INDICACAO" },
  { nome: "SELO_NF_UI", rotulo: "Selo \"Emite Nota Fiscal\" nos anúncios", variavel: "NEXT_PUBLIC_SELO_NF_UI" },
  { nome: "NFSE_ATIVA", rotulo: "Nota fiscal de serviço da Viva", variavel: "NEXT_PUBLIC_NFSE_ATIVA" },
  { nome: "PLANO_FUNDADOR", rotulo: "Plano Fundador em /precos", variavel: "NEXT_PUBLIC_PLANO_FUNDADOR" },
  { nome: "KYC_PORTAO_RIGIDO", rotulo: "Verificação obrigatória no Fechamento", variavel: "NEXT_PUBLIC_KYC_PORTAO_RIGIDO" },
  { nome: "GERACAO_IA_ATIVA", rotulo: "Título e descrição do anúncio por IA", variavel: "NEXT_PUBLIC_GERACAO_IA" },
  { nome: "LOGIN_GOOGLE_ATIVO", rotulo: "Entrar com Google", variavel: "NEXT_PUBLIC_LOGIN_GOOGLE_ATIVO" },
  { nome: "LOGIN_APPLE_ATIVO", rotulo: "Continuar com a Apple", variavel: "NEXT_PUBLIC_LOGIN_APPLE_ATIVO" },
  { nome: "PAGAMENTO_PARCEIROS_ATIVO", rotulo: "Pagamento de parceiros pela plataforma", variavel: "NEXT_PUBLIC_PAGAMENTO_PARCEIROS_ATIVO" },
  { nome: "ENCERRAMENTO_REGRAS_ATIVO", rotulo: "Regras de encerramento de contrato", variavel: "NEXT_PUBLIC_ENCERRAMENTO_REGRAS_ATIVO" },
  { nome: "VISTORIA_ATIVA", rotulo: "Avaliação do imóvel por avaliador credenciado", variavel: "NEXT_PUBLIC_VISTORIA_ATIVA" },
  { nome: "VISTORIA_PARECER_14", rotulo: "Parecer jurídico do item 14 (avaliação do imóvel)", variavel: "NEXT_PUBLIC_VISTORIA_PARECER_14" },
  { nome: "LINKEDIN_CONECTAR_ATIVO", rotulo: "Conectar LinkedIn (selo de confiança)", variavel: "NEXT_PUBLIC_LINKEDIN_CONECTAR_ATIVO" },
  { nome: "REDES_USUARIO_ATIVO", rotulo: "Redes sociais da própria pessoa", variavel: "NEXT_PUBLIC_REDES_USUARIO_ATIVO" },
  { nome: "TRIAGEM_VINCULO_ATIVA", rotulo: "Triagem do morador (comprovante de vínculo)", variavel: "NEXT_PUBLIC_TRIAGEM_VINCULO_ATIVA" },
  { nome: "DETECCAO_FOTOS_ATIVO", rotulo: "Sugestões a partir das fotos do anúncio", variavel: "DETECCAO_FOTOS_ATIVO" },
];

export const ONDE_MUDA_AMBIENTE = "Muda na Vercel (Daniel)";

/** As chaves da PLATAFORMA (tabela chaves_plataforma): mudam aqui, com confirmação. */
export const CHAVES_PLATAFORMA = [
  { chave: "SMS_ATIVO", rotulo: "Telefone confirmado nos pedidos de moradia (SMS)" },
  { chave: "PARCEIRO_GERAL_FALLBACK", rotulo: "Cartão do parceiro geral na busca vazia" },
] as const;

export const HREF_SISTEMA = "/admin/sistema";
