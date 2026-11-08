# E293 — relatório de retenção de 08/11/2026 (só leitura em produção; nada apagado, nenhum prazo mudou)

Revisão das migrações 0313–0334 e conferência em produção **somente com leitura**. Última migração registrada em produção: `20261107000334`. A rotina `e293-limpeza-retencao` (0281) rodou com sucesso hoje (01h17 BRT).

## Tabela nova
| Tabela | Migração | O que guarda | Inventário | Linhas em produção |
|---|---|---|---|---|
| `conferencia_laudos_retirados` | 0319 (E669) | registro dos laudos retirados ou trocados pelo autor (caminho do PDF, quem, quando) | já consta em `src/config/retencao.ts` (conta, "a estadia") | 1 |

## Colunas novas com texto de pessoa (o inventário só descrevia a tabela; descrições corrigidas, sem mudar prazo)
| Tabela | Coluna(s) | Migração | Observação | Linhas com valor |
|---|---|---|---|---|
| `imovel_instrucoes_chegada` | `condominio_wifi_rede`, `condominio_wifi_senha`, `condominio_recepcao`, `condominio_fechadura`, `instrucao_saida` | 0317 (E661), 0320 (E662) | **a senha do Wi-Fi do condomínio fica em texto** (até 100 caracteres); tabela privada (só o dono; o morador recebe pelo servidor, liberada pela estadia) | 0 (a tabela está vazia) |
| `contratos` | `instrucao_saida` | 0320 (E662) | cópia da 1ª assinatura do texto de saída do dono; sai com o contrato | — |
| `parceiro_avaliacoes` | `notas_categorias`, `etiquetas`, `recomendaria`, `nota_privada_parte`, `nota_privada_viva` | 0323 (E679) | notas privadas nunca públicas; até 500 caracteres | 0 |
| `propostas` | `pre_aceitacao_*` | 0334 (E722) | só datas, contagem de reaberturas e marcas dos lembretes; nenhum texto de pessoa | 0 (chave `PRE_ACEITACAO_72H_ATIVA` desligada) |

As demais colunas das migrações do período (`escolhido_em`, `valor_proposto`, `reenviada_em`, `ficha_dentro`, `papel_ativo_escolhido_em`, `preco_proprio`, prazos do avaliador, `dados_categoria`) são datas, números ou campos que já constam no inventário; nenhuma guarda dado de documento, foto ou contato.

## O que fica para decisão (inalterado)
- Prazos de `conferencia_laudos_retirados`, `imovel_instrucoes_chegada` (senha do Wi-Fi do condomínio) e `parceiro_avaliacoes` (notas privadas) entram na lista de decisões do item 13 (parecer da Dra. Beatriz).
- Sugestão (não executada): como a senha do Wi-Fi é credencial de terceiros, avaliar guardá-la cifrada ou apagá-la no fim da estadia.

Guarda: `src/lib/minimizacao/inventario.test.ts` segue verde (toda coluna jsonb classificada; as três descrições acima só mudaram de texto).
