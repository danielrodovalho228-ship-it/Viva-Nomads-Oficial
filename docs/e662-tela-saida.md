# E662 — tela da instrução única de saída (Pista A, 07/11/2026)

Dados: migração 0320 e leitura única são da Pista B (#3149, na `main`). Esta parte é só tela e ação de gravação (sem migração).

**Dono — cadastro do imóvel:** na edição (`/dashboard/imoveis/[id]/editar`), seção "Como sair (check-out)" (`secao-instrucao-saida`): um campo de texto, até 1.500 caracteres, com a orientação "horário, o que deixar, onde e a quem devolver a chave; se o condomínio tem regra própria de devolução, escreva-a aqui, no mesmo texto". Grava só `imovel_instrucoes_chegada.instrucao_saida` (ação `salvarInstrucaoSaidaDoImovel`: só o dono, sessão dele, RLS repete a conferência). O contrato guarda a cópia na 1ª assinatura (B).

**Morador, dono e convidado — guia da estadia:** bloco próprio "Como sair (check-out)", logo depois de "Como entrar", o MESMO texto (contrato primeiro, imóvel de reserva), liberado 7 dias antes da entrada com o contrato assinado, como as demais instruções. No dia da saída, a mensagem programada padrão aponta para ele ("A instrução de saída e a conferência de saída estão na página da estadia").

**Dono — lembretes (não obrigações):** sob "Antes da entrada": bateria da fechadura, imóvel liberado e, se a instrução de saída ainda está vazia, escrevê-la. Ficam fora do checklist.

Testes: `e662-cadastro-saida.test.ts`, `e662-tela-saida.test.ts`, `e661-instrucoes-em-blocos.test.ts`.
