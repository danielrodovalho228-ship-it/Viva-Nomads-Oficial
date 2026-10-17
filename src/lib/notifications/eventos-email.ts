/*
  Texto de cada evento de notificação (assunto, frase, imagem, botão e destino) — PURO,
  sem imports "@/…", para teste unitário. Ordem d250ea2f, item 2.
*/
/** Eventos que disparam notificação no funil (sem isso o funil vaza). */
export type NotificationEvent =
  | "new_lead" // proprietário recebe um interessado
  | "new_message" // nova mensagem no chat (proprietário OU inquilino)
  | "application_received" // candidatura recebida
  | "candidatura_aceita" // proprietário aceitou a candidatura → inquilino
  | "saved_search_match" // alerta de busca salva do inquilino
  | "verification_ready" // laudo CAF pronto
  | "contract_status" // status do contrato
  | "subscription_status" // status da assinatura
  // Pedido de Moradia (Fase 4)
  | "pedido_novo_cidade" // (legado) novo pedido na cidade → proprietários
  | "pedido_compativel" // pedido compatível com um imóvel do dono → proprietário
  | "pedido_resumo" // resumo diário dos pedidos compatíveis além do limite → proprietário
  | "pedido_imovel_novo" // imóvel compatível publicado depois → inquilino
  | "pedido_resposta" // proprietário respondeu → inquilino
  | "pedido_aceito" // inquilino aceitou para conversa → proprietário
  | "pedido_expirando" // pedido expira em 3 dias → inquilino
  | "pedido_moderado" // pedido ocultado pela moderação → inquilino
  // Verificação do documento do imóvel (anti-fraude) → proprietário
  | "documento_aprovado"
  | "documento_recusado"
  | "documento_recebido" // novo documento na fila → admin
  // Checklist de qualificação revisado pela equipe → proprietário
  | "checklist_aprovado"
  | "checklist_recusado"
  // Atendimento (chamados) — assunto específico vem em `subject` (com o número)
  | "chamado_aberto" // → quem abriu
  | "chamado_respondido" // → quem abriu
  | "chamado_resolvido" // → quem abriu (com a nota de 1 a 5)
  | "chamado_equipe" // P1/P2, aprovação, prazo em risco → admins
  | "manutencao_nova" // inquilino abriu manutenção → proprietário
  | "manutencao_atrasada" // prazo da manutenção vencido → proprietário
  | "manutencao_atualizada" // status da ordem mudou → a outra parte
  | "manutencao_mensagem" // nova mensagem dentro da ordem → a outra parte
  | "checkin_lembrete" // entrada em 2 dias / amanhã → proprietário e inquilino
  // Automações por data (cron /api/cron/automacoes, ordem d250ea2f item 5)
  | "anuncio_incompleto" // rascunho parado há 1 e 3 dias → proprietário
  | "saida_lembrete" // saída em 3 dias → proprietário e inquilino
  | "avaliacao_pedido" // 1 dia após a saída → proprietário e inquilino
  | "renovacao_aviso"; // 15 dias antes do fim do bloco → proprietário e inquilino

// `img` = chave da imagem de assunto (public/media/email/<img>.jpg).
export const TEMPLATES: Record<NotificationEvent, { subject: string; body: (n?: string) => string; img: string; cta: string; path: string }> = {
  new_lead: { subject: "Novo interessado no seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, você recebeu um novo interessado no Viva Nomads.`, img: "novo-interessado", cta: "Ver interessado", path: "/dashboard/leads" },
  new_message: { subject: "Você tem uma nova mensagem no Viva Nomads", body: (n) => `Olá${n ? " " + n : ""}, você recebeu uma nova mensagem no Viva Nomads.`, img: "nova-mensagem", cta: "Ver mensagem", path: "/dashboard/mensagens" },
  application_received: { subject: "Candidatura recebida", body: () => "Recebemos sua candidatura. O proprietário foi notificado.", img: "candidatura-recebida", cta: "Acompanhar candidatura", path: "/dashboard/candidaturas" },
  candidatura_aceita: { subject: "Sua candidatura foi aceita", body: (n) => `Boa notícia${n ? ", " + n : ""}! O proprietário aceitou sua candidatura. A conversa está liberada em Mensagens — a negociação segue toda pela plataforma.`, img: "nova-mensagem", cta: "Abrir a conversa", path: "/dashboard/mensagens" },
  saved_search_match: { subject: "Novo imóvel para sua busca", body: () => "Um imóvel novo combina com sua busca salva no Viva Nomads.", img: "transacional", cta: "Ver imóvel", path: "/dashboard/buscas" },
  verification_ready: { subject: "Sua verificação está pronta", body: () => "A conferência da sua identidade foi concluída. Veja o resultado no painel.", img: "candidatura-recebida", cta: "Ver resultado", path: "/dashboard/verificacao" },
  contract_status: { subject: "Atualização do seu contrato", body: () => "Há uma atualização no seu contrato de locação.", img: "pedido-resposta", cta: "Ver contrato", path: "/dashboard/contratos" },
  subscription_status: { subject: "Atualização da sua assinatura", body: () => "Há uma atualização na sua assinatura Viva Nomads.", img: "transacional", cta: "Ver detalhes", path: "/dashboard" },
  pedido_novo_cidade: { subject: "Novo pedido de moradia na sua cidade", body: (n) => `Olá${n ? " " + n : ""}, um inquilino publicou um pedido de moradia na cidade de um dos seus imóveis. Veja se algum atende.`, img: "transacional", cta: "Ver pedidos", path: "/dashboard/pedidos-cidade" },
  pedido_compativel: { subject: "Pedido de moradia compatível com o seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, um pedido de moradia combina com um imóvel seu. Veja por que e responda pela plataforma.`, img: "transacional", cta: "Ver pedido e responder", path: "/dashboard/pedidos-cidade" },
  pedido_resumo: { subject: "Resumo do dia: pedidos compatíveis com seus imóveis", body: (n) => `Olá${n ? " " + n : ""}, estes pedidos de moradia combinam com imóveis seus.`, img: "transacional", cta: "Ver pedidos do dia", path: "/dashboard/pedidos-cidade" },
  pedido_imovel_novo: { subject: "Surgiu um imóvel compatível com o seu pedido", body: (n) => `Olá${n ? " " + n : ""}, um imóvel publicado agora combina com o seu pedido de moradia. O proprietário também foi avisado.`, img: "pedido-resposta", cta: "Ver o imóvel", path: "/dashboard/pedidos" },
  pedido_resposta: { subject: "Um proprietário respondeu ao seu pedido", body: (n) => `Olá${n ? " " + n : ""}, um proprietário respondeu ao seu pedido de moradia com um imóvel. Veja e aceite para conversar.`, img: "pedido-resposta", cta: "Ver a resposta", path: "/dashboard/pedidos" },
  pedido_aceito: { subject: "Seu imóvel foi aceito para conversa", body: (n) => `Olá${n ? " " + n : ""}, um inquilino aceitou sua resposta e abriu a conversa. Responda pela plataforma.`, img: "nova-mensagem", cta: "Abrir a conversa", path: "/dashboard/mensagens" },
  pedido_expirando: { subject: "Seu pedido de moradia expira em breve", body: (n) => `Olá${n ? " " + n : ""}, seu pedido de moradia expira em até 3 dias. Renove ou marque como atendido se já resolveu.`, img: "transacional", cta: "Renovar pedido", path: "/dashboard/pedidos" },
  pedido_moderado: { subject: "Seu pedido de moradia foi ocultado", body: (n) => `Olá${n ? " " + n : ""}, seu pedido de moradia foi ocultado pela moderação. Veja o motivo e ajuste se necessário.`, img: "transacional", cta: "Ver o motivo", path: "/dashboard/pedidos" },
  documento_aprovado: { subject: "Documentação aprovada — você já pode publicar", body: (n) => `Olá${n ? " " + n : ""}, a documentação do seu imóvel foi verificada e aprovada. Seu anúncio já pode ser publicado.`, img: "candidatura-recebida", cta: "Publicar meu anúncio", path: "/dashboard/imoveis" },
  documento_recusado: { subject: "Documentação não aprovada", body: (n) => `Olá${n ? " " + n : ""}, a documentação enviada não pôde ser aprovada. Veja o motivo, ajuste e reenvie para liberar a publicação.`, img: "pedido-resposta", cta: "Reenviar documento", path: "/dashboard/imoveis" },
  checklist_aprovado: { subject: "Qualificação do imóvel aprovada", body: (n) => `Olá${n ? " " + n : ""}, a equipe Viva Nomads revisou e aprovou a qualificação do seu imóvel.`, img: "candidatura-recebida", cta: "Ver meu imóvel", path: "/dashboard/imoveis" },
  checklist_recusado: { subject: "Qualificação do imóvel não aprovada", body: (n) => `Olá${n ? " " + n : ""}, a equipe Viva Nomads revisou a qualificação do seu imóvel e ela não foi aprovada. Veja o motivo, ajuste e envie de novo.`, img: "pedido-resposta", cta: "Ajustar e reenviar", path: "/dashboard/imoveis" },
  chamado_aberto: { subject: "Recebemos seu chamado", body: (n) => `Olá${n ? " " + n : ""}, recebemos seu chamado na Central de Ajuda do Viva Nomads. Você acompanha e responde por lá.`, img: "transacional", cta: "Acompanhar chamado", path: "/ajuda" },
  chamado_respondido: { subject: "Seu chamado foi respondido", body: (n) => `Olá${n ? " " + n : ""}, há uma resposta da equipe Viva Nomads no seu chamado.`, img: "nova-mensagem", cta: "Ver resposta", path: "/ajuda" },
  chamado_resolvido: { subject: "Seu chamado foi resolvido", body: (n) => `Olá${n ? " " + n : ""}, marcamos seu chamado como resolvido. Se algo ficou pendente, é só responder por lá.`, img: "transacional", cta: "Ver chamado", path: "/ajuda" },
  chamado_equipe: { subject: "Atendimento: chamado precisa da equipe", body: () => "Um chamado na Central de Ajuda precisa da equipe.", img: "transacional", cta: "Abrir no atendimento", path: "/admin/atendimento" },
  manutencao_nova: { subject: "Pedido de manutenção no seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, o inquilino abriu um pedido de manutenção no seu imóvel. Responda pela plataforma dentro do prazo.`, img: "transacional", cta: "Responder pedido", path: "/dashboard/solicitacoes" },
  manutencao_atrasada: { subject: "Manutenção sem resposta — prazo vencido", body: (n) => `Olá${n ? " " + n : ""}, o pedido de manutenção do seu inquilino passou do prazo sem resposta. Responda pela plataforma.`, img: "transacional", cta: "Responder agora", path: "/dashboard/solicitacoes" },
  manutencao_atualizada: { subject: "Atualização na ordem de manutenção", body: (n) => `Olá${n ? " " + n : ""}, a ordem de manutenção do imóvel mudou de status. Veja o histórico pela plataforma.`, img: "transacional", cta: "Ver histórico", path: "/dashboard/solicitacoes" },
  manutencao_mensagem: { subject: "Nova mensagem na ordem de manutenção", body: (n) => `Olá${n ? " " + n : ""}, há uma nova mensagem na ordem de manutenção do imóvel. Responda pela plataforma.`, img: "nova-mensagem", cta: "Ver mensagem", path: "/dashboard/solicitacoes" },
  checkin_lembrete: { subject: "Lembrete: a entrada no imóvel está chegando", body: (n) => `Olá${n ? " " + n : ""}, a entrada no imóvel do seu contrato está chegando. Confira o horário e as instruções de entrada pela plataforma.`, img: "transacional", cta: "Ver instruções de entrada", path: "/dashboard/contratos" },
  anuncio_incompleto: { subject: "Falta pouco para publicar seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, seu cadastro de imóvel ficou pela metade. Termine, envie a documentação e publique.`, img: "transacional", cta: "Continuar o cadastro", path: "/dashboard/imoveis" },
  saida_lembrete: { subject: "Lembrete: a saída está chegando", body: (n) => `Olá${n ? " " + n : ""}, a saída do imóvel do seu contrato é em 3 dias. Combine a conferência de saída pela plataforma.`, img: "transacional", cta: "Ver conferência de saída", path: "/dashboard/contratos" },
  avaliacao_pedido: { subject: "Como foi a estadia? Deixe sua avaliação", body: (n) => `Olá${n ? " " + n : ""}, a estadia terminou. Sua avaliação leva 2 minutos e ajuda os próximos moradores e proprietários.`, img: "nova-mensagem", cta: "Avaliar a estadia", path: "/dashboard/contratos" },
  renovacao_aviso: { subject: "Quer renovar? Seu bloco termina em 15 dias", body: (n) => `Olá${n ? " " + n : ""}, o bloco do seu contrato termina em 15 dias. Se quiserem seguir, combinem a renovação pela plataforma.`, img: "pedido-resposta", cta: "Ver o contrato", path: "/dashboard/contratos" },
  documento_recebido: { subject: "Novo documento de imóvel para conferir", body: () => "Um proprietário enviou a documentação do imóvel. Há um item aguardando conferência na fila de moderação.", img: "transacional", cta: "Conferir documento", path: "/admin/documentos" },
};
