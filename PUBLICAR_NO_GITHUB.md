# Como fazer aparecer no seu GitHub usando só o celular

Se você entrou no seu repositório do GitHub e ele ainda está igual, é porque as alterações feitas aqui ainda precisam ser enviadas para o GitHub. Este ambiente de trabalho não tem um `remote` configurado, então ele consegue criar commits locais, mas não sabe para qual repositório online deve fazer `push`.

## Opção mais fácil pelo celular: aceitar/mesclar o PR

1. Abra o GitHub no navegador ou app do celular.
2. Entre na aba **Pull requests** do seu repositório.
3. Abra o PR criado para esta alteração.
4. Toque em **Merge pull request**.
5. Confirme em **Confirm merge**.
6. Volte para a aba **Code** do repositório.
7. Os arquivos novos devem aparecer: `index.html`, `game.js`, `styles.css`, `data/stages.json`, `manifest.webmanifest`, `sw.js` e `icon.svg`.

## Se não aparecer nenhum PR

Nesse caso, o GitHub ainda não recebeu estes arquivos. Você pode criar os arquivos manualmente pelo celular:

1. No repositório, toque em **Add file**.
2. Toque em **Create new file**.
3. Use exatamente os nomes dos arquivos do projeto.
4. Copie o conteúdo de cada arquivo.
5. Toque em **Commit changes**.

Arquivos necessários para o jogo funcionar:

- `index.html`
- `styles.css`
- `game.js`
- `data/stages.json`
- `manifest.webmanifest`
- `sw.js`
- `icon.svg`

## Depois que os arquivos aparecerem no GitHub

Ative o GitHub Pages grátis:

1. Abra **Settings** → **Pages**.
2. Em **Build and deployment**, escolha **Deploy from a branch**.
3. Escolha a branch principal e a pasta `/root`.
4. Salve.
5. Aguarde o GitHub mostrar o link do site.
6. Abra o link no navegador do celular e toque em **Jogar**.

## Por que isso aconteceu?

Commit local e GitHub online são coisas diferentes. Um commit local só existe neste ambiente até alguém fazer `push` para um repositório remoto ou até o PR ser realmente publicado/mesclado no GitHub.
