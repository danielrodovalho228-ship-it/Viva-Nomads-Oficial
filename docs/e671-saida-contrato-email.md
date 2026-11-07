# E671 — e-mails do contrato e telas com a mesma data de saída

**Relato (retomada do E652, 07/11):** os e-mails "Falta a sua assinatura" e "Contrato assinado pelas duas partes" diziam
"Período: 10/01/2027 a 11/03/2027 (2 meses)"; a página do contrato, a estadia e os calendários dizem saída 10/03/2027.

**Causa:** `linhasContrato` somava um dia ao fim gravado nos blocos (`saidaDepoisDaUltimaNoite`, E599). O fim gravado de
2 meses (60 dias, fim inclusivo) é 10/03; entrada + 60 dias é 11/03. As telas, o prazo da conferência de saída
(`prazoConferenciaSaida({ fim })`) e as automações usam o fim gravado.

**Correção:** o quadro do e-mail do contrato (pronto para assinar e assinado) imprime o fim gravado — a mesma data da página.
A proposta e a candidatura seguem com entrada + dias (E599). Teste: `src/lib/notifications/e671-saida-contrato.test.ts`;
o guarda do E599 passou a fixar o fim gravado para o contrato.

**Dúvida (Daniel):** o E599 tinha fixado o contrato em "dia seguinte à última noite". Troquei só o e-mail porque mover
todas as telas e o prazo da conferência de saída é mudança maior. Se preferir a saída como entrada + dias em todo lugar
(11/03), o caminho é mudar `textoSaida`, a linha do tempo da estadia e o prazo de saída, não o e-mail. Hoje a proposta
(entrada + dias) e o contrato (fim gravado) diferem em um dia nos contratos em dias exatos.
