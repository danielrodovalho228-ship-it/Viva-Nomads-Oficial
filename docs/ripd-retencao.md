# RIPD — retenção e eliminação de dados pessoais (Prompt 58, fase 1)

Trecho do Relatório de Impacto à Proteção de Dados sobre **quanto tempo** a Viva Nomads guarda cada dado e **como**
ele sai. A Viva só intermedeia: não guarda dinheiro de ninguém.

## Regra

Todo dado pessoal guardado tem finalidade, prazo e gatilho de eliminação escritos. Guardamos o **veredito**, não o
material bruto: depois da conferência, o documento sai e fica a decisão (aprovado ou recusado, motivo, data e quem
decidiu).

O inventário completo está em `src/config/retencao.ts` e na tela do admin **Dados e retenção** (`/admin/retencao`).
Ele lista cada tabela e cada bucket com dado pessoal. Um teste automático impede que entre tabela ou bucket novo sem
uma entrada no inventário.

## O que já sai de verdade (fase 1)

| Dado | Sai quando | O que fica |
|---|---|---|
| Documentos da candidatura recusada (identidade, renda, vínculo) | 30 dias † depois da recusa | veredito do lead, tipo e data do envio |
| Documento do imóvel enviado em /qualificar | 30 dias † depois da decisão da equipe | veredito e referência |
| Matrícula e documento do caso especial | 30 dias † depois da revisão | veredito e campos conferidos |
| Fotos do anúncio | quando o anúncio é removido, ou na hora em que o dono tira a foto | o hash da foto (antifraude) |

† Prazo proposto pela Viva, sem depender do parecer jurídico.

Documentos de candidatura **aceita** seguem para a fase 2, com o gatilho de fim da estadia.

## O que ainda roda em modo simulado

Os itens com prazo "pendente – item 13" (mensagens, vistoria, dados da estadia) aguardam o parecer da Dra. Beatriz.
Até lá, a rotina diária só **conta** o que sairia ("o que seria apagado hoje") e não apaga nada. O relatório fica no
admin.

## Como a eliminação é registrada

Cada eliminação real entra no **livro de eliminações** (`eliminacoes_registro`) com origem, referência, tipo, motivo
(prazo, pedido do titular ou decisão) e data. O conteúdo eliminado **nunca** vai ao livro. Contas de teste ficam
marcadas e são contadas à parte.

Texto para o titular e para o RIPD:

> Eliminado do banco na data X; cópias de segurança criptografadas expiram em até ~90 dias.

## Cópias de segurança

As cópias são cifradas antes de sair do servidor e seguem a retenção 14/8/3: 14 diárias, 8 semanais e 3 mensais.
Arquivos trocados ou apagados ficam até 30 dias na pasta de removidos. Por isso, uma cópia expira em até ~90 dias.

Quando uma cópia é restaurada, o livro é **reaplicado**: o que já tinha sido eliminado sai de novo. O teste de
restauração de domingo faz isso sozinho e fica vermelho se algum item eliminado voltar.

## Metadados das imagens

Toda imagem enviada passa por uma reconversão no servidor antes de ser guardada. Isso remove EXIF e GPS: fotos do
anúncio, entregas de parceiros, documentos, anexos do atendimento e fotos de parceiros.

## Exceções e pontos em aberto

- **Hash das fotos do anúncio:** fica depois da remoção do anúncio, para reconhecer a mesma foto num anúncio falso.
  É só um número de 16 dígitos: não reconstrói a imagem.
- **Verificação de identidade (CAF):** a Viva guarda só o resultado (identidade, documento, prova de vida), nunca as
  imagens.
- **Coordenadas:** o endereço de trabalho digitado (Prompt 37) é guardado como ponto no mapa na conta e no pedido de
  moradia, para calcular o tempo até o trabalho. O ponto do parceiro é a base de atendimento. Os prazos desses dados
  entram com o item 13.
- **Exclusão da conta:** a anonimização de hoje ainda deixa CPF, mensagens e arquivos para trás. Isso fica para a
  fase 2.
- **Chat:** um aviso fixo pede que ninguém envie documentos pelo chat. Os dados de ocupantes vão pela página da
  estadia.
