/*
  Prazos de guarda dos documentos por prefixo (Prompt 56, item 7) — constante ÚNICA.
  Todo prazo está "pendente – item 13 da Dra. Beatriz", menos a lista da portaria (90 dias depois do fim do contrato,
  Prompt 32). Nenhuma rotina apaga documento com prazo pendente: podeApagarDocumento() responde false para ele.
*/
import type { Prefixo } from "../lib/fiscal/prefixos.ts";

export const PENDENTE_ITEM_13 = "pendente – item 13 da Dra. Beatriz";

export interface PrazoRetencao {
  /** Dias de guarda depois do fim do contrato/pedido; null enquanto o prazo estiver pendente. */
  dias: number | null;
  situacao: typeof PENDENTE_ITEM_13 | "definido";
  origem?: string;
}

const pendente: PrazoRetencao = { dias: null, situacao: PENDENTE_ITEM_13 };

export const RETENCAO_DOCUMENTOS: Record<Prefixo, PrazoRetencao> = {
  ORC: pendente,
  "VN-CT": pendente,
  "VN-SV": pendente,
  REC: pendente,
  CAU: pendente,
  DEV: pendente,
  PRV: pendente,
  CND: pendente,
  PRT: { dias: 90, situacao: "definido", origem: "Prompt 32 (ocupantes da lista da portaria)" },
  ENC: pendente,
  INF: pendente,
  RPG: pendente,
  RSV: pendente,
  REG: pendente,
  NFSE: pendente,
  VIS: pendente,
};

/** Só um prazo definido permite apagar — e só depois de vencido. Prazo pendente: nunca. */
export function podeApagarDocumento(prefixo: Prefixo, diasDesdeOFim: number): boolean {
  const r = RETENCAO_DOCUMENTOS[prefixo];
  return r.situacao === "definido" && r.dias !== null && diasDesdeOFim > r.dias;
}

/* ── Inventário de dados pessoais (Prompt 58) ──────────────────────────────────────────────────────────────────────
  Fonte ÚNICA: toda tabela com coluna de dado pessoal e todo bucket privado aparecem aqui, com finalidade, prazo,
  gatilho e modo. A guarda (src/lib/minimizacao/inventario.test.ts) lê as migrações e falha se faltar algum.
  † = prazo proposto pela Viva (fase 1, aprovado pelo Daniel em 22/10). "pendente" = depende do item 13 da
  Dra. Beatriz: só entra no relatório simulado, nunca é apagado de verdade nesta fase.
*/
import type { ItemInventario } from "../lib/minimizacao/regras.ts";

type Base = Omit<ItemInventario, "id" | "origem" | "dado" | "finalidade">;
const CONTA: Base = { prazoDias: null, gatilho: "exclusao_conta", modo: "anonimizar", base: "pendente", fase: 2 };
const ESTADIA: Base = { prazoDias: null, gatilho: "fim_estadia", modo: "apagar", base: "pendente", fase: 2 };
const DISPUTA: Base = { prazoDias: null, gatilho: "fim_janela_disputa", modo: "apagar", base: "pendente", fase: 2 };
const FISCAL: Base = { prazoDias: null, gatilho: "fim_estadia", modo: "apagar", base: "pendente", fase: 2 };
const VERED_30: Base = { prazoDias: 30, gatilho: "decisao_admin", modo: "apagar", base: "proposta", fase: 1 };
const i = (id: string, origem: string, dado: string, finalidade: string, b: Base, fica?: string): ItemInventario => ({ id, origem, dado, finalidade, ...b, ...(fica ? { fica } : {}) });

export const INVENTARIO: ItemInventario[] = [
  // ── Fase 1, modo REAL (não depende de prazo jurídico) ──
  i("inquilino-docs/recusado", "bucket:inquilino-docs", "documento de identidade, renda e vínculo da candidatura recusada", "o dono decidir a candidatura", { ...VERED_30, gatilho: "recusa_dono" }, "veredito do lead (recusado, data, quem decidiu) + tipo e data de envio"),
  i("qualificacao/documento", "bucket:property-docs", "documento do imóvel enviado em /qualificar", "a equipe conferir o vínculo nome↔imóvel", VERED_30, "veredito (status, motivo, data, quem decidiu) + referência"),
  i("matricula/arquivo", "bucket:property-docs", "matrícula e documento do caso especial (conferência de titularidade)", "a equipe conferir a titularidade", VERED_30, "veredito (resultado, motivo, data, quem decidiu) + campos conferidos"),
  // ── Fase 2 / pendente (só relatório simulado) ──
  i("inquilino-docs/aceito", "bucket:inquilino-docs", "documento da candidatura aceita", "base do contrato", ESTADIA),
  i("documentos_inquilino", "public.documentos_inquilino", "caminho e hash do documento da candidatura", "ligar o arquivo à candidatura", ESTADIA, "tipo, data de envio e o veredito"),
  i("profiles", "public.profiles", "nome, e-mail, telefone, CPF/CNPJ, bio, cidade, foto, local de trabalho", "a conta", CONTA),
  i("avatars", "bucket:avatars", "foto de perfil", "mostrar quem é a pessoa", CONTA),
  i("tenant_verifications", "public.tenant_verifications", "veredito da identidade (CAF: semáforo, confere nome/CPF)", "confiança", CONTA, "só o veredito; a Viva não grava imagem de documento nem selfie"),
  i("messages", "public.messages", "mensagens do chat", "conversa entre as partes", DISPUTA),
  i("service_order_messages", "public.service_order_messages", "mensagens de ordem de serviço", "conversa do serviço", DISPUTA),
  i("conferencia", "bucket:conferencia", "fotos e laudo da conferência de entrada e saída", "prova da conferência", DISPUTA),
  i("conferencia_itens", "public.conferencia_itens", "descrição e caminho da foto da conferência", "prova da conferência", DISPUTA),
  i("conferencia_conforto", "public.conferencia_conforto", "resposta do morador ao padrão mínimo (texto e foto)", "prova da conferência de entrada (59)", DISPUTA),
  // Prompt 62-B1: avaliação do imóvel por avaliador credenciado. Contas is_teste ficam fora das métricas e do rodízio real.
  i("avaliadores_credenciamento", "public.avaliadores_credenciamento", "número de credenciado, cidade, motivo das decisões, relações declaradas (donos e imóveis) e link do portfólio", "credenciar o avaliador e impedir avaliação com vínculo", CONTA, "o número de credenciado e as avaliações feitas (contagem)"),
  i("avaliadores", "bucket:avaliadores", "portfólio ou referência enviada no credenciamento", "a Viva conferir a experiência do avaliador", CONTA),
  i("vistoria_pedidos", "public.vistoria_pedidos", "pedido de avaliação (imóvel, dono, morador do imóvel ocupado, agenda, concordância, registro de pagamento direto)", "designar, agendar e registrar a avaliação", DISPUTA),
  i("vistoria_conduta", "public.vistoria_conduta", "notas e comentário de conduta (dono → avaliador; avaliador → acesso)", "nota de conduta pública do avaliador", CONTA, "a média de conduta do avaliador"),
  i("vistoria_auditoria", "public.vistoria_auditoria", "revisão interna do laudo e o motivo", "auditar os avaliadores (fração interna)", DISPUTA),
  i("vistoria_fila_admin", "public.vistoria_fila_admin", "pendências da equipe (sem avaliador, suspensão, proposta de descredenciamento) com motivo", "operação da rede de avaliadores", DISPUTA),
  // Prompt 50: a data em que cada papel ativou (some com a conta) e a análise humana da verificação (motivo e decisão).
  // 63-B: selo "LinkedIn conectado" — só o hash do identificador do LinkedIn, a data e a validade (12 meses); nada do
  // perfil. Vale enquanto conectado; desconectar apaga a linha, e excluir a conta apaga junto.
  i("confianca_linkedin", "public.confianca_linkedin", "hash do identificador do LinkedIn, data da conexão e validade (sem nome, link nem foto)", "selo de confiança \"LinkedIn conectado\" (63-B)", CONTA, "nada: desconectar apaga a linha"),
  // 63-B (decisão do Daniel, 23/10): redes da própria pessoa, PRIVADAS (só ela e a equipe), atrás de REDES_USUARIO_ATIVO.
  i("perfil_redes", "public.perfil_redes", "endereços do Instagram, Facebook e TikTok da própria pessoa (privados)", "a pessoa guardar as próprias redes; nunca aparecem para outro usuário", CONTA),
  i("ativacoes", "public.ativacoes", "data em que cada papel da pessoa ativou (morador, proprietário, parceiro)", "checklist de ativação e funil (Prompt 50)", CONTA),
  i("verificacao_revisoes", "public.verificacao_revisoes", "motivo da reprovação automática, decisão e observação da equipe", "análise humana da verificação de identidade (Prompt 50)", CONTA, "o laudo da revisão em tenant_verifications"),
  // Prompt 62-B2: execução da avaliação. Fotos e laudo ficam enquanto o laudo vale + a janela de disputa (prazo pendente,
  // item 13: até lá nada é apagado). dB(A) e prova de local da internet são só internos. Strikes saem aos 12 meses.
  i("vistoria_checklist", "public.vistoria_checklist", "respostas do checklist e observação do avaliador", "laudo de avaliação do imóvel (62-B2)", DISPUTA),
  i("vistoria_checklist_fotos", "public.vistoria_checklist_fotos", "caminho das fotos da avaliação (1 por cômodo + 1 por item não conforme)", "laudo de avaliação do imóvel (62-B2)", DISPUTA),
  i("avaliacao-imovel", "bucket:avaliacao-imovel", "fotos da avaliação do imóvel (sem pessoas, sem pertences, sem EXIF)", "laudo de avaliação do imóvel (62-B2)", DISPUTA),
  i("vistoria_medicoes", "public.vistoria_medicoes", "dB(A) com data e hora e medição de internet com prova de local (distância em metros, sem coordenadas) — só internos", "apoio interno do laudo (nunca publicado)", DISPUTA),
  i("vistoria_laudos", "public.vistoria_laudos", "resultado, nível sustentado, resumo e motivo da contestação", "laudo de avaliação do imóvel e \"· vistoriado\" (62-B2)", DISPUTA, "o registro VIS (número, versão, hash) em documentos_registro"),
  i("proprietario_strikes", "public.proprietario_strikes", "registro de verificação reprovada ou ressalva vencida do proprietário", "escada de strikes (59.1 item 7)", { prazoDias: 365, gatilho: "sem_gatilho_automatico", modo: "apagar", base: "proposta", fase: 2 }, "nada (apagado aos 12 meses pelo cron da avaliação)"),
  i("vistoria_devolucoes", "public.vistoria_devolucoes", "valor a devolver ao dono e a confirmação do recebimento", "\"quem perde paga\" na contestação", DISPUTA),
  i("vistoria_bloqueios", "public.vistoria_bloqueios", "anúncio fora da busca ou republicação só com laudo, com o motivo", "segurança grave e escada de strikes", DISPUTA),
  i("conforto_pendencias", "public.conforto_pendencias", "texto do morador e motivo da contestação", "pendência do padrão mínimo (59)", DISPUTA),
  i("conferencia_laudos", "public.conferencia_laudos", "caminho do laudo", "prova da conferência", DISPUTA),
  i("conferencia_respostas", "public.conferencia_respostas", "motivo da contestação", "prova da conferência", DISPUTA),
  i("conferencia_correcoes", "public.conferencia_correcoes", "texto da correção", "prova da conferência", DISPUTA),
  i("vistoria_fotos", "public.vistoria_fotos", "fotos da vistoria (antiga)", "prova da vistoria", DISPUTA),
  i("vistoria-fotos", "bucket:vistoria-fotos", "fotos da vistoria (antiga)", "prova da vistoria", DISPUTA),
  i("vistoria_itens", "public.vistoria_itens", "observação da vistoria", "prova da vistoria", DISPUTA),
  i("contrato_ocupantes", "public.contrato_ocupantes", "nome e documento dos ocupantes", "lista da portaria", { prazoDias: 90, gatilho: "fim_estadia", modo: "apagar", base: "legal", fase: 2 }, "nada (já apagado pelo cron do Prompt 32)"),
  i("respostas_rapidas", "public.respostas_rapidas", "título e texto das respostas salvas do dono (sem contato: o filtro bloqueia)", "responder nas conversas com 1 toque (55-E2)", CONTA),
  i("mensagens_programadas", "public.mensagens_programadas", "texto das mensagens programadas do dono por estadia (sem contato: o filtro bloqueia)", "enviar na conversa da estadia no horário marcado (55-E2)", { prazoDias: null, gatilho: "fim_estadia", modo: "apagar", base: "pendente", fase: 2 }, "a mensagem enviada continua em messages (mesma regra da conversa)"),
  i("estadia_convidados", "public.estadia_convidados", "e-mail de quem vai morar junto", "acesso só leitura à estadia (61-B)", { prazoDias: 30, gatilho: "fim_estadia", modo: "apagar", base: "proposta", fase: 2 }, "nada (apagado pelo cron da estadia)"),
  i("push_adiados", "public.push_adiados", "título e texto genérico do push adiado pelo silêncio", "entregar às 7h o aviso que caiu entre 22h e 7h (44)", { prazoDias: 1, gatilho: "sinal_processado", modo: "apagar", base: "proposta", fase: 2 }, "nada (apagado ao enviar)"),
  i("contrato_assinaturas", "public.contrato_assinaturas", "IP e hash da assinatura", "prova da assinatura", FISCAL),
  i("contrato_aditivo_assinaturas", "public.contrato_aditivo_assinaturas", "IP e hash da assinatura do aditivo", "prova da assinatura", FISCAL),
  i("contrato_notas", "public.contrato_notas", "notas do contrato", "registro da estadia", ESTADIA),
  i("contrato_encerramento_pedidos", "public.contrato_encerramento_pedidos", "motivo e texto do encerramento", "registro da estadia", ESTADIA),
  i("documentos_fiscais", "public.documentos_fiscais", "nome, documento e endereço das partes; PDF", "obrigação fiscal", FISCAL),
  i("documentos", "bucket:documentos", "PDFs de recibos e documentos fiscais", "obrigação fiscal", FISCAL),
  i("documentos_registro", "public.documentos_registro", "caminho do arquivo do documento registrado", "conferência pública do documento (56)", FISCAL),
  i("documents", "public.documents", "nome e contato do inquilino (legado)", "documentos antigos", FISCAL),
  i("leads", "public.leads", "motivo da recusa e dados da candidatura", "decidir a candidatura", ESTADIA, "veredito (aceito/recusado, data, quem decidiu)"),
  i("pedidos_moradia", "public.pedidos_moradia", "apresentação, motivo e destino (lat/lng arredondados)", "pedido de moradia", CONTA),
  i("respostas_pedido", "public.respostas_pedido", "mensagem da resposta", "pedido de moradia", CONTA),
  i("propostas", "public.propostas", "texto da recusa", "proposta", CONTA),
  i("proposta_versoes", "public.proposta_versoes", "mensagem da proposta", "proposta", CONTA),
  i("avaliacoes", "public.avaliacoes", "comentários", "avaliação pública", CONTA),
  i("avaliacao_respostas", "public.avaliacao_respostas", "resposta do dono", "avaliação pública", CONTA),
  i("avaliacao_contestacoes", "public.avaliacao_contestacoes", "motivo da contestação", "moderação", CONTA),
  i("reviews", "public.reviews", "comentário (legado)", "avaliação", CONTA),
  i("property_reviews", "public.property_reviews", "nome do autor e comentário", "avaliação", CONTA),
  i("parceiro_avaliacoes", "public.parceiro_avaliacoes", "texto da avaliação", "avaliação do parceiro", CONTA),
  i("parceiros", "public.parceiros", "documento, razão social, telefone, dados de recebimento, base (lat/lng)", "o parceiro atender e receber", CONTA),
  i("parceiros-midia", "bucket:parceiros", "foto, capa e galeria do parceiro (públicas)", "página do parceiro", CONTA),
  i("parceiro_galeria", "public.parceiro_galeria", "caminho da foto da galeria", "página do parceiro", CONTA),
  i("parceiro_solicitacoes", "public.parceiro_solicitacoes", "nome, e-mail, documento, telefone", "análise do pedido de parceria", { prazoDias: null, gatilho: "decisao_admin", modo: "apagar", base: "pendente", fase: 2 }),
  i("parceiro_pedidos", "public.parceiro_pedidos", "descrição do pedido", "o serviço", ESTADIA),
  i("parceiro-entregas", "bucket:parceiro-entregas", "entregas e nota do parceiro", "prova da entrega", DISPUTA),
  i("parceiro_entregas", "public.parceiro_entregas", "caminho do arquivo entregue", "prova da entrega", DISPUTA),
  i("parceiro_servicos", "public.parceiro_servicos", "descrição do serviço", "catálogo do parceiro", CONTA),
  i("servicos_adicionais", "public.servicos_adicionais", "nome e descrição", "serviço", ESTADIA),
  i("servicos_pedidos", "public.servicos_pedidos", "observação", "serviço", ESTADIA),
  i("fotografo_pedidos", "public.fotografo_pedidos", "observação", "pedido de fotógrafo", ESTADIA),
  i("pets_inquilino", "public.pets_inquilino", "nome e observações do pet", "candidatura com pet", CONTA),
  i("pets-fotos", "bucket:pets-fotos", "foto do pet e carteira de vacina", "candidatura com pet", CONTA),
  i("internet_medicoes/morador", "public.internet_medicoes", "medição de internet do morador (velocidades, distância em metros, data)", "sinal de qualidade para o dono (Prompt 57)", { prazoDias: 0, gatilho: "sinal_processado", modo: "apagar", base: "proposta", fase: 2 }, "o sinal (abaixo de 50% ou não) no aviso ao dono"),
  i("internet_medicoes/dono", "public.internet_medicoes", "medição de internet do dono (velocidades, distância em metros, data)", "mostrar a internet medida no anúncio", { prazoDias: 0, gatilho: "remocao_anuncio", modo: "apagar", base: "proposta", fase: 2 }, "nada: sai com o anúncio (on delete cascade)"),
  i("anuncio-videos", "bucket:anuncio-videos", "vídeo curto do anúncio (privado; público só se o anúncio está publicado)", "anúncio (ordem 8681ae95)", { prazoDias: 0, gatilho: "remocao_anuncio", modo: "apagar", base: "proposta", fase: 2 }, "nada: sai com o anúncio"),
  i("property-photos", "bucket:property-photos", "fotos do anúncio (públicas)", "anúncio", { prazoDias: 0, gatilho: "remocao_anuncio", modo: "apagar", base: "proposta", fase: 1 }, "o hash da foto (antifraude, exceção aprovada)"),
  i("imovel_instrucoes_chegada", "public.imovel_instrucoes_chegada", "observações de chegada", "a estadia", CONTA),
  i("chamados", "public.chamados", "nome e e-mail do visitante", "atendimento", CONTA),
  i("chamado_mensagens", "public.chamado_mensagens", "mensagens e anexos do atendimento", "atendimento", CONTA),
  i("chamados-bucket", "bucket:chamados", "anexos do atendimento (sem uso no código)", "atendimento", CONTA),
  i("central-anexos", "bucket:central-anexos", "anexos do chat do admin", "operação", CONTA),
  i("caixa_socios", "public.caixa_socios", "texto, arquivo e texto extraído", "caixa dos sócios", CONTA),
  i("caixa-socios", "bucket:caixa-socios", "áudio, PDF e DOCX dos sócios", "caixa dos sócios", CONTA),
  i("agentes_conversas", "public.agentes_conversas", "texto do chat de IA do admin", "operação", CONTA),
  i("agentes_memoria", "public.agentes_memoria", "fatos guardados pela IA do admin", "operação", CONTA),
  i("agentes_ordens", "public.agentes_ordens", "texto das ordens", "operação", CONTA),
  i("leads_empresas", "public.leads_empresas", "nome, e-mail, mensagem", "contato comercial", CONTA),
  i("parceiros_interesse", "public.parceiros_interesse", "nome, WhatsApp, e-mail", "interesse em ser parceiro", CONTA),
  i("fotografos_contato", "public.fotografos_contato", "e-mail e WhatsApp", "contato de fotógrafo", CONTA),
  i("garantias", "public.garantias", "nome e observação", "garantia do contrato", ESTADIA),
  i("pagamentos_bloco", "public.pagamentos_bloco", "observação do pagamento", "financeiro", FISCAL),
  i("visitas_video", "public.visitas_video", "motivo da visita", "visita", ESTADIA),
  i("exclusao_conta_pedidos", "public.exclusao_conta_pedidos", "hash do e-mail e do IP", "prova do pedido de exclusão", { prazoDias: null, gatilho: "exclusao_conta", modo: "apagar", base: "pendente", fase: 2 }),
  i("eventos", "public.eventos", "sessão e utm (analytics)", "métricas", { prazoDias: 548, gatilho: "sem_gatilho_automatico", modo: "apagar", base: "proposta", fase: 2 }, "nada (já apagado aos 18 meses pelo pg_cron da 0067)"),
  i("push_tokens", "public.push_tokens", "token do aparelho", "aviso no app", CONTA),
  i("limites_uso", "public.limites_uso", "chave com uid ou hash do IP", "limite de uso", { prazoDias: null, gatilho: "sem_gatilho_automatico", modo: "apagar", base: "pendente", fase: 2 }),
  i("emails_teste", "public.emails_teste", "e-mails das contas de teste", "o QA ler os e-mails enviados", { prazoDias: null, gatilho: "sem_gatilho_automatico", modo: "apagar", base: "pendente", fase: 2 }),
  i("pedidos_ajuda_publicacao", "public.pedidos_ajuda_publicacao", "observação do dono", "ajuda para publicar", CONTA),
  i("property_ownership_checks", "public.property_ownership_checks", "matrícula, motivo e campos conferidos", "titularidade", CONTA, "veredito"),
  i("qualification_checklists", "public.qualification_checklists", "caminho do documento do imóvel", "qualificação", CONTA, "veredito"),
  i("tempos_deslocamento", "public.tempos_deslocamento", "chave com lat/lng do local de trabalho digitado", "tempo até o trabalho (37)", CONTA),
  // Prompt 51 F1: o motivo da saída (opcional) e o texto livre (só a equipe lê). Na exclusão da conta o user_id vira nulo.
  i("saidas_motivos", "public.saidas_motivos", "motivo da saída e texto livre opcional", "entender por que as pessoas saem (painel de qualidade)", { prazoDias: 365, gatilho: "sem_gatilho_automatico", modo: "anonimizar", base: "proposta", fase: 2 }, "papel, motivo e data, sem identificação (estatística)"),
  i("denuncias_anuncio", "public.denuncias_anuncio", "motivo e texto da denúncia de anúncio", "o atendimento analisar a denúncia", { prazoDias: 365, gatilho: "decisao_admin", modo: "apagar", base: "proposta", fase: 2 }, "o estado da denúncia no chamado"),
];

/** Tabelas que a varredura acha por nome de coluna mas não guardam dado pessoal (com o porquê). */
export const SEM_DADO_PESSOAL: Record<string, string> = {
  qualidade_correcoes: "item de correção do painel de qualidade: papel, motivo da taxonomia (chave fechada), contagem, responsável da equipe e prazo (Prompt 51)",
  agentes: "nome do agente de IA, não de pessoa",
  imovel_extras: "lista fechada de extras do anúncio (Adendo 59.1), sem dado de pessoa",
  nivel_itens: "itens de nível do anúncio e a foto de cada um (sem pessoas); ficam enquanto o anúncio existir e saem em cascata com ele (Adendo 59.1)",
  conforto_declaracoes: "itens do padrão mínimo marcados pelo dono para o imóvel (chave do item, sem dado pessoal)",
  asaas_eventos: "chave de idempotência do webhook",
  automacoes_envios: "chave de idempotência do envio",
  avisos_daniel: "texto dos avisos internos ao fundador (sem dado de usuário)",
  backups_execucoes: "motivo da falha do backup",
  chamado_macros: "texto-modelo das respostas",
  chaves_plataforma: "chave de configuração",
  cidades_liberadas: "cidade liberada",
  comissao_fixada_admin: "motivo da decisão do admin",
  config_cobranca: "configuração",
  config_parceria: "configuração",
  destinos: "polos públicos (universidade, hospital…), não pessoa",
  documentos_falhas: "motivo técnico da falha",
  eliminacoes_registro: "o livro de eliminações (nunca guarda o conteúdo)",
  fotos_anuncio_hash: "só o hash perceptual da foto do anúncio e o caminho (dono/uuid.webp) — exceção aprovada, antifraude",
  gastos_marketing: "observação do gasto",
  ia_chamadas: "motivo técnico da chamada de IA",
  interesse_cidade: "chave anônima de contagem",
  interesse_fotografo_cidade: "chave anônima de contagem",
  moderacao_log: "motivo da decisão de moderação",
  pedidos_ignorados: "motivo do dono ignorar o pedido",
  plataforma_chaves: "chave de configuração",
  properties: "coordenadas do IMÓVEL (não de pessoa)",
  property_workspaces: "coordenadas de coworking/café públicos",
  proximidades_cep: "coordenadas de CEP (cache público)",
};

/** Buckets: os que existem nas migrações (a guarda compara). */
export const BUCKETS_INVENTARIADOS = [...new Set(INVENTARIO.filter((x) => x.origem.startsWith("bucket:")).map((x) => x.origem.slice(7)))];
