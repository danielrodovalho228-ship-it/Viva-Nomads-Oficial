/**
 * Feature flags de UI (mesmo padrão de CAUCAO_PARCELADA_UI em faixas.ts).
 * Todas OFF por padrão — ligam com NEXT_PUBLIC_<FLAG>="on" na Vercel.
 */

/** Programa de indicação: item de menu só aparece quando o programa existir. */
export const PROGRAMA_INDICACAO = process.env.NEXT_PUBLIC_PROGRAMA_INDICACAO === "on";

/**
 * Selo "Emite Nota Fiscal" na UI pública. OFF por padrão: proprietário PF emite
 * recibo, não NF — o selo como está promete errado. O dado continua no banco; a
 * definição correta (recibo / NF só para PJ) sai depois com o jurídico.
 */
export const SELO_NF_UI = process.env.NEXT_PUBLIC_SELO_NF_UI === "on";

/**
 * NFS-e da Viva (só do que ela vende: assinatura e comissão, para o
 * proprietário). OFF até existir CNPJ e a emissão pelo Asaas (PR F2). Com OFF,
 * as telas dizem "emitida após a abertura do CNPJ" — nunca prometem o que ainda
 * não sai.
 */
export const NFSE_ATIVA = process.env.NEXT_PUBLIC_NFSE_ATIVA === "on";

/**
 * Piloto "Fundador": banner em /precos com assinatura gratuita por 12 meses aos
 * 20 primeiros proprietários (recursos do Profissional), comissão de fechamento
 * do Profissional (4%, lib/fundador.ts) e 20% de desconto vitalício quando a cobrança começar. Nenhuma
 * cobrança de assinatura é ativada no piloto.
 */
export const PLANO_FUNDADOR = process.env.NEXT_PUBLIC_PLANO_FUNDADOR === "on";

/**
 * Portão do KYC no Fechamento. OFF por padrão = portão SUAVE (reteste QA item 2):
 * enquanto a verificação (CAF) não está integrada, a conta real avança o
 * fechamento com status "Verificação pendente" (registrado e visível ao
 * proprietário no resumo), em vez de travar. Ligue com
 * NEXT_PUBLIC_KYC_PORTAO_RIGIDO="on" quando a CAF integrar — aí a conta real só
 * avança com verificação concluída (o modo demonstração sempre avança, com selo
 * de exemplo).
 */
export const KYC_PORTAO_RIGIDO = process.env.NEXT_PUBLIC_KYC_PORTAO_RIGIDO === "on";

/**
 * Geração por IA de título/descrição do anúncio. OFF por padrão até o provedor
 * ser habilitado. Implementação real (não mais mock): rota de servidor
 * `/api/ai/anuncio` chama a API da Anthropic (Claude) — a chave (ANTHROPIC_API_KEY)
 * vive SÓ no servidor, nunca no cliente. Só campos seguros do imóvel vão ao
 * modelo (sem endereço exato/contato/PII), com rate-limit de 10/dia e trilha de
 * auditoria (migration 0045). Coberto na Política de Privacidade (seção 5).
 *
 * Para LIGAR em produção: definir ANTHROPIC_API_KEY (server) e
 * NEXT_PUBLIC_GERACAO_IA="on". A rota exige as DUAS coisas; sem a chave ou a
 * flag, responde 503 sem chamar o provedor.
 */
export const GERACAO_IA_ATIVA = process.env.NEXT_PUBLIC_GERACAO_IA === "on";


/**
 * Login com Google. OFF por padrão: o provedor Google NÃO está ativado no
 * Supabase (Auth → Providers) — com o botão visível, quem clicava caía num JSON
 * de erro ("Unsupported provider"). Para LIGAR: ativar o provedor no Supabase
 * (passo a passo em docs/auth/LOGIN-GOOGLE.md) e definir
 * NEXT_PUBLIC_LOGIN_GOOGLE_ATIVO="on". Vale para o site e para os apps (que
 * abrem o site).
 */
export const LOGIN_GOOGLE_ATIVO = process.env.NEXT_PUBLIC_LOGIN_GOOGLE_ATIVO === "on";

/**
 * "Continuar com a Apple" (exigência da Apple quando há Google no iPhone). OFF por padrão: só liga
 * com o provedor Apple ativado no Supabase e NEXT_PUBLIC_LOGIN_APPLE_ATIVO="on" (docs/auth/LOGIN-APPLE.md).
 */
export const LOGIN_APPLE_ATIVO = process.env.NEXT_PUBLIC_LOGIN_APPLE_ATIVO === "on";

/**
 * Pré-lançamento (lançamento oficial em 2027). LIGADO por padrão — o site está
 * em pré-lançamento; desliga com NEXT_PUBLIC_PRE_LANCAMENTO="off" no dia do
 * lançamento. Mostra o aviso nas páginas públicas (e trava a assinatura paga).
 */
export const PRE_LANCAMENTO = process.env.NEXT_PUBLIC_PRE_LANCAMENTO !== "off";

/**
 * Pagamento de parceiros pela plataforma (Prompt 31b). OFF por padrão: o morador paga direto ao prestador. Liga com
 * NEXT_PUBLIC_PAGAMENTO_PARCEIROS_ATIVO="on" quando o pagamento pela plataforma existir; a nota do catálogo de
 * serviços troca de texto pela chave (servicos-morador.ts, notaPagamentoServicos).
 */
export const PAGAMENTO_PARCEIROS_ATIVO = process.env.NEXT_PUBLIC_PAGAMENTO_PARCEIROS_ATIVO === "on";

/**
 * Regras de encerramento de contrato (Prompt 32, item 7). OFF por padrão: "Encerrar contrato" registra o pedido para
 * as duas partes e o admin, sem calcular multa nem devolução (a Viva conduz). Liga com
 * NEXT_PUBLIC_ENCERRAMENTO_REGRAS_ATIVO="on" depois do parecer jurídico; o cálculo entra em
 * src/lib/estadia/encerramento.ts (consequenciasDoEncerramento).
 */
export const ENCERRAMENTO_REGRAS_ATIVO = process.env.NEXT_PUBLIC_ENCERRAMENTO_REGRAS_ATIVO === "on";

/**
 * Avaliação do imóvel por avaliador credenciado (Prompt 62-B1). OFF por padrão: desligada, nada aparece para o dono nem
 * para o morador; o credenciamento dos avaliadores e o /admin/avaliadores funcionam (para montar a rede antes do
 * lançamento). Só liga com as 3 condições que o admin mostra: tabela de preço na cidade, 2+ avaliadores ativos e o parecer
 * do item 14 da Dra. Beatriz (NEXT_PUBLIC_VISTORIA_PARECER_14="on" quando recebido).
 */
export const VISTORIA_ATIVA = process.env.NEXT_PUBLIC_VISTORIA_ATIVA === "on";
export const VISTORIA_PARECER_14 = process.env.NEXT_PUBLIC_VISTORIA_PARECER_14 === "on";

/**
 * 63-B — "Conectar LinkedIn" (selo de confiança). OFF até o Daniel colar LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET na
 * Vercel. Desligada, a Conta não mostra o Conectar e nenhum selo aparece. No laboratório o teste liga só no próprio
 * navegador (cookie, ver src/lib/linkedin/chave.ts).
 */
export const LINKEDIN_CONECTAR_ATIVO = process.env.NEXT_PUBLIC_LINKEDIN_CONECTAR_ATIVO === "on";

/**
 * 63-B (decisão do Daniel, 23/10) — Instagram/Facebook/TikTok da própria pessoa. OFF: os campos não aparecem. Mesmo
 * ligada, as redes de pessoas NUNCA aparecem para outro usuário (só a própria pessoa e a equipe).
 */
export const REDES_USUARIO_ATIVO = process.env.NEXT_PUBLIC_REDES_USUARIO_ATIVO === "on";

/**
 * Prompt 52 — triagem do morador (comprovante de vínculo + selo "Morador verificado" para o dono). OFF até o parecer do
 * item 13 da Dra. Beatriz (texto de coleta, finalidade e prazo de guarda dos dados de vínculo/renda). Desligada, nenhuma
 * tela nova aparece: nem o envio do morador, nem a fila do admin, nem o selo. Reteste: ligar SÓ no Preview da Vercel
 * (NEXT_PUBLIC_TRIAGEM_VINCULO_ATIVA="on"). No laboratório o teste liga no próprio navegador (src/lib/triagem/chave.ts).
 */
export const TRIAGEM_VINCULO_ATIVA = process.env.NEXT_PUBLIC_TRIAGEM_VINCULO_ATIVA === "on";

/**
 * DETECTA-B — sugestões a partir das fotos da galeria (itens de Conforto/Premium e comodidades dos filtros). OFF até o
 * Daniel ver o custo no PR. Desligada, nada é enviado ao modelo e a tela fica como hoje. Só o servidor lê a chave
 * (DETECCAO_FOTOS_ATIVO="on"); usa a ANTHROPIC_API_KEY que já está em produção. No laboratório o teste liga só no
 * próprio navegador (cookie, ver src/lib/fotos/deteccao-chave.ts).
 */
export const DETECCAO_FOTOS_ATIVO = process.env.DETECCAO_FOTOS_ATIVO === "on";
