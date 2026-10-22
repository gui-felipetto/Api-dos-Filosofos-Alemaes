import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import app from '../app.js';
import { filosofos } from '../src/catalogo.js';
import vercel from '../vercel.json' with { type: 'json' };

let servidor;
let origem;

before(async () => {
  servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  origem = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => servidor.close((erro) => erro ? reject(erro) : resolve()));
});

async function consultar(caminho, opcoes) {
  const resposta = await fetch(`${origem}${caminho}`, opcoes);
  return { resposta, corpo: await resposta.json() };
}

test('a API se apresenta e fornece os endpoints', async () => {
  const { resposta, corpo } = await consultar('/api');
  assert.equal(resposta.status, 200);
  assert.equal(corpo.endpoints.filosofos, '/api/filosofos');
  assert.equal(corpo.endpoints.openapi, '/api/openapi.json');
});

test('lista o catálogo ordenado, com paginação e fontes', async () => {
  const { resposta, corpo } = await consultar('/api/filosofos');
  assert.equal(resposta.status, 200);
  assert.equal(corpo.dados.length, filosofos.length);
  assert.deepEqual(corpo.paginacao, { pagina: 1, limite: 20, total: filosofos.length, totalPaginas: 1 });
  assert.deepEqual(corpo.dados.map((item) => item.nome), corpo.dados.map((item) => item.nome).sort((a, b) => a.localeCompare(b, 'pt-BR')));
  assert.ok(corpo.dados.every((item) => item.fontes.length && item.correntes.length));
});

test('o catálogo usa IDs e slugs únicos e fontes HTTPS válidas', () => {
  assert.equal(new Set(filosofos.map((item) => item.id)).size, filosofos.length);
  assert.equal(new Set(filosofos.map((item) => item.slug)).size, filosofos.length);
  for (const filosofo of filosofos) {
    assert.ok(Number.isSafeInteger(filosofo.id) && filosofo.id > 0);
    assert.match(filosofo.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(filosofo.nome.trim() && filosofo.descricao.trim());
    filosofo.fontes.forEach((fonte) => assert.equal(new URL(fonte).protocol, 'https:'));
  }
});

test('busca sem distinção de acentos, espaços ou maiúsculas', async () => {
  for (const termo of ['JURGEN', ' jürgen ', 'Jurgen Habermas']) {
    const { corpo } = await consultar(`/api/filosofos?q=${encodeURIComponent(termo)}`);
    assert.deepEqual(corpo.dados.map((item) => item.slug), ['jurgen-habermas']);
  }
});

test('busca nas descrições e exige todos os termos', async () => {
  const { corpo } = await consultar('/api/filosofos?q=imperativo%20categorico');
  assert.deepEqual(corpo.dados.map((item) => item.slug), ['immanuel-kant']);
  const { corpo: vazio } = await consultar('/api/filosofos?q=kant%20habermas');
  assert.equal(vazio.dados.length, 0);
});

test('combina busca e corrente com correspondência completa', async () => {
  const { corpo } = await consultar('/api/filosofos?corrente=TEORIA%20CRITICA&q=habermas');
  assert.deepEqual(corpo.dados.map((item) => item.id), [7]);
  const { corpo: parcial } = await consultar('/api/filosofos?corrente=critica');
  assert.equal(parcial.dados.length, 0);
});

test('pagina sem repetir registros e mantém o total', async () => {
  const { corpo: primeira } = await consultar('/api/filosofos?limite=5');
  const { corpo: segunda } = await consultar('/api/filosofos?limite=5&pagina=2');
  assert.equal(primeira.dados.length, 5);
  assert.equal(segunda.dados.length, 5);
  assert.equal(primeira.paginacao.total, filosofos.length);
  assert.equal(primeira.paginacao.totalPaginas, Math.ceil(filosofos.length / 5));
  assert.equal(new Set([...primeira.dados, ...segunda.dados].map((item) => item.id)).size, 10);
});

test('retorna lista vazia para busca sem resultado e página além do total', async () => {
  const { resposta, corpo } = await consultar('/api/filosofos?q=inexistentezz');
  assert.equal(resposta.status, 200);
  assert.deepEqual(corpo.dados, []);
  assert.equal(corpo.paginacao.totalPaginas, 0);
  const { corpo: pagina } = await consultar('/api/filosofos?pagina=1000000');
  assert.deepEqual(pagina.dados, []);
});

test('texto vazio e espaços permitem listar todo o catálogo', async () => {
  const { corpo } = await consultar('/api/filosofos?q=%20%20&corrente=');
  assert.equal(corpo.paginacao.total, filosofos.length);
});

for (const consulta of [
  'pagina=0', 'pagina=-1', 'pagina=1.5', 'pagina=1abc', 'pagina=01', 'pagina=',
  'pagina=1000001', 'limite=0', 'limite=101', 'limite=Infinity', 'limite=1e2',
  'q=kant&q=hegel', 'corrente=a&corrente=b', 'pagina=1&pagina=2', 'limite=1&limite=2',
  'q[]=kant', 'q[nome]=kant', 'desconhecido=1', `q=${'a'.repeat(201)}`, `corrente=${'a'.repeat(101)}`,
]) {
  test(`rejeita parâmetro inválido: ${consulta.slice(0, 60)}`, async () => {
    const { resposta, corpo } = await consultar(`/api/filosofos?${consulta}`);
    assert.equal(resposta.status, 400);
    assert.equal(corpo.erro.codigo, 'PARAMETRO_INVALIDO');
    assert.equal(resposta.headers.get('cache-control'), 'no-store');
  });
}

test('consulta o mesmo filósofo por ID e slug', async () => {
  const porId = await consultar('/api/filosofos/1');
  const porSlug = await consultar('/api/filosofos/immanuel-kant');
  assert.equal(porId.resposta.status, 200);
  assert.deepEqual(porId.corpo, porSlug.corpo);
  assert.equal(porId.corpo.dados.nome, 'Immanuel Kant');
});

test('IDs inexistentes, parciais e slugs inexistentes retornam 404 JSON', async () => {
  for (const identificador of ['99999', '1abc', '01', '-1', 'kant']) {
    const { resposta, corpo } = await consultar(`/api/filosofos/${identificador}`);
    assert.equal(resposta.status, 404);
    assert.equal(corpo.erro.codigo, 'FILOSOFO_NAO_ENCONTRADO');
  }
});

test('URL com codificação inválida retorna erro JSON sem stack trace', async () => {
  const { resposta, corpo } = await consultar('/api/filosofos/%E0%A4%A');
  assert.equal(resposta.status, 400);
  assert.equal(corpo.erro.codigo, 'PARAMETRO_INVALIDO');
  assert.equal('stack' in corpo.erro, false);
});

test('lista correntes únicas, ordenadas e utilizáveis como filtro', async () => {
  const { resposta, corpo } = await consultar('/api/correntes');
  assert.equal(resposta.status, 200);
  assert.equal(corpo.dados.length, new Set(corpo.dados).size);
  assert.deepEqual(corpo.dados, [...corpo.dados].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  for (const corrente of corpo.dados) {
    const { corpo: filtrado } = await consultar(`/api/filosofos?corrente=${encodeURIComponent(corrente)}`);
    assert.ok(filtrado.dados.length > 0);
    assert.ok(filtrado.dados.every((item) => item.correntes.includes(corrente)));
  }
});

test('permite CORS público e preflight para consultas', async () => {
  const { resposta } = await consultar('/api/filosofos', { headers: { Origin: 'https://exemplo.com' } });
  assert.equal(resposta.headers.get('access-control-allow-origin'), '*');
  const preflight = await fetch(`${origem}/api/filosofos`, {
    method: 'OPTIONS', headers: { Origin: 'https://exemplo.com', 'Access-Control-Request-Method': 'GET' },
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-methods'), /GET/);
});

test('operações de escrita recebem 405 e não alteram o catálogo', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const { resposta, corpo } = await consultar('/api/filosofos/1', { method });
    assert.equal(resposta.status, 405);
    assert.equal(resposta.headers.get('allow'), 'GET, HEAD, OPTIONS');
    assert.equal(corpo.erro.codigo, 'METODO_NAO_PERMITIDO');
  }
  assert.equal((await consultar('/api/filosofos/1')).corpo.dados.nome, 'Immanuel Kant');
});

test('HEAD mantém os headers da consulta sem retornar corpo', async () => {
  const resposta = await fetch(`${origem}/api/filosofos`, { method: 'HEAD' });
  assert.equal(resposta.status, 200);
  assert.match(resposta.headers.get('content-type'), /application\/json/);
  assert.equal(await resposta.text(), '');
});

test('cache da API suporta revalidação condicional por ETag', async () => {
  const { resposta } = await consultar('/api/filosofos');
  assert.match(resposta.headers.get('cache-control'), /s-maxage=3600/);
  const condicional = await fetch(`${origem}/api/filosofos`, {
    headers: { 'If-None-Match': resposta.headers.get('etag'), 'Cache-Control': 'max-age=0' },
  });
  assert.equal(condicional.status, 304);
  const { resposta: status } = await consultar('/api/status');
  assert.equal(status.headers.get('cache-control'), 'no-store');
});

test('status informa disponibilidade e quantidade sem expor ambiente', async () => {
  const { resposta, corpo } = await consultar('/api/status');
  assert.equal(resposta.status, 200);
  assert.deepEqual(corpo, { status: 'ok', versao: '1.0.0', totalFilosofos: filosofos.length });
});

test('OpenAPI documenta os endpoints e resolve todas as referências locais', async () => {
  const { resposta, corpo } = await consultar('/api/openapi.json');
  assert.equal(resposta.status, 200);
  assert.equal(corpo.openapi, '3.0.3');
  for (const caminho of ['/api', '/api/status', '/api/correntes', '/api/filosofos', '/api/openapi.json']) {
    assert.ok(corpo.paths[caminho].get.responses['200']);
    assert.equal((await fetch(`${origem}${caminho}`)).status, 200);
  }
  function verificar(valor) {
    if (!valor || typeof valor !== 'object') return;
    if (valor.$ref) {
      assert.ok(valor.$ref.split('/').slice(1).reduce((atual, chave) => atual?.[chave], corpo), valor.$ref);
    }
    Object.values(valor).forEach(verificar);
  }
  verificar(corpo);
});

test('serve a interface e os arquivos públicos com os mesmos headers do Vercel', async () => {
  for (const caminho of ['/', '/app.js', '/css/index.css']) {
    const resposta = await fetch(`${origem}${caminho}`);
    assert.equal(resposta.status, 200);
    assert.equal(resposta.headers.get('x-powered-by'), null);
    for (const header of vercel.headers[0].headers) {
      assert.equal(resposta.headers.get(header.key), header.value);
    }
  }
  const html = await (await fetch(origem)).text();
  assert.match(html, /lang="pt-BR"/);
  assert.match(html, /id="form-pesquisa"/);
});

test('preserva o endereço da antiga página com redirecionamento', async () => {
  const resposta = await fetch(`${origem}/api/index.html`, { redirect: 'manual' });
  assert.equal(resposta.status, 308);
  assert.equal(resposta.headers.get('location'), '/');
});

test('rotas desconhecidas e arquivos internos não ficam disponíveis', async () => {
  for (const caminho of ['/api/nao-existe', '/data/filosofos.json', '/package.json', '/src/catalogo.js', '/.git/config']) {
    const { resposta, corpo } = await consultar(caminho);
    assert.equal(resposta.status, 404);
    assert.equal(corpo.erro.codigo, 'ROTA_NAO_ENCONTRADA');
  }
});
