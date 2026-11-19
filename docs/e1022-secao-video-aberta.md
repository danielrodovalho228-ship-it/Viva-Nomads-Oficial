# E1022 — a seção Vídeo do editor segue aberta depois de gravar o arquivo (t321 caso 1)

## Sintoma (run 44114328109, fatia 10/25, 17/11)
`locator.click: Timeout 20000ms` em "Salvar seção" da seção Vídeo: "element was detached from the DOM".

## Causa
A seção do editor abre pelo endereço (`#secao-video`, o "Para melhorar: Vídeo"). A gravação do arquivo é uma ação do
servidor com `revalidatePath` do editor. Quando a resposta volta, o endereço é reescrito sem o `#secao-video`.
A abertura vinha só do hash: o elemento da seção é o mesmo (não remonta), mas `data-aberta` passa a `false` e o
"Salvar seção" some. Sob carga, a resposta chega depois de o teste ver a seção aberta → o botão some debaixo do clique.

Prova (lab, main cace1911d): uma marca no elemento sobrevive à resposta (não remonta) e o endereço passa de
`…/editar#secao-video` para `…/editar`, com `data-aberta` de `true` para `false`.

## Correção
`Section` (`src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx`) guarda que abriu pelo endereço e
segue aberta quando o hash sai. O dono ainda fecha e abre pelo cabeçalho como antes.

## Trava — t321 caso 1
O "abre de novo se fechou" do teste saiu. Depois da gravação ("Salvo" no cabeçalho e a rede assentada), a seção tem de
estar aberta.

| Onde | Resultado |
|---|---|
| main cace1911d, lab, caso 1 `--repeat-each=5`, sem retry | 5 de 5 vermelhos em "E1022: a seção do vídeo segue aberta depois da gravação" |
| ramo, lab, t321 completo `--repeat-each=3`, sem retry | 15 passed |
| npm test | 7796 pass, 0 fail; guardas do laboratório 266/0 |

## Quarentena
As 5 entradas do t321 (E1022: o caso 1 e a cadeia dos casos 2–5) saem neste PR. A guarda das cadeias
(`e744-t2-quarentena.test.ts`) passa a esperar só a do t230 (E1020).
