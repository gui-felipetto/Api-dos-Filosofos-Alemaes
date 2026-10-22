const referencia = (nome) => ({ $ref: `#/components/schemas/${nome}` });
const json = (schema, description = 'Consulta concluída.') => ({
  description, content: { 'application/json': { schema } },
});
const erro = json(referencia('Erro'), 'Consulta inválida ou recurso não encontrado.');
const respostas = (schema) => ({ 200: json(schema), 405: erro, 500: erro });

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'API dos Filósofos Alemães',
    version: '1.0.0',
    description: 'Catálogo público de consulta, sem autenticação. Resumos introdutórios com fontes para aprofundamento. GET e HEAD são permitidos; OPTIONS atende o preflight CORS. As correntes são classificações editoriais e não esgotam o pensamento dos autores.',
  },
  servers: [{ url: '/', description: 'Origem atual' }],
  paths: {
    '/api': {
      get: { summary: 'Conhecer os endpoints.', responses: respostas(referencia('Apresentacao')) },
    },
    '/api/status': {
      get: { summary: 'Verificar a disponibilidade da API.', responses: respostas(referencia('Status')) },
    },
    '/api/openapi.json': {
      get: { summary: 'Consultar esta especificação OpenAPI.', responses: respostas({ type: 'object' }) },
    },
    '/api/correntes': {
      get: {
        summary: 'Listar as correntes disponíveis, sem duplicatas e em ordem alfabética.',
        responses: respostas({ type: 'object', required: ['dados'], properties: { dados: { type: 'array', items: { type: 'string' } } } }),
      },
    },
    '/api/filosofos': {
      get: {
        summary: 'Listar e pesquisar filósofos em ordem alfabética pelo nome.',
        description: 'A busca ignora maiúsculas e acentos. Todos os termos de q devem aparecer no nome, na descrição ou nas correntes. O filtro corrente exige correspondência completa, também sem distinção de acentos. Busca sem resultados e página além do total retornam dados: []. Parâmetros desconhecidos, repetidos ou inválidos retornam 400.',
        parameters: [
          { name: 'q', in: 'query', description: 'Busca textual. Texto vazio equivale à ausência de busca.', schema: { type: 'string', maxLength: 200 }, example: 'jurgen' },
          { name: 'corrente', in: 'query', description: 'Uma corrente de /api/correntes. Texto vazio desativa o filtro.', schema: { type: 'string', maxLength: 100 }, example: 'Teoria crítica' },
          { name: 'pagina', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 1000000, default: 1 } },
          { name: 'limite', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: { ...respostas(referencia('ListaFilosofos')), 400: erro },
      },
    },
    '/api/filosofos/{idOuSlug}': {
      get: {
        summary: 'Consultar um filósofo por ID ou slug.',
        parameters: [{ name: 'idOuSlug', in: 'path', required: true, schema: { type: 'string' }, example: 'immanuel-kant' }],
        responses: {
          ...respostas({ type: 'object', required: ['dados'], properties: { dados: referencia('Filosofo') } }),
          400: erro, 404: erro,
        },
      },
    },
  },
  components: {
    schemas: {
      Apresentacao: {
        type: 'object', required: ['nome', 'versao', 'documentacao', 'endpoints'],
        properties: {
          nome: { type: 'string' }, versao: { type: 'string' }, documentacao: { type: 'string' },
          endpoints: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
      Status: {
        type: 'object', required: ['status', 'versao', 'totalFilosofos'],
        properties: { status: { type: 'string', enum: ['ok'] }, versao: { type: 'string' }, totalFilosofos: { type: 'integer', minimum: 0 } },
      },
      Filosofo: {
        type: 'object', required: ['id', 'slug', 'nome', 'descricao', 'correntes', 'fontes'],
        properties: {
          id: { type: 'integer', minimum: 1, description: 'Identificador estável; não reutilizar ao remover um registro.' },
          slug: { type: 'string', example: 'immanuel-kant' },
          nome: { type: 'string', example: 'Immanuel Kant' },
          descricao: { type: 'string' },
          correntes: { type: 'array', minItems: 1, items: { type: 'string' } },
          fontes: { type: 'array', minItems: 1, items: { type: 'string', format: 'uri' } },
        },
      },
      ListaFilosofos: {
        type: 'object', required: ['dados', 'paginacao'],
        properties: {
          dados: { type: 'array', items: referencia('Filosofo') },
          paginacao: referencia('Paginacao'),
        },
      },
      Paginacao: {
        type: 'object', required: ['pagina', 'limite', 'total', 'totalPaginas'],
        properties: {
          pagina: { type: 'integer', minimum: 1 }, limite: { type: 'integer', minimum: 1, maximum: 100 },
          total: { type: 'integer', minimum: 0 }, totalPaginas: { type: 'integer', minimum: 0 },
        },
      },
      Erro: {
        type: 'object', required: ['erro'],
        properties: {
          erro: {
            type: 'object', required: ['codigo', 'mensagem'],
            properties: { codigo: { type: 'string' }, mensagem: { type: 'string' } },
          },
        },
      },
    },
  },
};
