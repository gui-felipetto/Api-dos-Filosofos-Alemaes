const form = document.getElementById('form-pesquisa');
const busca = document.getElementById('termo-pesquisa');
const corrente = document.getElementById('corrente');
const resultados = document.getElementById('resultados-pesquisa');
const mensagem = document.getElementById('mensagem');
const erroConsulta = document.getElementById('erro-consulta');
const botao = document.getElementById('botao-pesquisa');
const endpoint = document.getElementById('endpoint');
const statusHttp = document.getElementById('http-status');
const navegacao = document.getElementById('paginacao');
const anterior = document.getElementById('anterior');
const proxima = document.getElementById('proxima');
const respostaJson = document.getElementById('resposta-json');
const jsonConteudo = document.getElementById('json-conteudo');
const limite = 6;
let requisicao;
let paginaAtual = 1;
let filtrosAtuais = { q: '', corrente: '' };

function elemento(tag, classe, texto) {
  const item = document.createElement(tag);
  if (classe) item.className = classe;
  if (texto !== undefined) item.textContent = texto;
  return item;
}

function renderizarFilosofo(filosofo) {
  const card = elemento('article', 'item-resultado');
  const topo = elemento('div', 'card-topo');
  topo.append(elemento('span', 'card-id', `#${String(filosofo.id).padStart(2, '0')}`));
  const link = elemento('a', 'card-link', 'JSON ↗');
  link.href = `/api/filosofos/${encodeURIComponent(filosofo.slug)}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `Consultar JSON de ${filosofo.nome}`);
  topo.append(link);
  card.append(topo, elemento('h3', '', filosofo.nome));
  const tags = elemento('div', 'tags');
  filosofo.correntes.forEach((valor) => tags.append(elemento('span', '', valor)));
  card.append(tags, elemento('p', 'descricao', filosofo.descricao));
  const fonte = elemento('a', 'fonte', 'Ler na Stanford Encyclopedia ↗');
  fonte.href = filosofo.fontes[0];
  fonte.target = '_blank';
  fonte.rel = 'noopener noreferrer';
  card.append(fonte);
  return card;
}

async function consultar(pagina = 1, filtros = { q: busca.value.trim(), corrente: corrente.value }) {
  requisicao?.abort();
  const controle = new AbortController();
  requisicao = controle;
  const parametros = new URLSearchParams();
  if (filtros.q) parametros.set('q', filtros.q);
  if (filtros.corrente) parametros.set('corrente', filtros.corrente);
  parametros.set('limite', limite);
  if (pagina > 1) parametros.set('pagina', pagina);
  const caminho = `/api/filosofos?${parametros}`;
  endpoint.textContent = caminho;
  endpoint.href = caminho;
  botao.disabled = true;
  botao.textContent = 'Consultando…';
  anterior.disabled = true;
  proxima.disabled = true;
  mensagem.textContent = 'Consultando o catálogo…';
  statusHttp.textContent = 'Consultando';
  statusHttp.classList.remove('falha');
  erroConsulta.hidden = true;
  respostaJson.hidden = true;
  navegacao.hidden = true;
  jsonConteudo.textContent = '';
  resultados.replaceChildren();
  resultados.setAttribute('aria-busy', 'true');

  try {
    const resposta = await fetch(caminho, { signal: AbortSignal.any([controle.signal, AbortSignal.timeout(10000)]) });
    const corpo = await resposta.json();
    if (controle.signal.aborted) return;
    statusHttp.textContent = `${resposta.status} ${resposta.ok ? 'OK' : 'Erro'}`;
    jsonConteudo.textContent = JSON.stringify(corpo, null, 2);
    respostaJson.hidden = false;
    if (!resposta.ok) throw new Error(corpo.erro?.mensagem || 'A API não conseguiu concluir a consulta.');

    const { dados, paginacao } = corpo;
    paginaAtual = paginacao.pagina;
    filtrosAtuais = { ...filtros };
    resultados.replaceChildren(...dados.map(renderizarFilosofo));
    const inicio = (paginacao.pagina - 1) * paginacao.limite + 1;
    mensagem.textContent = dados.length
      ? `${inicio}–${inicio + dados.length - 1} de ${paginacao.total} ${paginacao.total === 1 ? 'filósofo encontrado' : 'filósofos encontrados'}`
      : 'Nenhum resultado nesta consulta. Tente outro termo ou limpe os filtros.';
    if (!dados.length) resultados.append(elemento('p', 'vazio', 'Novas ideias começam com outra pergunta.'));
    navegacao.hidden = paginacao.totalPaginas <= 1 && paginacao.pagina <= 1;
    document.getElementById('pagina-atual').textContent = `Página ${paginacao.pagina} de ${paginacao.totalPaginas}`;
    anterior.disabled = paginacao.pagina <= 1;
    proxima.disabled = paginacao.pagina >= paginacao.totalPaginas;

    const url = new URL(window.location.href);
    url.search = '';
    if (filtros.q) url.searchParams.set('q', filtros.q);
    if (filtros.corrente) url.searchParams.set('corrente', filtros.corrente);
    if (pagina > 1) url.searchParams.set('pagina', pagina);
    window.history.replaceState(null, '', url);
  } catch (erro) {
    if (controle.signal.aborted) return;
    statusHttp.classList.add('falha');
    if (statusHttp.textContent === 'Consultando') statusHttp.textContent = 'Indisponível';
    mensagem.textContent = 'Não foi possível carregar os resultados.';
    erroConsulta.textContent = erro.name === 'TimeoutError'
      ? 'A consulta demorou mais que o esperado. Tente novamente.'
      : (erro instanceof TypeError ? 'Não foi possível acessar a API. Verifique sua conexão e tente novamente.' : erro.message);
    erroConsulta.hidden = false;
  } finally {
    if (requisicao === controle) {
      resultados.setAttribute('aria-busy', 'false');
      botao.disabled = false;
      botao.textContent = 'Consultar API →';
    }
  }
}

async function carregarCorrentes() {
  try {
    const resposta = await fetch('/api/correntes', { signal: AbortSignal.timeout(10000) });
    if (!resposta.ok) throw new Error('Falha na consulta de correntes.');
    const { dados } = await resposta.json();
    dados.forEach((nome) => {
      if ([...corrente.options].some((opcao) => opcao.value === nome)) return;
      const opcao = elemento('option', '', nome);
      opcao.value = nome;
      corrente.append(opcao);
    });
  } catch {
    document.getElementById('aviso-correntes').textContent = 'O filtro de correntes está indisponível. A busca por texto continua disponível.';
  }
}

async function copiar(texto, sucesso) {
  const aviso = document.getElementById('aviso-copia');
  try {
    await navigator.clipboard.writeText(texto);
    aviso.textContent = sucesso;
  } catch {
    aviso.textContent = 'Não foi possível copiar automaticamente. Selecione e copie o texto exibido.';
  }
}

form.addEventListener('submit', (evento) => {
  evento.preventDefault();
  consultar();
});
document.getElementById('limpa-pesquisa').addEventListener('click', () => {
  form.reset();
  consultar();
  busca.focus();
});
document.querySelectorAll('[data-busca]').forEach((item) => {
  item.addEventListener('click', () => {
    busca.value = item.dataset.busca;
    corrente.value = '';
    consultar();
  });
});
anterior.addEventListener('click', () => consultar(Math.max(1, paginaAtual - 1), filtrosAtuais));
proxima.addEventListener('click', () => consultar(paginaAtual + 1, filtrosAtuais));
document.getElementById('copiar-url').addEventListener('click', () => copiar(endpoint.href, 'URL copiada.'));
document.getElementById('copiar-json').addEventListener('click', () => copiar(jsonConteudo.textContent, 'JSON copiado.'));

const parametrosIniciais = new URLSearchParams(window.location.search);
busca.value = (parametrosIniciais.get('q') || '').slice(0, 200);
const paginaInicial = parametrosIniciais.get('pagina') || '1';
const paginaValida = /^[1-9]\d*$/.test(paginaInicial) && Number(paginaInicial) <= 1000000;
const correnteInicial = (parametrosIniciais.get('corrente') || '').slice(0, 100);
if (correnteInicial && ![...corrente.options].some((opcao) => opcao.value === correnteInicial)) {
  const opcao = elemento('option', '', correnteInicial);
  opcao.value = correnteInicial;
  corrente.append(opcao);
}
corrente.value = correnteInicial;
carregarCorrentes();
consultar(paginaValida ? Number(paginaInicial) : 1);
