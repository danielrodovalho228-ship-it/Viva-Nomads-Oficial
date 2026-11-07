# E682 — escolha do avaliador pelo dono: reconciliação e o que faltava

## Reconciliação ("a tela já existe em parte" × "ausência provada")
A tela NÃO falta; ela está construída (E648 parte 1, migração 0313) e **escondida pela chave `VISTORIA_ATIVA` desligada**:
- `BlocoAvaliacaoDono` (em `/dashboard/imoveis/[id]/nivel` e `/dashboard/avaliacao-imovel/[id]`): "Pedir avaliação" → lista dos avaliadores que a Viva SUGERE (`sugerirAvaliadores`, só ativos da cidade, com os impedimentos de independência) → "Escolher este avaliador" (`escolherAvaliador`).
- O avaliador escolhido responde (`proporPrecoEPrazo` ou `responderDesignacao` "recusar"); recusa, silêncio ou proposta recusada pelo dono voltam o pedido ao dono (`devolverAoDono`, **sem rodízio**); o dono aceita (`aceitarProposta`).
- O laudo é emitido e ASSINADO pelo avaliador (`enviarLaudo` com a caixa "assino"; `assinaturaDoLaudo` grava `assinado_por`, `assinado_em`, `assinatura_hash`, `assinatura_termo`).
- Com a chave desligada, o dono real não vê nada e a conta de teste vê o bloco só em leitura ("as ações não rodam"): por isso a QA não "achou" a tela nos caminhos do dono. No laboratório a chave liga por cookie (`vn_lab_vistoria`), nunca em produção.
Nada foi duplicado.

## O que de fato faltava (e agora existe)
1. A lista mostrava só nome e número. Agora cada avaliador aparece com **valor, prazo de entrega, prazo de resposta e a conduta publicada** (`linhaDeTermos`), dentro do mesmo bloco.
2. O avaliador **declara os próprios termos** no painel dele ("Meus termos", `salvarMeusTermos`): migração aditiva **0325** (3 colunas opcionais em `avaliadores_credenciamento`). Quem não declarou continua escolhível ("ele informa ao responder"), como no E648.
3. O prazo para responder passa a ser o que **o avaliador declarou** (padrão 24 h): `designacaoVencida(…, horas)` e a rotina do cron. Vencido → volta ao dono.
A reputação vem de `avaliadores_publicos()`: só a conduta já PUBLICADA (às cegas; depende da 0324 do E679 para valer só o publicado).

## Fora do escopo / dúvida
- "Vistoria de disputa de caução": não existe esse caminho em `vistoria_pedidos` (tipos: inicial, verificação, nova avaliação, contestação); não foi criado aqui. Se for pedido, é outro desenho.
- Tudo atrás de `VISTORIA_ATIVA` (desligada). Sem prova ao vivo.

# E691 — assinatura do laudo visível
O servidor já assinava (E648). O painel do avaliador JÁ tem onde assinar (caixa "assino" em "Revisar e enviar o laudo"). O que faltava era **mostrar** o número e o hash depois: agora o painel do avaliador e o laudo do dono mostram "Assinado pelo avaliador em dd/mm/aaaa · laudo VIS-… · registro `abcd1234…ef567890`" (o hash completo no `title`). Sem hash válido, nada é mostrado.

# E687 — não alterado
A categoria **Mudança** já é própria: `CATEGORIAS_PARCEIRO` tem "mudanca"; o cadastro pede empresa e veículo (`validarSolicitacao`, `dadosCategoria`); `/parceiros` tem os links "Atender mudança" e "Procurar mudança". Não achei o ponto em que ela "cai em Outro serviço"; preciso do caminho exato (tela e URL) para corrigir sem chutar.

## Refino: completar a E648 parte 1 (sem refazer a tela)

1. **Lista**: cada avaliador mostra conduta e "N avaliações feitas" (dados públicos de `avaliadores_publicos()`).
2. **Prazo do dono**: `PRAZO_DONO_ACEITAR_HORAS = 72` (**confirmado pelo Daniel em 07/11/2026**). Proposta sem aceite em 72 h volta ao dono (cron, `propostaVencida`); a tela mostra o prazo.
3. **Silêncio do avaliador**: o código já devolvia ao dono (`devolverAoDono`, sem rodízio); só os comentários diziam "passa ao próximo". Textos corrigidos; a tela usa o prazo declarado pelo avaliador (padrão 24 h).
4. **Avisos**: avaliador ao ser escolhido (`vistoria_designada`, "no prazo que você declarou"); dono na recusa, no silêncio e no vencimento do próprio prazo (`vistoria_designado_dono`, e-mail e sino).
5. **Chave desligada**: teste de guarda prova que o bloco retorna `null` antes de qualquer leitura (conta real) e que as ações do dono recusam.

Teste: `src/lib/vistoria/e682-completar-e648.test.ts`.

## Prova de renderização com a chave desligada (refino 2)

`src/components/vistoria/bloco-avaliacao-dono.render.test.ts` carrega o `.tsx` REAL do bloco no `node --test` e o renderiza com `react-dom/server`. Só as bordas são dublês (`render-harness/loader.mjs`): Supabase (banco falso em memória), a chave `vistoriaAtiva()` (valor posto pelo teste, nunca no código do produto), as ações e a UI de terceiros. Nada de produção, nada ao vivo; `AUTOMACOES_ATIVO` e `PRAZO_DONO_ACEITAR_HORAS` (72 h, a confirmar) intactos.

| Caso | Resultado provado |
| --- | --- |
| Chave off + conta real | O bloco devolve `null` (HTML vazio) e NENHUMA leitura de avaliador acontece (nem `avaliadores_credenciamento`, nem `avaliadores_publicos`, nem a lista de sugeridos): nome e número do avaliador não vazam. |
| Chave off + conta de teste | Só leitura (faixa "Conta de teste"), sem lista de avaliadores, sem botão Escolher, sem pedir a lista. |
| Chave on (controle) | A lista aparece com "conduta 4,5 · 7 avaliações feitas" e o botão Escolher: o teste não passa por estar vazio. |

Verificado por mutação: trocando `if (!visivel) return null;` por `if (false) ...`, o caso 1 fica vermelho (revertido).
