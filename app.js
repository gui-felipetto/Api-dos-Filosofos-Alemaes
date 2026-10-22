import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { correntes, filosofos, listarFilosofos } from './src/catalogo.js';
import { openapi } from './src/openapi.js';

const app = express();
const versao = '1.0.0';
const cacheCatalogo = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

app.disable('x-powered-by');
app.set('query parser', 'simple');
app.set('json spaces', 2);

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  });
  next();
});

// Preserva o endereço da antiga página de consulta.
app.get('/api/index.html', (req, res) => res.redirect(308, '/'));

app.use('/api', cors({ methods: ['GET', 'HEAD', 'OPTIONS'] }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    res.set('Allow', 'GET, HEAD, OPTIONS');
    return res.status(405).json({
      erro: { codigo: 'METODO_NAO_PERMITIDO', mensagem: 'Esta API permite apenas consultas com GET e HEAD.' },
    });
  }
  next();
});

app.get('/api', (req, res) => {
  res.set('Cache-Control', cacheCatalogo).json({
    nome: 'API dos Filósofos Alemães',
    versao,
    documentacao: '/#documentacao',
    endpoints: {
      filosofos: '/api/filosofos',
      filosofo: '/api/filosofos/{idOuSlug}',
      correntes: '/api/correntes',
      status: '/api/status',
      openapi: '/api/openapi.json',
    },
  });
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', versao, totalFilosofos: filosofos.length });
});

app.get('/api/openapi.json', (req, res) => {
  res.set('Cache-Control', cacheCatalogo).json(openapi);
});

app.get('/api/correntes', (req, res) => {
  res.set('Cache-Control', cacheCatalogo).json({ dados: correntes });
});

app.get('/api/filosofos', (req, res, next) => {
  try {
    const resultado = listarFilosofos(req.query);
    res.set('Cache-Control', cacheCatalogo).json(resultado);
  } catch (erro) {
    next(erro);
  }
});

app.get('/api/filosofos/:idOuSlug', (req, res) => {
  const identificador = req.params.idOuSlug;
  const filosofo = filosofos.find((item) => (
    String(item.id) === identificador || item.slug === identificador
  ));

  if (!filosofo) {
    return res.status(404).json({
      erro: { codigo: 'FILOSOFO_NAO_ENCONTRADO', mensagem: 'Nenhum filósofo corresponde ao ID ou slug informado.' },
    });
  }
  res.set('Cache-Control', cacheCatalogo).json({ dados: filosofo });
});

// No Vercel, public/ é servido diretamente pela CDN. Este middleware atende o desenvolvimento local.
app.use(express.static(fileURLToPath(new URL('./public', import.meta.url)), { dotfiles: 'deny' }));

app.use((req, res) => {
  res.set('Cache-Control', 'no-store').status(404).json({
    erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: 'Rota não encontrada. Consulte /api para ver os endpoints.' },
  });
});

app.use((erro, req, res, next) => {
  if (res.headersSent) return next(erro);
  const status = erro.status === 400 || erro instanceof URIError ? 400 : 500;
  if (status === 500) console.error(erro);
  res.set('Cache-Control', 'no-store').status(status).json({
    erro: {
      codigo: status === 400 ? 'PARAMETRO_INVALIDO' : 'ERRO_INTERNO',
      mensagem: status === 400
        ? (erro instanceof URIError ? 'A URL contém uma codificação inválida.' : erro.message)
        : 'Não foi possível concluir a consulta. Tente novamente.',
    },
  });
});

export default app;
