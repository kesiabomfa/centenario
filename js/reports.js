import { formatarMoeda, formatarDataBR, formatarHora, escapeHtml, rotuloPagamento, hojeISO, mesISO } from "./utils.js";
import { store, onStoreChange } from "./store.js";

export function iniciarRelatorios() {
  const modoSel = document.getElementById("rel-modo");
  const dataInput = document.getElementById("rel-data");
  const mesInput = document.getElementById("rel-mes");

  dataInput.value = hojeISO();
  mesInput.value = mesISO();

  modoSel.addEventListener("change", () => {
    const dia = modoSel.value === "dia";
    dataInput.hidden = !dia;
    mesInput.hidden = dia;
    renderRelatorio();
  });
  dataInput.addEventListener("change", renderRelatorio);
  mesInput.addEventListener("change", renderRelatorio);

  onStoreChange(renderRelatorio);
  renderRelatorio();
}

function vendasDoPeriodo() {
  const modo = document.getElementById("rel-modo").value;
  if (modo === "dia") {
    const data = document.getElementById("rel-data").value;
    return store.vendas.filter(v => v.data === data);
  }
  const mes = document.getElementById("rel-mes").value; // YYYY-MM
  return store.vendas.filter(v => (v.data || "").startsWith(mes));
}

function renderRelatorio() {
  const vendas = vendasDoPeriodo();

  // métricas
  const totalVendas = vendas.length;
  const valorTotal = vendas.reduce((s, v) => s + (v.valor_total || 0), 0);
  const qtdProdutos = vendas.reduce((s, v) => s + (v.itens || []).reduce((a, i) => a + i.quantidade, 0), 0);
  const ticketMedio = totalVendas ? valorTotal / totalVendas : 0;

  document.getElementById("rel-metrics").innerHTML = `
    <div class="metric"><span>Vendas</span><strong>${totalVendas}</strong></div>
    <div class="metric"><span>Valor total</span><strong>${formatarMoeda(valorTotal)}</strong></div>
    <div class="metric"><span>Produtos vendidos</span><strong>${qtdProdutos}</strong></div>
    <div class="metric"><span>Ticket médio</span><strong>${formatarMoeda(ticketMedio)}</strong></div>
  `;

  // por forma de pagamento
  const porPagamento = {};
  vendas.forEach(v => (v.pagamentos || []).forEach(p => {
    const chave = rotuloPagamento(p);
    porPagamento[chave] = porPagamento[chave] || { qtd: 0, valor: 0 };
    porPagamento[chave].qtd += 1;
    porPagamento[chave].valor += p.valor || 0;
  }));
  const tbodyPag = document.querySelector("#tbl-rel-pagamentos tbody");
  const chavesPag = Object.keys(porPagamento);
  tbodyPag.innerHTML = chavesPag.length
    ? chavesPag.sort((a, b) => porPagamento[b].valor - porPagamento[a].valor)
        .map(k => `<tr><td>${escapeHtml(k)}</td><td class="num">${porPagamento[k].qtd}</td><td class="num">${formatarMoeda(porPagamento[k].valor)}</td></tr>`).join("")
    : `<tr><td colspan="3" class="muted">Sem vendas no período.</td></tr>`;

  // por produto
  const porProduto = {};
  vendas.forEach(v => (v.itens || []).forEach(i => {
    porProduto[i.nome] = porProduto[i.nome] || { qtd: 0, valor: 0 };
    porProduto[i.nome].qtd += i.quantidade;
    porProduto[i.nome].valor += i.subtotal || 0;
  }));
  const tbodyProd = document.querySelector("#tbl-rel-produtos tbody");
  const chavesProd = Object.keys(porProduto);
  tbodyProd.innerHTML = chavesProd.length
    ? chavesProd.sort((a, b) => porProduto[b].qtd - porProduto[a].qtd)
        .map(k => `<tr><td>${escapeHtml(k)}</td><td class="num">${porProduto[k].qtd}</td><td class="num">${formatarMoeda(porProduto[k].valor)}</td></tr>`).join("")
    : `<tr><td colspan="3" class="muted">Sem vendas no período.</td></tr>`;

  // lista de vendas
  const tbodyVendas = document.querySelector("#tbl-rel-vendas tbody");
  tbodyVendas.innerHTML = vendas.length
    ? vendas.slice().sort((a, b) => {
        const diaComp = (b.data || "").localeCompare(a.data || "");
        if (diaComp !== 0) return diaComp;
        return (b.criado_em?.seconds || 0) - (a.criado_em?.seconds || 0);
      })
        .map(v => {
          const hora = v.criado_em?.toDate ? formatarHora(v.criado_em.toDate()) : "—";
          const pag = (v.pagamentos || []).map(rotuloPagamento).join(" + ");
          return `<tr>
            <td>${formatarDataBR(v.data)}</td><td>${hora}</td>
            <td>${(v.itens || []).map(i => `${i.quantidade}× ${escapeHtml(i.nome)}`).join(", ")}</td>
            <td>${escapeHtml(pag)}</td>
            <td class="num">${formatarMoeda(v.valor_total)}</td>
          </tr>`;
        }).join("")
    : `<tr><td colspan="5" class="muted">Nenhuma venda no período selecionado.</td></tr>`;
}
