# E669 — "Anexar laudo independente" aceitava qualquer arquivo e não deixava remover

**Relato (lote 9):** na conferência de SAÍDA da estadia VN-CT-11281A61, um PDF de teste de 193 bytes foi aceito na hora, com o aviso de que o laudo "prevalece sobre as fotos"; a página não mostrava controle para remover ou trocar.
**Causa:** `validarLaudo` só olhava o tamanho máximo e os 4 primeiros bytes (`%PDF`). E a tabela `conferencia_laudos` é imutável por trigger (decisão antiga: "um por conferência; imutável"), sem nenhum caminho de retirada.

## O que muda
1. **Validação do arquivo** (`src/lib/conferencia.ts`, no servidor e no navegador): PDF de verdade = cabeçalho `%PDF` + fim `%%EOF` (nos últimos 1 KB) + **tamanho mínimo de 1 KB** (`LAUDO_MIN_BYTES`). Mensagens: "O arquivo é pequeno demais para ser um laudo…" e "Este PDF parece incompleto ou corrompido…". O máximo segue 15 MB.
2. **Remover e trocar pelo AUTOR** (`retirarLaudoConferencia` e `anexarLaudoConferencia` com `substituir=1`), só **enquanto a conferência está aberta**: quem anexou (`enviado_por`) é quem remove; a outra parte e a equipe não retiram por aqui. Ao trocar, o arquivo novo é validado e subido **antes** de retirar o antigo (arquivo recusado nunca apaga o laudo existente). Ao remover, as fotos voltam a valer.
3. **Registro:** cada retirada/troca grava uma linha em `conferencia_laudos_retirados` (caminho do PDF, parte, quem anexou e quando, quem retirou e quando, "retirado" ou "trocado"). O PDF retirado fica no bucket privado (é parte do registro). A tabela entra no inventário de retenção.
4. **Migração 0319:** a tabela acima e a função `trocar_laudo_conferencia` (security definer, só o servidor). Ela é a ÚNICA exceção à imutabilidade: abre uma marca de sessão (`viva.laudo_troca`) só dentro da própria transação; qualquer `update`/`delete` direto continua recusado. Registro + remoção + novo laudo acontecem juntos (atômico).
5. **Tela:** o autor vê "Remover laudo" (com confirmação) e "Trocar laudo"; quem não anexou não vê os controles; conferência travada (respondida) não mostra.

## O anexo de teste que ficou gravado
Se a conferência de saída da VN-CT-11281A61 ainda estiver ABERTA, quem anexou o PDF de 193 bytes (a conta de teste) o remove pelo botão novo, e o ato fica no registro. **Se ela já foi FECHADA**, nada muda depois do fechamento (regra do E640/fechamento): corrigir seria uma versão nova pela equipe, e isso é decisão do Daniel — não toquei no contrato nem no dado.

## Testes
`src/lib/e669-laudo-conferencia.test.ts` (validação com o PDF de 193 bytes, só-cabeçalho, PDF completo; ação só para o autor e com conferência aberta; tela; migração com a função só do servidor; inventário). Guardas antigos atualizados ao novo invariante: `conferencia.test` (fixture de PDF completo e 7 chamadas de `parteDoContrato`), mapa de cobertura (`retirarLaudoConferencia`).
