# O Marcado pela Penitência

A lore de Lourenzzo em forma de livro: capa de couro, páginas de pergaminho e um texto que se escreve enquanto você lê. Junto vem o prólogo jogável, o treino na floresta com Padre Quinn.

- `index.html`: o livro
- `jogo.html`: o prólogo jogável

## Como acrescentar um capítulo

1. Salve o texto em `capitulos/` no mesmo formato de `01-o-encontro.txt`: 1ª linha com o nome, 2ª linha com o título do capítulo e os parágrafos separados por uma linha em branco.
2. Acrescente o arquivo na lista `CAPITULOS`, no começo de `livro/livro.js`.

## Como criar uma nota clicável

Na lista `NOTAS` (também em `livro/livro.js`), acrescente um item com `trecho` escrito exatamente como aparece no texto. A primeira ocorrência desse trecho vira uma palavra marcada com ✠, e a nota passa a contar em "Anotações de Lourenzzo". Escreva as notas na voz do Lourenzzo, em primeira pessoa.

## Créditos

- Arte do Padre Quinn (`arte/`): fanart usada com permissão do artista.
- Fontes EB Garamond, Cinzel, IM Fell English e UnifrakturMaguntia, sob a SIL Open Font License.
