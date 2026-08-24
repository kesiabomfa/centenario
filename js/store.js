// Estado compartilhado em memória, alimentado pelos listeners em tempo real
// de products.js, stock.js e sales.js. Existe para evitar imports circulares
// entre esses três módulos (o cálculo de saldo de estoque depende dos três).
export const store = {
  produtos: [],
  movimentacoes: [],
  vendas: []
};

const listeners = [];
export function onStoreChange(cb) { listeners.push(cb); }
export function notifyStore() { listeners.forEach(cb => cb(store)); }

const TIPOS_ENTRADA = ["reposicao"];
const TIPOS_SAIDA = ["perda", "doacao"];

export function calcularSaldos() {
  const mapa = {};
  store.produtos.forEach(p => {
    mapa[p.id] = {
      produto: p,
      estoque_inicial: Number(p.estoque_inicial) || 0,
      reposicao: 0,
      vendido: 0,
      perda: 0,
      saldo: 0
    };
  });

  store.movimentacoes.forEach(m => {
    const linha = mapa[m.produto_id];
    if (!linha) return;
    const qtd = Number(m.quantidade) || 0;
    if (TIPOS_ENTRADA.includes(m.tipo)) linha.reposicao += qtd;
    else if (TIPOS_SAIDA.includes(m.tipo)) linha.perda += qtd;
  });

  store.vendas.forEach(v => {
    (v.itens || []).forEach(it => {
      const linha = mapa[it.produto_id];
      if (!linha) return;
      linha.vendido += Number(it.quantidade) || 0;
    });
  });

  Object.values(mapa).forEach(l => {
    l.saldo = l.estoque_inicial + l.reposicao - l.vendido - l.perda;
  });

  return mapa;
}

export function saldoDoProduto(produtoId) {
  const saldos = calcularSaldos();
  return saldos[produtoId]?.saldo ?? 0;
}
