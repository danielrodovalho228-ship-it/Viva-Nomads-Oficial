# E744 — auditoria da triagem: os 32 defeitos reais têm item E com dono?

Pedido do Gerente (ronda de 16/11, 05:08Z): cada uma das 32 specs classificadas como "defeito real" em
`docs/e744-classificacao-96-specs.md` tem de mapear para um item E com dono. As que não tiverem ficam listadas aqui
para o Gerente registrar e atribuir.

**De onde saiu o mapeamento.** Não leio a lista-master. Usei: os números que o Gerente me passou pelo Duet (E953,
E960, E961, E975), os títulos dos 300 PRs mais recentes do repositório (do #3595, de 13/11, ao #3894) e os commits da
main desde 12/11. Um item que exista na lista-master sem PR e sem ter sido citado para mim aparece aqui como "sem item
que eu veja": o Gerente confere contra a lista.

**Estado de cada spec:** a última rodada completa do laboratório registrada em `lab_execucoes` — a noturna de 15/11,
14:40 UTC, main `403858f7` (leitura de produção, só consulta).

## 1. Resumo

| Situação | Specs | Causas |
|---|---|---|
| Com item E e dono | 15 | 5 |
| Fecha sem item (voltou a verde, colateral do E931) | 1 | 1 |
| **Sem item que eu veja** | **13** | **9** |
| Visuais: correm dentro do E744, sem item próprio | 3 | 3 |
| **Total** | **32** | **18** |

## 2. Com item E e dono (15 specs)

| Causa | Specs | Item | Dono | PR | Noturna de 15/11 |
|---|---|---|---|---|---|
| Excluir rascunho falha sempre (`deleteProperty` lê `draft_data` pela sessão) | t281 | E953 | Code 2 | #3842, draft | vermelho |
| Chamados de exemplo no JavaScript do painel (falso sobrenome no fio do pré-aceite) | t11 | E975 | Code 2 | #3888, draft | vermelho |
| HTML de `/dashboard/leads` traz cartões com preço (a 404 viajava em todas as páginas) | t348 | E961 | Fable | #3857, draft | vermelho |
| Logo do cabeçalho público com alvo de toque de 32 px | t815 | E960 | Fable | #3855, draft | vermelho |
| E931 devolveu o flutuante à `/buscar` | t10, t244, t274, t368, t412, t419, t436, t732, t1405, t1426, t1451 | E931 (re-prova) | já corrigido | #3833, na main em 15/11 | **as 11 verdes** (t412 com 1 teste instável) |

## 3. Fecha sem item (1 spec)

| Spec | Por quê |
|---|---|
| t574 ("← Voltar aos resultados" coberto) | A triagem deixou o critério escrito: verde na main com o #3833 = colateral do E931. Na noturna de 15/11: 4 passaram, 0 falharam. |

## 4. Sem item que eu veja (13 specs, 9 causas) — para o Gerente registrar e atribuir

Todas vermelhas na noturna de 15/11, salvo indicação. A frase do defeito e a evidência de cada uma estão na seção 3 e na
tabela única da classificação. Nenhuma é da minha área.

| # | Título proposto | Specs | Área (dono sugerido) | Observação |
|---|---|---|---|---|
| 1 | Valores de demonstração (2.900) no JavaScript do painel de contas reais | t193 | painel — `src/lib/demo/seed.ts`, importado por 8 componentes de cliente (Code 2, junto do E975) | **O E975 não cobre.** O #3888 só tira os chamados de exemplo de `service-orders.ts`; os `valorMensal: 2900` e `monthlyPrice: 2900` ficam em `seed.ts` (linhas 112, 286 e 290). É a "Dúvida 1" do próprio #3888. |
| 2 | Nível do imóvel: desmarcar ou remarcar item que já tem foto não salva (upsert sem `foto_origem` bate na restrição da 0242) | t295 | níveis de conforto — página Nível do imóvel | |
| 3 | Qualidade: fechar a Correção abre outra igual na hora, com as mesmas saídas dos 30 dias | t316 | admin — Qualidade / Sair da Viva | nunca teve verde; pede decisão da regra |
| 4 | "Medir a internet agora" desabilitado sem motivo ligado ao botão (resto do E609) | t388 | medição de internet / conferência de entrada do contrato | acessibilidade |
| 5 | Anúncio publicado não mostra em Meus imóveis o aviso "Refaça a foto … até <data>" (colateral do E567) | t397 | Meus imóveis / prontidão do anúncio | o Gerente decide: se o E567 cobre o bloco todo, vira teste velho |
| 6 | Assistente: escolha por cartão ou pílula logo depois de abrir o rascunho não é gravada (o E516 só reconhece digitação) | t400, t456, t548, t697 e t389 | assistente de anúncio — autosave | 4 vermelhas; a t389 passou com 1 teste instável na noturna. Quem sai antes da próxima edição perde a escolha. |
| 7 | Espaço de trabalho (Conta): escolha feita enquanto a tela carrega é apagada pela leitura inicial e grava vazio | t590 | conta/perfil — Espaço de trabalho | nunca teve verde |
| 8 | Galeria aberta no computador: fotos 2–5 não reaproveitam a miniatura do mosaico (E262 regrediu com o E768) | t707 | página do imóvel — galeria | commit `f5ce7d86`, PR #3612 |
| 9 | Mapa da busca: pins de anúncios no mesmo ponto continuam sobrepostos depois do zoom out | t840 | busca — mapa | depende de dados de outros testes; medir no laboratório limpo |

## 5. Visuais (3 specs)

t245, t263 e t271 não têm item próprio: correm dentro do E744 (passo 4, pacote visual). Eu preparo os diffs e o
julgamento proposto (`docs/e744-pacote-visual.md`); o Gerente julga tela a tela. Se uma tela mostrar defeito de
produto, vira item pelo Gerente.

## 6. Candidatos fora das 32 que seguem sem item

A triagem já os citava como "não entram na contagem". Continuam sem item que eu veja:

- **t204 (instável):** Passo Fotos — soltar fotos durante um envio em andamento apaga o lote anterior
  (`src/components/photo-uploader.tsx`).
- **t14 e rotas da Conta (E798), minha área (`proxy.ts`):** cookie da largura desatualizado leva o primeiro
  carregamento de `/dashboard/conta` ao Perfil; e o proxy redireciona com 307 também as ações do servidor. Funcionam;
  são custo e um pedido cancelado quando a tela troca no meio.
