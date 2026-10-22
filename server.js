import app from './app.js';

const porta = Number(process.env.PORT || 3000);
app.listen(porta, () => {
  console.log(`API e interface disponíveis em http://localhost:${porta}`);
});
