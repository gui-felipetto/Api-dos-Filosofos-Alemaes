import catalogo from '../data/filosofos.json' with { type: 'json' };

export const filosofos = [...catalogo].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
export const correntes = [...new Set(filosofos.flatMap((item) => item.correntes))]
  .sort((a, b) => a.localeCompare(b, 'pt-BR'));

function normalizar(texto) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

function parametroInvalido(mensagem) {
  const erro = new Error(mensagem);
  erro.status = 400;
  throw erro;
}

function textoConsulta(valor, nome, maximo) {
  if (valor === undefined) return '';
  if (typeof valor !== 'string' || valor.length > maximo) {
    parametroInvalido(`O parâmetro ${nome} deve ser um texto único de até ${maximo} caracteres.`);
  }
  return normalizar(valor);
}

function inteiroConsulta(valor, nome, padrao, maximo) {
  if (valor === undefined) return padrao;
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor) || Number(valor) > maximo) {
    parametroInvalido(`O parâmetro ${nome} deve ser um inteiro entre 1 e ${maximo}.`);
  }
  return Number(valor);
}

const indiceBusca = new Map(filosofos.map((item) => [
  item.id, normalizar([item.nome, item.descricao, ...item.correntes].join(' ')),
]));

export function listarFilosofos(consulta) {
  const permitidos = new Set(['q', 'corrente', 'pagina', 'limite']);
  for (const chave of Object.keys(consulta)) {
    if (!permitidos.has(chave)) parametroInvalido(`Parâmetro desconhecido: ${chave}. Consulte /api/openapi.json.`);
  }

  const busca = textoConsulta(consulta.q, 'q', 200);
  const corrente = textoConsulta(consulta.corrente, 'corrente', 100);
  const pagina = inteiroConsulta(consulta.pagina, 'pagina', 1, 1000000);
  const limite = inteiroConsulta(consulta.limite, 'limite', 20, 100);
  const termos = busca.split(/\s+/).filter(Boolean);

  const encontrados = filosofos.filter((item) => (
    termos.every((termo) => indiceBusca.get(item.id).includes(termo))
    && (!corrente || item.correntes.some((valor) => normalizar(valor) === corrente))
  ));
  const inicio = (pagina - 1) * limite;

  return {
    dados: encontrados.slice(inicio, inicio + limite),
    paginacao: {
      pagina,
      limite,
      total: encontrados.length,
      totalPaginas: Math.ceil(encontrados.length / limite),
    },
  };
}
