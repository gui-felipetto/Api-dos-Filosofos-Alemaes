# API dos Filósofos Alemães

API pública de consulta de pensadores da tradição filosófica e social alemã. A página inicial é um **console para consumir e experimentar a API**: os registros são consultados via HTTP, sem uma cópia do catálogo no JavaScript do navegador.

O catálogo inicial contém 14 autores. Os resumos são introdutórios, em português, e cada registro oferece uma fonte da Stanford Encyclopedia of Philosophy. As correntes são classificações editoriais, não uma descrição completa do pensamento de cada autor. Max Weber foi mantido pelo seu papel na teoria social e na reflexão sobre a modernidade.

O repositório informa o domínio [api-dos-filosofos-alemaes.vercel.app](https://api-dos-filosofos-alemaes.vercel.app/). As melhorias desta revisão precisam de um novo deployment para aparecer nesse endereço.

## Executar localmente

Requer Node.js 24 e npm. Não precisa de banco de dados, chave de API nem arquivo `.env`.

```sh
npm ci
npm start
```

Abra `http://localhost:3000`. A API fica em `http://localhost:3000/api`.

```sh
npm run dev    # reinicia o servidor quando o código muda
npm run check  # verifica a sintaxe dos arquivos JavaScript
npm test       # testes de integração HTTP com node:test
```

A variável de ambiente `PORT` altera a porta local, se necessário.

## Endpoints

| Método | Caminho | Uso |
| --- | --- | --- |
| GET | `/api` | Apresentação e links dos endpoints |
| GET | `/api/filosofos` | Listagem, busca, filtro e paginação |
| GET | `/api/filosofos/1` | Um filósofo por ID |
| GET | `/api/filosofos/immanuel-kant` | Um filósofo por slug |
| GET | `/api/correntes` | Correntes únicas em ordem alfabética |
| GET | `/api/status` | Disponibilidade, versão e tamanho do catálogo |
| GET | `/api/openapi.json` | Especificação OpenAPI 3.0.3 |

`HEAD` retorna os mesmos headers de `GET`, sem corpo. `OPTIONS` atende o preflight CORS. A API é somente de leitura: `POST`, `PUT`, `PATCH` e `DELETE` retornam `405`.

### Parâmetros de GET /api/filosofos

| Parâmetro | Padrão | Regra |
| --- | --- | --- |
| `q` | vazio | Até 200 caracteres; pesquisa nome, descrição e correntes |
| `corrente` | vazio | Até 100 caracteres; nome completo de uma corrente |
| `pagina` | `1` | Inteiro de 1 a 1.000.000 |
| `limite` | `20` | Inteiro de 1 a 100 |

Busca e filtro ignoram maiúsculas, acentos e espaços nas extremidades. Todos os termos de `q` precisam aparecer no registro. O filtro por corrente exige correspondência completa; consulte `/api/correntes` para conhecer os valores. Os filtros podem ser combinados. Os resultados são ordenados alfabeticamente pelo nome, mantendo IDs estáveis.

Parâmetros desconhecidos ou repetidos, números fracionários, vazios e fora dos limites retornam `400`. `q` e `corrente` vazios desativam seus respectivos filtros. Uma corrente inexistente, uma busca sem correspondência ou uma página além do total retornam `200` com `dados: []`. Se não há resultados, `totalPaginas` é `0`.

```sh
curl "http://localhost:3000/api/filosofos?q=jurgen"
curl "http://localhost:3000/api/filosofos?corrente=Teoria%20critica&limite=5&pagina=1"
curl "http://localhost:3000/api/filosofos/immanuel-kant"
```

Exemplo de consulta individual:

```json
{
  "dados": {
    "id": 1,
    "slug": "immanuel-kant",
    "nome": "Immanuel Kant",
    "descricao": "Desenvolveu o idealismo transcendental, investigando as condições e os limites do conhecimento. Sua ética deontológica, baseada no imperativo categórico, e suas reflexões sobre estética e política influenciaram profundamente a filosofia moderna.",
    "correntes": ["Idealismo transcendental"],
    "fontes": ["https://plato.stanford.edu/entries/kant/"]
  }
}
```

A listagem usa o mesmo objeto dentro de `dados: []` e acrescenta:

```json
{
  "paginacao": {
    "pagina": 1,
    "limite": 20,
    "total": 14,
    "totalPaginas": 1
  }
}
```

### Consumir com JavaScript

No console ou em outra página hospedada na mesma origem:

```js
const parametros = new URLSearchParams({ q: 'kant', limite: '5' });
const resposta = await fetch(`/api/filosofos?${parametros}`);
const corpo = await resposta.json();

if (!resposta.ok) {
  throw new Error(corpo.erro.mensagem);
}

console.log(corpo.dados, corpo.paginacao);
```

Para consumir de outro site, use a URL completa do domínio do projeto antes de `/api`. O CORS é público (`Access-Control-Allow-Origin: *`); não há autenticação nem cookies de sessão.

### Erros

Os erros seguem o formato:

```json
{
  "erro": {
    "codigo": "FILOSOFO_NAO_ENCONTRADO",
    "mensagem": "Nenhum filósofo corresponde ao ID ou slug informado."
  }
}
```

| Status | Códigos |
| --- | --- |
| 400 | `PARAMETRO_INVALIDO` |
| 404 | `FILOSOFO_NAO_ENCONTRADO`, `ROTA_NAO_ENCONTRADA` |
| 405 | `METODO_NAO_PERMITIDO` |
| 500 | `ERRO_INTERNO` |

Erros não expõem stack trace. Respostas do catálogo usam ETag e cache compartilhado de uma hora, com `stale-while-revalidate` de um dia. Erros e `/api/status` usam `no-store`. Durante a revalidação, a CDN pode servir temporariamente uma versão anterior do catálogo.

## Vercel

A aplicação usa a integração nativa de Express: `app.js` exporta a aplicação sem abrir uma porta, e `public/` contém os arquivos servidos pela CDN. `server.js` inicia o servidor para desenvolvimento local. A configuração segue a [documentação oficial de Express no Vercel](https://vercel.com/docs/frameworks/backend/express).

Para atualizar o projeto já existente no Vercel, revise em **Settings → Build and Deployment**:

1. **Root Directory:** raiz do repositório, não `api` nem `public`.
2. **Framework Preset:** Express, também declarado em `vercel.json`.
3. **Node.js:** 24.x, definido em `package.json`.
4. **Build Command / Output Directory:** padrões do framework, sem os overrides da antiga página estática. Não é necessário um comando de build próprio.
5. **Install Command:** padrão do Vercel ou `npm ci`.

Faça primeiro um Preview Deployment e confira `/`, `/api/filosofos?q=kant`, `/api/filosofos/1` e `/api/status`. Depois promova a versão aprovada para produção. As configurações atuais do painel não estão armazenadas neste repositório e precisam ser conferidas no projeto existente.

O antigo endereço `/api/index.html` redireciona para `/`. O catálogo deixou de ser um módulo público `dados.js`; consumidores devem consultar os endpoints JSON.

## Estrutura

```text
app.js                       aplicação Express e endpoints
server.js                    inicialização local
data/filosofos.json           catálogo e fontes
src/catalogo.js              busca, filtros e validação
src/openapi.js               contrato OpenAPI
public/index.html            interface de consulta
public/app.js                consumo da API com fetch
public/css/index.css         estilos responsivos
test/api.test.js             testes HTTP
.github/workflows/ci.yml     verificações no GitHub Actions
vercel.json                  framework e headers de segurança
```

Para adicionar um autor, edite `data/filosofos.json`, atribua um **novo ID** e um slug único, inclua fontes confiáveis e execute os testes. Não renumere IDs existentes. O catálogo fica em memória e é adequado a uma base pequena, pública e sem escrita; um banco pode ser introduzido quando houver necessidade de edição ou um volume maior de dados.

O workflow verifica sintaxe, comportamento HTTP e vulnerabilidades de severidade alta ou crítica. `node_modules` não deve ser versionado; as dependências são reproduzidas com `package-lock.json` e `npm ci`.
