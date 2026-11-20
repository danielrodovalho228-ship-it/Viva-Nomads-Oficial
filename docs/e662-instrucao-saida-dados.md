# E662 (parte Pista B) — dados da instrução ÚNICA de saída (migração 0320)

**Pedido:** uma instrução de check-out por contrato, escrita pelo dono e mostrada IGUAL ao morador e ao dono; as telas são da Pista A (proposta no #3088).
**O que a Pista B entrega aqui:** a migração, a regra de leitura e a cópia no contrato. Nenhuma tela.

## Onde fica o texto (um desvio da proposta, com motivo)
O #3088 propôs `properties.instrucao_saida`. **`properties` é a tabela que o visitante lê** na página pública do anúncio (colunas liberadas por grant); um texto de saída (chaves, fechadura, regra do condomínio) não pode ir para lá. O texto do dono fica em **`imovel_instrucoes_chegada.instrucao_saida`**, a tabela PRIVADA das instruções da estadia (RLS "só o dono"; o morador a recebe pelo servidor, liberada 7 dias antes da entrada), a mesma que já tem "como entrar", Wi-Fi etc. A cópia por contrato fica em **`contratos.instrucao_saida`**.

## O que muda
- **Migração 0320** (aditiva, `aplicar-0320.sql` idempotente + rollback): duas colunas `text` nulas, limite de 1500 caracteres. Sem grant novo (lidas e gravadas só pelo servidor e pelo dono).
- **Leitura única** (`src/lib/estadia/instrucao-saida.ts`): contrato primeiro, imóvel como reserva (contrato anterior à coluna ou sem cópia). O guia da estadia (`lerInstrucoes`) já devolve esse texto igual para morador e dono.
- **Campo nas instruções da estadia:** `instrucao_saida` entra em `CAMPOS_INSTRUCOES` ("Como sair (check-out)"). O editor do dono, a leitura do morador/convidado e o e-mail de chegada já o mostram. A Pista A pode agrupá-lo como quiser e escrever o campo do dono (cartão do assistente).
- **Cópia na 1ª assinatura:** `congelarInstrucaoSaida` copia o texto do imóvel para o contrato, uma vez só, junto do congelamento das regras de pets. Melhor esforço: a assinatura nunca depende dela.

## Para a Pista A
Falta só a tela (campo do dono, bloco único de saída no guia, lembretes no checklist). O dado e a leitura única existem. Os lembretes "bateria da fechadura" e "imóvel liberado" são texto de checklist (não precisam de coluna).

## Ordem de migrações
0314 (E647), 0315 (E657), 0316 (E660), 0317 (#3133), 0318 (#3134), 0319 (#3135), 0320 (este).

## Testes
`src/lib/estadia/instrucao-saida.test.ts`.
