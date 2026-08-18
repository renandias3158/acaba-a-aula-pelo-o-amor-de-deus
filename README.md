# IFPE Career AI • GitHub Pages

Protótipo **baixo nível** para o projeto dos quatro eixos.

## Estrutura

```text
index.html
style.css
app.js
.nojekyll
README.md
```

Não usa Python, Node, React, FastAPI ou banco externo.

## Publicar no GitHub Pages

1. Crie um repositório.
2. Envie os arquivos deste diretório para a raiz.
3. Vá em **Settings → Pages**.
4. Selecione **Deploy from a branch**.
5. Escolha `main` e `/ (root)`.
6. Salve.

## Gemini

A página chama diretamente o endpoint REST `models.generateContent`.
A chave é digitada pelo usuário e mantida somente em `sessionStorage`
durante a sessão do navegador.

**Não coloque sua chave dentro de `app.js`, HTML, Git ou GitHub Pages.**

Para uma aplicação pública real, a recomendação é colocar um proxy/backend
entre a página e a API Gemini. O frontend estático pode continuar sendo
hospedado pelo GitHub Pages.

## Dados de egressos

O eixo 4 usa `localStorage` somente para demonstrar a lógica no protótipo.
Não é banco de produção.

## Desenvolvimento

Abra `index.html` com um servidor local para testar:

```bash
python -m http.server 8000
```

Depois acesse `http://localhost:8000`.

