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
  | "pedido_confirmar_telefone" // chave SMS_ATIVO ligada: 7 dias para confirmar o telefone → inquilino (Prompt 30)
  | "pedido_encerrado" // o inquilino excluiu o pedido que você respondeu → proprietário (Prompt 30)
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
  // Prompt 44 (item 3): alertas operacionais por push, só para admins com "receber alertas operacionais".
  | "alerta_backup_falhou" // a cópia noturna (Resiliência 2) falhou → admins
  | "alerta_email_falhou" // o envio de e-mail falhou (Resend) → admins
  | "manutencao_nova" // inquilino abriu manutenção → proprietário
  | "manutencao_atrasada" // prazo da manutenção vencido → proprietário
  | "manutencao_atualizada" // status da ordem mudou → a outra parte
  | "manutencao_mensagem" // nova mensagem dentro da ordem → a outra parte
  // Prompt 59: prazo de solução da manutenção e padrão mínimo de conforto
  | "manutencao_prazo" // resolver até / prazo perto / vencido / reaberta → proprietário (e o morador sabe do aviso)
  | "conforto_prazo" // confirme o padrão mínimo até [data] / anúncio saiu da busca → proprietário
  | "nivel_prova_celular" // FOTO-NA-HORA-B: link de uso único para fotografar o item do nível pelo celular → dono
  | "nivel_prova_vencida" // FOTO-NA-HORA-B: prova anterior à regra venceu sem foto da câmera; o item deixou de contar → dono
  | "conforto_pendencia" // item do padrão mínimo que não confere (e o que aconteceu com ele) → as partes
  | "checkin_lembrete" // entrada em 2 dias / amanhã → proprietário e inquilino
  // Automações por data (cron /api/cron/automacoes, ordem d250ea2f item 5)
  | "anuncio_incompleto" // rascunho parado há 3 dias → proprietário (Prompt 50: 1 e-mail, "Faltam N passos", passo exato)
  | "verificacao_parada" // Prompt 50: verificação iniciada e não concluída em 24 h → a pessoa (causa da última tentativa)
  | "parceiro_sem_resposta" // Prompt 50: solicitação de parceiro sem resposta em 1 dia útil → equipe
  | "chamado_fora_promessa" // Prompt 50: chamado sem 1ª resposta de uma pessoa em 24 h → equipe
  | "verificacao_analise_humana" // Prompt 50: 2ª reprovação automática da verificação → equipe (fila de documentos)
  | "saida_lembrete" // saída em 3 dias → proprietário e inquilino
  | "avaliacao_pedido" // 1 dia após a saída → proprietário e inquilino
  | "renovacao_aviso" // 15 dias antes do fim do bloco → proprietário e inquilino
  // Propostas (prompt 17)
  | "proposta_recebida" // proposta ou contraproposta nova → a outra parte
  | "proposta_respondida" // proposta aceita ou recusada → a outra parte
  | "proposta_vencendo" // 24 h antes de vencer → quem tem de responder (prompt 27, cron de automações)
  // Visitas (prompt 23): vídeo e presencial, sempre pela plataforma
  | "visita_pedida" // morador pediu → proprietário
  | "visita_confirmada" // horário confirmado → a outra parte
  | "visita_remarcada" // proprietário propôs outro horário → morador
  | "visita_cancelada" // cancelada ou recusada (com motivo) → a outra parte
  // Candidatura e contrato (prompt 23): nunca e-mail de "recusada"
  | "anuncio_compartilhar" // contrato assinado pelas duas partes → proprietário: o cartão do anúncio para compartilhar (push)
  | "candidatura_nova" // candidatura recebida → proprietário (contrato pronto/assinado: contract_status, prompt 24)
  // Parceiros (prompt 31a)
  | "parceria_recebida" // pedido de parceria recebido → quem pediu
  | "parceria_recusada" // pedido de parceria recusado (com o motivo) → quem pediu
  | "parceria_convite" // a equipe abriu o pedido pela pessoa (suporte) → a pessoa completa e confirma
  | "parceria_equipe" // pedido novo, novo link pedido → admins
  // Contratação de parceiros (Prompt 31b)
  | "parceiro_pedido_novo" // pedido de orçamento novo → parceiro
  | "parceiro_orcamento_recebido" // o parceiro orçou → cliente
  | "parceiro_pedido_recusado" // L2-B item 17: o parceiro recusou → cliente (motivo + pedir a outro parceiro)
  | "parceiro_orcamento_aceito" // o cliente aceitou → parceiro
  | "parceiro_horario_confirmado" // horário confirmado → as duas partes
  | "parceiro_lembrete" // lembrete do dia anterior → as duas partes
  | "parceiro_entrega_feita" // o parceiro marcou a entrega → cliente
  | "parceiro_conclusao_pendente" // entrega há 7 dias sem confirmação → cliente (nada conclui sozinho)
  | "parceiro_avaliacao" // serviço concluído → as duas partes avaliam
  // Página da estadia (Prompt 32)
  | "estadia_instrucoes_liberadas" // D-7, com o contrato assinado e o 1º pagamento → morador
  | "estadia_convite_ocupante" // 61-B: o morador convidou quem vai morar junto → o convidado (só leitura)
  | "estadia_instrucoes_pendentes" // D-10 sem instruções de chegada → proprietário
  | "estadia_aditivo_proposto" // proposta de alteração → a outra parte (7 dias para responder)
  | "estadia_aditivo_respondido" // aceita (assinar) ou recusada → quem propôs
  | "estadia_remarcada" // aditivo assinado pelas duas partes: blocos e datas mudaram → as duas partes
  | "estadia_encerramento_pedido" // pedido de encerramento → a outra parte (a Viva conduz)
  | "estadia_encerramento_equipe" // pedido de encerramento novo → admins
  // Viva rodando automático (Prompt 38)
  | "vinculo_parceiro_convite" // o dono convidou o parceiro como fixo do imóvel → parceiro
  | "vinculo_parceiro_resposta" // o parceiro aceitou ou recusou o convite → dono
  | "foto_perfil_removida" // FOTO-PERFIL-B: a equipe removeu a foto do perfil pela fila (motivo da lista fechada) → a pessoa
  | "parceiro_selo_nota_removido" // FISCAL-PARCEIRO-B: denúncia procedente tirou o selo "Emite nota fiscal" → parceiro
  | "pedido_auto_confirmar" // pedido automático no modo "confirmar" → dono (1 toque)
  | "pedido_auto_sem_resposta" // parceiro sem resposta em 24 h → dono (pode trocar)
  | "pedido_auto_atualizado" // estadia remarcada: janela nova → parceiro
  | "pedido_auto_cancelado" // contrato encerrado: pedido cancelado → parceiro
  | "saida_sem_parceiro" // saída em 5 dias sem limpeza vinculada → dono
  | "sugestao_parceiros_morador" // D-7 da entrada ou da saída: parceiros sugeridos → morador
  | "internet_remedir" // 57: a medição da internet vence em ~2 semanas → dono
  | "internet_abaixo_medida" // 57: a medição do morador ficou abaixo de 50% da do dono → dono
  // Avaliação do imóvel por avaliador credenciado (Prompt 62-B1), atrás de VISTORIA_ATIVA
  | "vistoria_designada" // a Viva designou o avaliador → avaliador (aceitar ou recusar em 24 h)
  | "vistoria_designado_dono" // avaliador designado pela Viva → dono (combinar a agenda pelas mensagens)
  | "vistoria_agendada" // visita agendada → dono e avaliador
  | "vistoria_concordancia" // imóvel ocupado: a visita espera a concordância → morador
  | "vistoria_lembrete" // D-1 da visita → dono, avaliador e morador
  | "vistoria_ausencia" // ausência registrada → dono e avaliador
  | "vistoria_sem_avaliador" // nenhum avaliador elegível → admins
  // 63-B: selo "LinkedIn conectado" (atrás de LINKEDIN_CONECTAR_ATIVO)
  | "linkedin_vencendo" // o selo vence em 30 dias → a própria pessoa (reconectar)
  | "linkedin_ja_conectado" // alguém tentou conectar um LinkedIn que já está em outra conta → admins (sem expor quem)
  // Prompt 62-B2: laudo, resultado, ressalvas, "· vistoriado", strikes e contestação.
  | "vistoria_laudo_emitido" // laudo VIS emitido → dono (resultado, o que corrigir, prazo e próximo passo)
  | "vistoria_fora_da_busca" // segurança grave não conforme → dono (anúncio fora da busca até a correção)
  | "vistoria_ressalva_vencida" // ressalva não corrigida em 15 dias → dono
  | "vistoria_vistoriado_expira" // "· vistoriado" (nível confirmado) expira em 30 dias → dono ("Pedir nova avaliação")
  | "vistoria_strike" // novo passo na escada de strikes → dono
  | "vistoria_verificacao" // verificação aberta pela Viva → dono
  | "vistoria_devolucao" // contestação deu razão ao dono → 1º avaliador devolve o valor
  | "vistoria_correcao_enviada" // o dono enviou a foto da correção → avaliador confere
  | "vistoria_fila_admin" // laudo atrasado, ressalva vencida, devolução vencida → admins
  // Prompt 53: calendário importado do Airbnb/Booking.
  | "calendario_conflito" // data importada cai num compromisso da Viva → dono (decide; nada é cancelado)
  | "calendario_falha"; // o link .ics falhou 3 vezes seguidas → dono (com a causa)

// Assunto SEM a marca (o envio põe "· Viva Nomads"; regras em assuntos.ts). A imagem de cada evento mora em
// imagens-email.ts (IMAGEM por tema, fonte única).
export const TEMPLATES: Record<NotificationEvent, { subject: string; body: (n?: string) => string; cta: string; path: string }> = {
  new_lead: { subject: "Novo interessado no seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, você recebeu um novo interessado no Viva Nomads.`, cta: "Ver interessado", path: "/dashboard/leads" },
  new_message: { subject: "Você tem uma nova mensagem", body: (n) => `Olá${n ? " " + n : ""}, você recebeu uma nova mensagem no Viva Nomads.`, cta: "Ver mensagem", path: "/dashboard/mensagens" },
  application_received: { subject: "Candidatura recebida", body: () => "Recebemos sua candidatura. O proprietário foi notificado.", cta: "Acompanhar candidatura", path: "/dashboard/candidaturas" },
  candidatura_aceita: { subject: "Sua candidatura foi aceita", body: (n) => `Boa notícia${n ? ", " + n : ""}! O proprietário aceitou sua candidatura. A conversa está liberada em Mensagens — a negociação segue toda pela plataforma.`, cta: "Abrir a conversa", path: "/dashboard/mensagens" },
  saved_search_match: { subject: "Novo imóvel para sua busca", body: () => "Um imóvel novo combina com sua busca salva no Viva Nomads.", cta: "Ver imóvel", path: "/dashboard/buscas" },
  verification_ready: { subject: "Sua verificação está pronta", body: () => "A conferência da sua identidade foi concluída. Veja o resultado no painel.", cta: "Ver resultado", path: "/dashboard/verificacao" },
  contract_status: { subject: "Atualização do seu contrato", body: () => "Há uma atualização no seu contrato de locação.", cta: "Ver contrato", path: "/dashboard/contratos" },
  subscription_status: { subject: "Atualização da sua assinatura", body: () => "Há uma atualização na sua assinatura Viva Nomads.", cta: "Ver detalhes", path: "/dashboard" },
  pedido_novo_cidade: { subject: "Novo pedido de moradia na sua cidade", body: (n) => `Olá${n ? " " + n : ""}, um inquilino publicou um pedido de moradia na cidade de um dos seus imóveis. Veja se algum atende.`, cta: "Ver pedidos", path: "/dashboard/pedidos-cidade" },
  pedido_compativel: { subject: "Pedido de moradia compatível com o seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, um pedido de moradia combina com um imóvel seu. Veja por que e responda pela plataforma.`, cta: "Ver pedido e responder", path: "/dashboard/pedidos-cidade" },
  pedido_resumo: { subject: "Resumo do dia: pedidos compatíveis com seus imóveis", body: (n) => `Olá${n ? " " + n : ""}, estes pedidos de moradia combinam com imóveis seus.`, cta: "Ver pedidos do dia", path: "/dashboard/pedidos-cidade" },
  pedido_imovel_novo: { subject: "Surgiu um imóvel compatível com o seu pedido", body: (n) => `Olá${n ? " " + n : ""}, um imóvel publicado agora combina com o seu pedido de moradia. O proprietário também foi avisado.`, cta: "Ver o imóvel", path: "/dashboard/pedidos" },
  pedido_resposta: { subject: "Um proprietário respondeu ao seu pedido", body: (n) => `Olá${n ? " " + n : ""}, um proprietário respondeu ao seu pedido de moradia com um imóvel. Veja e aceite para conversar.`, cta: "Ver a resposta", path: "/dashboard/pedidos" },
  pedido_aceito: { subject: "Seu imóvel foi aceito para conversa", body: (n) => `Olá${n ? " " + n : ""}, um inquilino aceitou sua resposta e abriu a conversa. Responda pela plataforma.`, cta: "Abrir a conversa", path: "/dashboard/mensagens" },
  pedido_expirando: { subject: "Ainda procurando? Renove com um clique", body: (n) => `Olá${n ? " " + n : ""}, seu pedido de moradia expira em até 5 dias. Ainda procurando? Renove com um clique; se já resolveu, marque como atendido.`, cta: "Renovar pedido", path: "/dashboard/pedidos" },
  pedido_confirmar_telefone: { subject: "Confirme seu telefone para manter o pedido visível", body: (n) => `Olá${n ? " " + n : ""}, para o seu pedido de moradia continuar visível aos proprietários, confirme o seu telefone nos próximos 7 dias.`, cta: "Confirmar telefone", path: "/dashboard/conta/perfil" },
  pedido_encerrado: { subject: "Um pedido de moradia que você respondeu foi encerrado", body: (n) => `Olá${n ? " " + n : ""}, o inquilino encerrou um pedido de moradia que você respondeu. Ele não aparece mais na sua lista.`, cta: "Ver pedidos", path: "/dashboard/pedidos-cidade" },
  pedido_moderado: { subject: "Seu pedido de moradia foi ocultado", body: (n) => `Olá${n ? " " + n : ""}, seu pedido de moradia foi ocultado pela moderação. Veja o motivo e ajuste se necessário.`, cta: "Ver o motivo", path: "/dashboard/pedidos" },
  documento_aprovado: { subject: "Documento aprovado", body: (n) => `Olá${n ? " " + n : ""}, a documentação do seu imóvel foi verificada e aprovada. Seu anúncio já pode ser publicado.`, cta: "Publicar meu anúncio", path: "/dashboard/imoveis" },
  documento_recusado: { subject: "Documento precisa de ajuste", body: (n) => `Olá${n ? " " + n : ""}, a documentação enviada não pôde ser aprovada. Veja o motivo, ajuste e reenvie para liberar a publicação.`, cta: "Reenviar documento", path: "/dashboard/imoveis" },
  checklist_aprovado: { subject: "Qualificação do imóvel aprovada", body: (n) => `Olá${n ? " " + n : ""}, a equipe Viva Nomads revisou e aprovou a qualificação do seu imóvel.`, cta: "Ver meu imóvel", path: "/dashboard/imoveis" },
  checklist_recusado: { subject: "Qualificação do imóvel não aprovada", body: (n) => `Olá${n ? " " + n : ""}, a equipe Viva Nomads revisou a qualificação do seu imóvel e ela não foi aprovada. Veja o motivo, ajuste e envie de novo.`, cta: "Ajustar e reenviar", path: "/dashboard/imoveis" },
  chamado_aberto: { subject: "Recebemos seu chamado", body: (n) => `Olá${n ? " " + n : ""}, recebemos seu chamado na Central de Ajuda do Viva Nomads. Você acompanha e responde por lá.`, cta: "Acompanhar chamado", path: "/ajuda" },
  chamado_respondido: { subject: "Seu chamado foi respondido", body: (n) => `Olá${n ? " " + n : ""}, há uma resposta da equipe Viva Nomads no seu chamado.`, cta: "Ver resposta", path: "/ajuda" },
  chamado_resolvido: { subject: "Seu chamado foi resolvido", body: (n) => `Olá${n ? " " + n : ""}, marcamos seu chamado como resolvido. Se algo ficou pendente, é só responder por lá.`, cta: "Ver chamado", path: "/ajuda" },
  alerta_backup_falhou: { subject: "A cópia noturna falhou", body: () => "A cópia noturna do banco e dos arquivos não terminou. Veja a causa no admin e rode de novo.", cta: "Abrir as cópias", path: "/admin" },
  alerta_email_falhou: { subject: "O envio de e-mail falhou", body: () => "Um e-mail da Viva não saiu (o provedor recusou ou não respondeu). Veja a causa no admin.", cta: "Abrir o diagnóstico", path: "/admin" },
  chamado_equipe: { subject: "Atendimento: chamado precisa da equipe", body: () => "Um chamado na Central de Ajuda precisa da equipe.", cta: "Abrir no atendimento", path: "/admin/atendimento" },
  manutencao_nova: { subject: "Pedido de manutenção no seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, o inquilino abriu um pedido de manutenção no seu imóvel. Responda pela plataforma dentro do prazo.`, cta: "Responder pedido", path: "/dashboard/solicitacoes" },
  manutencao_atrasada: { subject: "Manutenção sem resposta: prazo vencido", body: (n) => `Olá${n ? " " + n : ""}, o pedido de manutenção do seu inquilino passou do prazo sem resposta. Responda pela plataforma.`, cta: "Responder agora", path: "/dashboard/solicitacoes" },
  manutencao_atualizada: { subject: "Atualização na ordem de manutenção", body: (n) => `Olá${n ? " " + n : ""}, a ordem de manutenção do imóvel mudou de status. Veja o histórico pela plataforma.`, cta: "Ver histórico", path: "/dashboard/solicitacoes" },
  manutencao_prazo: { subject: "Prazo de solução da manutenção", body: (n) => `Olá${n ? " " + n : ""}, um pedido de manutenção do seu imóvel tem prazo de solução. Veja o prazo e atualize a ordem pela plataforma.`, cta: "Ver a ordem", path: "/dashboard/solicitacoes" },
  conforto_prazo: { subject: "Confirme o padrão mínimo do seu anúncio", body: (n) => `Olá${n ? " " + n : ""}, o seu anúncio precisa do padrão mínimo de conforto confirmado para continuar na busca.`, cta: "Confirmar o padrão mínimo", path: "/dashboard/imoveis" },
  nivel_prova_celular: { subject: "Fotografe o item pelo celular", body: (n) => `Olá${n ? " " + n : ""}, abra este e-mail no celular e toque no botão para fotografar o item do nível na hora, pela câmera. O link vale por 30 minutos e uma vez só.`, cta: "Continuar no celular", path: "/dashboard/imoveis" },
  nivel_prova_vencida: { subject: "A foto de um item do nível venceu", body: (n) => `Olá${n ? " " + n : ""}, a foto de um item do nível do seu anúncio era anterior à regra e não foi refeita pela câmera no prazo. O item deixou de contar e o nível foi recalculado. Fotografe o item agora para ele voltar a contar.`, cta: "Fotografar agora", path: "/dashboard/imoveis" },
  conforto_pendencia: { subject: "Pendência do padrão mínimo no imóvel", body: (n) => `Olá${n ? " " + n : ""}, há uma pendência do padrão mínimo de conforto no imóvel do seu contrato. Veja pela plataforma.`, cta: "Ver a pendência", path: "/dashboard/contratos" },
  manutencao_mensagem: { subject: "Nova mensagem na ordem de manutenção", body: (n) => `Olá${n ? " " + n : ""}, há uma nova mensagem na ordem de manutenção do imóvel. Responda pela plataforma.`, cta: "Ver mensagem", path: "/dashboard/solicitacoes" },
  checkin_lembrete: { subject: "Lembrete: a entrada no imóvel está chegando", body: (n) => `Olá${n ? " " + n : ""}, a entrada no imóvel do seu contrato está chegando. Confira o horário e as instruções de entrada pela plataforma.`, cta: "Ver instruções de entrada", path: "/dashboard/contratos" },
  anuncio_incompleto: { subject: "Faltam poucos passos para publicar seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, seu anúncio está parado há 3 dias. Abaixo, o que falta; o botão leva direto ao próximo passo.`, cta: "Continuar o anúncio", path: "/dashboard/imoveis" },
  verificacao_parada: { subject: "Sua verificação de identidade ficou pela metade", body: (n) => `Olá${n ? " " + n : ""}, a última tentativa de verificar sua identidade não passou. Veja abaixo o que aconteceu e o que fazer para concluir agora.`, cta: "Verificar de novo", path: "/dashboard/verificacao" },
  parceiro_sem_resposta: { subject: "Solicitação de parceria sem resposta há 1 dia útil", body: () => "Uma solicitação de parceria espera a decisão da equipe há mais de 1 dia útil. O parceiro vê o estado e pode falar com a Viva.", cta: "Abrir as solicitações", path: "/admin/parceiros" },
  chamado_fora_promessa: { subject: "Chamado sem resposta de uma pessoa em 24 horas", body: () => "Um chamado passou das 24 horas prometidas sem a 1ª resposta de uma pessoa da equipe.", cta: "Abrir o chamado", path: "/admin/atendimento" },
  verificacao_analise_humana: { subject: "Verificação de identidade para análise de uma pessoa", body: () => "Uma verificação de identidade foi reprovada duas vezes pela checagem automática e espera a análise da equipe, com o motivo.", cta: "Abrir a fila de documentos", path: "/admin/documentos" },
  saida_lembrete: { subject: "Lembrete: a saída está chegando", body: (n) => `Olá${n ? " " + n : ""}, a saída do imóvel do seu contrato é em 3 dias. Combine a conferência de saída pela plataforma.`, cta: "Ver conferência de saída", path: "/dashboard/contratos" },
  avaliacao_pedido: { subject: "Como foi a estadia? Deixe sua avaliação", body: (n) => `Olá${n ? " " + n : ""}, a estadia terminou. Sua avaliação leva 2 minutos e ajuda os próximos moradores e proprietários.`, cta: "Avaliar a estadia", path: "/dashboard/contratos" },
  renovacao_aviso: { subject: "Seu período termina em 15 dias: quer renovar?", body: (n) => `Olá${n ? " " + n : ""}, o bloco do seu contrato termina em 15 dias. Se quiserem seguir, combinem a renovação pela plataforma.`, cta: "Ver o contrato", path: "/dashboard/contratos" },
  proposta_recebida: { subject: "Você recebeu uma proposta", body: (n) => `Olá${n ? " " + n : ""}, há uma proposta nova para você no Viva Nomads. Confira os valores e responda pela plataforma.`, cta: "Ver a proposta", path: "/dashboard/orcamentos" },
  visita_pedida: { subject: "Pedido de visita no seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, um interessado pediu uma visita ao seu imóvel. Confirme um horário, proponha outro ou recuse pela plataforma.`, cta: "Responder o pedido", path: "/dashboard/visitas" },
  visita_confirmada: { subject: "Visita confirmada", body: (n) => `Olá${n ? " " + n : ""}, a visita foi confirmada. O horário é sempre de Brasília.`, cta: "Ver a visita", path: "/dashboard/visitas" },
  visita_remarcada: { subject: "Proposta de novo horário para a visita", body: (n) => `Olá${n ? " " + n : ""}, o proprietário propôs outro horário para a visita. Aceite ou cancele pela plataforma.`, cta: "Ver o horário", path: "/dashboard/visitas" },
  visita_cancelada: { subject: "Visita cancelada", body: (n) => `Olá${n ? " " + n : ""}, a visita foi cancelada. Veja os detalhes pela plataforma.`, cta: "Ver detalhes", path: "/dashboard/visitas" },
  candidatura_nova: { subject: "Nova candidatura no seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, você recebeu uma candidatura para o seu imóvel. Veja o pedido e responda pela plataforma.`, cta: "Ver a candidatura", path: "/dashboard/leads" },
  proposta_vencendo: { subject: "Sua proposta vence em menos de 24 horas", body: (n) => `Olá${n ? " " + n : ""}, uma proposta aguardando a sua resposta vence em menos de 24 horas. Responda pela plataforma.`, cta: "Ver a proposta", path: "/dashboard/propostas" },
  proposta_respondida: { subject: "Sua proposta foi respondida", body: (n) => `Olá${n ? " " + n : ""}, a sua proposta teve resposta no Viva Nomads.`, cta: "Ver a resposta", path: "/dashboard/orcamentos" },
  anuncio_compartilhar: { subject: "Seu anúncio está no ar: compartilhe o cartão", body: (n) => `Olá${n ? " " + n : ""}, o cartão do seu anúncio está pronto, com um QR que leva direto ao imóvel. Compartilhe no WhatsApp em um toque.`, cta: "Ver o cartão", path: "/dashboard/imoveis" },
  parceria_recebida: { subject: "Recebemos o seu pedido de parceria", body: (n) => `Olá${n ? " " + n : ""}, recebemos o seu pedido para ser parceiro da Viva Nomads. A equipe analisa os dados e responde por e-mail. Você pode acompanhar pela sua conta.`, cta: "Acompanhar o pedido", path: "/dashboard/parceiro" },
  parceria_recusada: { subject: "Sobre o seu pedido de parceria", body: (n) => `Olá${n ? " " + n : ""}, analisamos o seu pedido de parceria e, por enquanto, não foi possível aprovar. O motivo está abaixo. A sua conta continua normal para alugar ou anunciar.`, cta: "Ver o pedido", path: "/dashboard/parceiro" },
  parceria_convite: { subject: "Complete o seu pedido de parceria", body: (n) => `Olá${n ? " " + n : ""}, a equipe da Viva Nomads começou um pedido de parceria em seu nome, como combinado no atendimento. Entre (ou crie a conta) com este e-mail, confira os dados e confirme o envio.`, cta: "Completar o pedido", path: "/parceiros?seja=1#quero-ser-parceiro" },
  parceria_equipe: { subject: "Pedido de parceria para analisar", body: () => "Há um pedido de parceria aguardando a equipe. Confira a ficha, o checklist e decida pelo painel.", cta: "Abrir parceiros", path: "/admin/parceiros" },
  parceiro_pedido_novo: { subject: "Novo pedido de orçamento", body: (n) => `Olá${n ? " " + n : ""}, você recebeu um pedido de orçamento pela Viva Nomads. Veja o que a pessoa precisa e responda pelas mensagens da plataforma.`, cta: "Ver o pedido", path: "/dashboard/parceiro" },
  parceiro_orcamento_recebido: { subject: "Você recebeu um orçamento", body: (n) => `Olá${n ? " " + n : ""}, o parceiro enviou o orçamento do seu pedido. Confira o valor e aceite ou recuse pela plataforma.`, cta: "Ver o orçamento", path: "/dashboard/servicos" },
  parceiro_pedido_recusado: { subject: "O parceiro recusou o seu pedido", body: (n) => `Olá${n ? " " + n : ""}, o parceiro recusou o seu pedido de serviço. Você pode pedir a outro parceiro pela plataforma.`, cta: "Pedir a outro parceiro", path: "/parceiros/buscar" },
  parceiro_orcamento_aceito: { subject: "Seu orçamento foi aceito", body: (n) => `Boa notícia${n ? ", " + n : ""}! O cliente aceitou o seu orçamento. Confirme o horário pelo pedido.`, cta: "Confirmar o horário", path: "/dashboard/parceiro" },
  parceiro_horario_confirmado: { subject: "Horário do serviço confirmado", body: (n) => `Olá${n ? " " + n : ""}, o horário do serviço está confirmado. Os detalhes estão no pedido.`, cta: "Ver o pedido", path: "/dashboard/servicos" },
  parceiro_lembrete: { subject: "Lembrete: o serviço está chegando", body: (n) => `Olá${n ? " " + n : ""}, o serviço combinado pela Viva Nomads está marcado para as próximas horas. Os detalhes estão no pedido.`, cta: "Ver o pedido", path: "/dashboard/servicos" },
  parceiro_entrega_feita: { subject: "O parceiro marcou a entrega", body: (n) => `Olá${n ? " " + n : ""}, o parceiro marcou o serviço como entregue. Confira e confirme a conclusão pelo pedido.`, cta: "Conferir a entrega", path: "/dashboard/servicos" },
  parceiro_conclusao_pendente: { subject: "Confirme a conclusão do serviço", body: (n) => `Olá${n ? " " + n : ""}, o parceiro marcou a entrega há 7 dias. Se está tudo certo, confirme a conclusão; se não, fale com ele pelas mensagens do pedido.`, cta: "Abrir o pedido", path: "/dashboard/servicos" },
  parceiro_avaliacao: { subject: "Conte como foi o serviço", body: (n) => `Olá${n ? " " + n : ""}, o serviço foi concluído. A sua avaliação ajuda outras pessoas e só aparece depois que as duas partes avaliarem.`, cta: "Avaliar", path: "/dashboard/servicos" },
  estadia_convite_ocupante: { subject: "Você foi incluído em uma estadia na Viva", body: () => "O morador incluiu você na estadia. Entre com este e-mail para ver as datas, o endereço e, perto da entrada, as instruções de chegada.", cta: "Ver a estadia", path: "/auth" },
  estadia_instrucoes_liberadas: { subject: "As instruções de chegada estão liberadas", body: (n) => `Olá${n ? " " + n : ""}, a sua entrada está chegando. Como entrar, o Wi-Fi e as regras do prédio já estão na página da estadia.`, cta: "Ver as instruções", path: "/dashboard/locacoes" },
  estadia_instrucoes_pendentes: { subject: "Preencha as instruções de chegada", body: (n) => `Olá${n ? " " + n : ""}, a entrada do morador é daqui a 10 dias. Preencha as instruções de chegada do imóvel: o morador recebe 7 dias antes.`, cta: "Preencher as instruções", path: "/dashboard/contratos" },
  estadia_aditivo_proposto: { subject: "Proposta de alteração da estadia", body: (n) => `Olá${n ? " " + n : ""}, a outra parte propôs uma alteração no contrato. Confira o que muda e aceite ou recuse em até 7 dias.`, cta: "Ver a proposta", path: "/dashboard/contratos" },
  estadia_aditivo_respondido: { subject: "Sua proposta de alteração foi respondida", body: (n) => `Olá${n ? " " + n : ""}, a outra parte respondeu à sua proposta de alteração. Veja a resposta na página da estadia.`, cta: "Ver a resposta", path: "/dashboard/contratos" },
  estadia_remarcada: { subject: "O aditivo foi assinado", body: (n) => `Olá${n ? " " + n : ""}, o aditivo foi assinado pelas duas partes. As datas e os blocos do contrato já estão atualizados na página da estadia.`, cta: "Ver a estadia", path: "/dashboard/contratos" },
  estadia_encerramento_pedido: { subject: "Pedido de encerramento do contrato", body: (n) => `Olá${n ? " " + n : ""}, a outra parte pediu o encerramento do contrato. A Viva recebeu o pedido e vai conduzir o encerramento com vocês.`, cta: "Ver a estadia", path: "/dashboard/contratos" },
  estadia_encerramento_equipe: { subject: "Novo pedido de encerramento", body: () => "Uma das partes pediu o encerramento de um contrato. O pedido está na fila de encerramentos.", cta: "Abrir a fila", path: "/admin/contratos/encerramentos" },
  vinculo_parceiro_convite: { subject: "Convite para parceiro fixo de um imóvel", body: (n) => `Olá${n ? " " + n : ""}, um proprietário quer você como parceiro fixo do imóvel dele. Os pedidos chegam a cada saída de morador, e você aceita ou recusa cada um.`, cta: "Ver o convite", path: "/dashboard/parceiro" },
  foto_perfil_removida: { subject: "A foto do seu perfil foi removida", body: (n) => `Olá${n ? " " + n : ""}, a equipe da Viva Nomads removeu a foto do seu perfil. A foto do perfil precisa ser o seu rosto. Você pode enviar outra foto quando quiser.`, cta: "Enviar outra foto", path: "/dashboard/conta/perfil" },
  parceiro_selo_nota_removido: { subject: "O selo de nota fiscal saiu da sua página", body: (n) => `Olá${n ? " " + n : ""}, uma denúncia de que a nota fiscal declarada não foi emitida foi considerada procedente pela equipe. O selo "Emite nota fiscal" saiu da sua página e da busca. O motivo está no seu painel; para revisar, fale com a Viva pela Central de Ajuda.`, cta: "Abrir o meu painel", path: "/dashboard/parceiro" },
  vinculo_parceiro_resposta: { subject: "O parceiro respondeu ao seu convite", body: (n) => `Olá${n ? " " + n : ""}, o parceiro respondeu ao convite para o seu imóvel. Veja a resposta em Parceiros do imóvel.`, cta: "Ver a resposta", path: "/dashboard/imoveis" },
  pedido_auto_confirmar: { subject: "Confirme o pedido de serviço do imóvel", body: (n) => `Olá${n ? " " + n : ""}, a Viva preparou um pedido para o parceiro fixo do seu imóvel. Confira o valor-base e confirme com 1 toque.`, cta: "Confirmar o pedido", path: "/dashboard/servicos" },
  pedido_auto_sem_resposta: { subject: "O parceiro ainda não respondeu", body: (n) => `Olá${n ? " " + n : ""}, o parceiro não respondeu ao pedido em 24 horas. Você pode esperar ou trocar de parceiro com 1 toque.`, cta: "Ver o pedido", path: "/dashboard/servicos" },
  pedido_auto_atualizado: { subject: "O pedido mudou de data", body: (n) => `Olá${n ? " " + n : ""}, a estadia foi remarcada e a janela do serviço mudou. Confira as novas datas no pedido.`, cta: "Ver o pedido", path: "/dashboard/parceiro" },
  pedido_auto_cancelado: { subject: "Pedido cancelado", body: (n) => `Olá${n ? " " + n : ""}, o contrato do imóvel foi encerrado e o pedido foi cancelado. Nada a fazer.`, cta: "Ver os pedidos", path: "/dashboard/parceiro" },
  saida_sem_parceiro: { subject: "Saída em 5 dias: quer agendar a limpeza?", body: (n) => `Olá${n ? " " + n : ""}, o morador sai em 5 dias e o imóvel não tem limpeza fixa. Peça um orçamento a um parceiro da cidade.`, cta: "Buscar limpeza", path: "/parceiros/buscar?categoria=limpeza" },
  internet_remedir: { subject: "Meça de novo a internet do seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, a medição da internet do seu imóvel vence em cerca de 2 semanas. Meça de novo, conectado ao Wi-Fi do imóvel, para o anúncio continuar mostrando o número.`, cta: "Medir a internet", path: "/dashboard/imoveis" },
  vistoria_designada: { subject: "Nova avaliação de imóvel designada a você", body: (n) => `Olá${n ? " " + n : ""}, a Viva designou você para avaliar um imóvel. Aceite ou recuse em até 24 horas; sem resposta, a avaliação passa ao próximo avaliador.`, cta: "Responder", path: "/dashboard/parceiro/avaliacao" },
  vistoria_designado_dono: { subject: "O avaliador do seu imóvel foi designado", body: (n) => `Olá${n ? " " + n : ""}, a Viva designou o avaliador credenciado do seu imóvel. Combine a data da visita pelas mensagens da Viva.`, cta: "Ver a avaliação", path: "/dashboard/imoveis" },
  vistoria_agendada: { subject: "Visita de avaliação agendada", body: (n) => `Olá${n ? " " + n : ""}, a visita de avaliação do imóvel está agendada. Reagendar sem custo: uma vez, com pelo menos 24 horas de aviso.`, cta: "Ver a visita", path: "/dashboard/imoveis" },
  vistoria_concordancia: { subject: "Concorda com a visita de avaliação?", body: (n) => `Olá${n ? " " + n : ""}, o proprietário pediu a avaliação do imóvel onde você mora. A visita só acontece se você concordar com a data. O avaliador não fotografa os seus pertences.`, cta: "Responder", path: "/dashboard/locacoes" },
  vistoria_lembrete: { subject: "A visita de avaliação é amanhã", body: (n) => `Olá${n ? " " + n : ""}, a visita de avaliação do imóvel é amanhã. Se precisar mudar, avise pelas mensagens da Viva.`, cta: "Ver a visita", path: "/dashboard" },
  vistoria_ausencia: { subject: "Ausência na visita de avaliação", body: (n) => `Olá${n ? " " + n : ""}, a visita de avaliação não aconteceu por ausência. Veja o que acontece agora na página da avaliação.`, cta: "Ver a avaliação", path: "/dashboard" },
  calendario_conflito: { subject: "Datas do outro site cruzam um compromisso na Viva", body: (n) => `Olá${n ? " " + n : ""}, o calendário importado marcou como ocupadas datas em que o seu imóvel tem um compromisso na Viva. Nada foi cancelado: confira as datas e decida qual vale.`, cta: "Ver o calendário", path: "/dashboard/imoveis" },
  calendario_falha: { subject: "Não conseguimos ler o calendário importado", body: (n) => `Olá${n ? " " + n : ""}, tentamos ler o link do calendário do outro site 3 vezes seguidas, sem sucesso. Enquanto isso, as datas de lá não chegam aqui.`, cta: "Ver o calendário", path: "/dashboard/imoveis" },
  linkedin_vencendo: { subject: "Reconecte seu LinkedIn para manter o selo", body: (n) => `Olá${n ? " " + n : ""}, o selo "LinkedIn conectado" da sua conta vence em 30 dias. Para manter o selo, reconecte o LinkedIn em Conta.`, cta: "Reconectar", path: "/dashboard/conta" },
  linkedin_ja_conectado: { subject: "LinkedIn já conectado a outra conta", body: () => "Uma conta tentou conectar um LinkedIn que já está ligado a outra conta da Viva. A tentativa foi recusada; vale conferir se é a mesma pessoa com duas contas.", cta: "Abrir o atendimento", path: "/admin/atendimento" },
  vistoria_sem_avaliador: { subject: "Avaliação sem avaliador elegível", body: () => "Um pedido de avaliação de imóvel está aguardando avaliador: ninguém da fila da cidade está elegível agora.", cta: "Abrir a fila", path: "/admin/avaliadores" },
  vistoria_laudo_emitido: { subject: "O laudo de avaliação do seu imóvel saiu", body: (n) => `Olá${n ? " " + n : ""}, o laudo de avaliação do seu imóvel foi emitido pela Viva. Veja o resultado, o que corrigir (se houver), o prazo e o próximo passo.`, cta: "Ver o laudo", path: "/dashboard/imoveis" },
  vistoria_fora_da_busca: { subject: "Seu anúncio saiu da busca por um item de segurança", body: (n) => `Olá${n ? " " + n : ""}, a avaliação encontrou um item de segurança não conforme. O anúncio fica fora da busca até a correção ser comprovada; veja no laudo o que corrigir.`, cta: "Ver o que corrigir", path: "/dashboard/imoveis" },
  vistoria_ressalva_vencida: { subject: "O prazo da ressalva terminou", body: (n) => `Olá${n ? " " + n : ""}, o prazo de 15 dias para corrigir as ressalvas do laudo terminou sem a correção. Veja o que acontece agora e peça uma nova avaliação.`, cta: "Pedir nova avaliação", path: "/dashboard/imoveis" },
  vistoria_vistoriado_expira: { subject: "A confirmação do nível do seu anúncio vence em 30 dias", body: (n) => `Olá${n ? " " + n : ""}, o laudo do seu imóvel completa 12 meses em 30 dias e o nível deixa de aparecer como confirmado por avaliador no dia. Peça uma nova avaliação para manter.`, cta: "Pedir nova avaliação", path: "/dashboard/imoveis" },
  vistoria_strike: { subject: "Registro da verificação do seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, a verificação do seu imóvel gerou um registro. Veja o passo em que você está, o que muda no anúncio e como voltar com uma nova avaliação aprovada.`, cta: "Ver o próximo passo", path: "/dashboard/imoveis" },
  vistoria_verificacao: { subject: "A Viva abriu uma verificação do seu imóvel", body: (n) => `Olá${n ? " " + n : ""}, a Viva abriu uma verificação do estado do seu imóvel, com o motivo descrito na página da avaliação. Um avaliador credenciado vai combinar a visita.`, cta: "Ver a verificação", path: "/dashboard/imoveis" },
  vistoria_devolucao: { subject: "Devolução ao proprietário: contestação procedente", body: (n) => `Olá${n ? " " + n : ""}, a 2ª avaliação deu razão ao proprietário. Pela regra da contestação, devolva a ele o valor pago pela 2ª avaliação em até 15 dias; ele confirma o recebimento na plataforma.`, cta: "Ver a devolução", path: "/dashboard/parceiro/avaliacao" },
  vistoria_correcao_enviada: { subject: "O proprietário enviou a correção da ressalva", body: (n) => `Olá${n ? " " + n : ""}, o proprietário enviou a foto da correção de uma ressalva do laudo. Confira para a plataforma emitir a nova versão.`, cta: "Conferir a correção", path: "/dashboard/parceiro/avaliacao" },
  vistoria_fila_admin: { subject: "Novo item na fila da avaliação de imóveis", body: () => "Há um item novo na fila da avaliação de imóveis (laudo atrasado, ressalva vencida ou devolução vencida).", cta: "Abrir a fila", path: "/admin/avaliadores" },
  internet_abaixo_medida: { subject: "A internet medida pelo morador ficou abaixo", body: (n) => `Olá${n ? " " + n : ""}, o morador mediu a internet na entrada e o resultado ficou abaixo da metade da sua última medição. Vale conferir o roteador ou a operadora e medir de novo.`, cta: "Ver o imóvel", path: "/dashboard/imoveis" },
  sugestao_parceiros_morador: { subject: "Precisa de ajuda com a mudança?", body: (n) => `Olá${n ? " " + n : ""}, separamos parceiros da cidade para a sua mudança. Peça um orçamento se quiser: nada é contratado sem você.`, cta: "Ver os parceiros", path: "/dashboard/locacoes" },
  documento_recebido: { subject: "Novo documento de imóvel para conferir", body: () => "Um proprietário enviou a documentação do imóvel. Há um item aguardando conferência na fila de moderação.", cta: "Conferir documento", path: "/admin/documentos" },
};
