# E664 — Canal de emergência no dia da chegada

Aprovado pelo Daniel (07/11/2026). Sem migração.

## O que faz
Na conversa da plataforma, o morador vê o botão **"Falar com o proprietário agora"** SÓ no dia da entrada, em contrato ativo assinado pelas duas partes. Ao tocar:
1. registra uma mensagem na conversa ("Aviso urgente: cheguei ao imóvel e preciso falar agora…");
2. avisa o proprietário com urgência (evento `emergencia_chegada`: categoria segurança, sempre chega, push + sino crítico + e-mail);
3. responde ao morador que a Viva acompanha e que a resposta vem na conversa.

**Nenhum contato é mostrado nem trocado** (E444/E445 intactos): o servidor não lê telefone nem e-mail para isso (guarda no teste), e o texto não carrega número, e-mail nem canal de fora. O "plantão" do check-in antigo (`abrirChamado`) não foi tocado.

## Regras
- Só o morador do contrato (filtro `tenant_id = usuário` no servidor); o dono não vê o botão.
- Dia da entrada = primeira entrada dos blocos ATUAIS, em Brasília. Remarcou por aditivo (E652): vale a data nova (testado).
- Limite: 1 acionamento por contrato a cada 10 minutos (`dentroDoLimite`); dentro da espera, a tela diz para aguardar.
- Falha ao gravar/ler: erro visível ao morador; nada de aviso sem mensagem.

## Código
`src/lib/estadia/emergencia-chegada.ts` (puro) · `src/lib/data/emergencia-chegada-actions.ts` (servidor) · `src/components/estadia/emergencia-chegada.tsx` (botão) · `messages.ts` (`emergenciaChegadaContratoId` por conversa) · evento em `eventos-email.ts`, `matriz-notificacoes.ts`, `imagens-email.ts`, `avisos.ts`.

## Testes
`emergencia-chegada.test.ts` (regras, remarcação, textos sem contato, guardas do servidor, matriz, tela) escrito primeiro e visto vermelho. Módulos inteiros verdes: `src/lib/estadia`, `notifications`, `config`, `data`, `messages`, `mensagens`, `tests/laboratorio`; `tsc` limpo. Sem prova ao vivo; sem print (precisa de contrato com entrada hoje).

## Dúvidas
1. O dono recebe a resposta na mesma conversa; se ele não responder, não há escalonamento automático para a equipe da Viva (fora do escopo pedido). Posso propor em PR à parte.
2. Dia seguinte à entrada: o botão some (o check-in antigo "não consegui entrar" segue existindo na página do contrato).
