import {
  db, auth, collection, doc, addDoc, setDoc, updateDoc, onSnapshot, query, orderBy, serverTimestamp
} from "./firebase-init.js";
import {
  formatarMoeda, formatarHora, hojeISO, toast, abrirModal, fecharModal, escapeHtml, rotuloPagamento
} from "./utils.js";
import { store, notifyStore, calcularSaldos } from "./store.js";

let carrinho = [];         // [{produto_id, nome, valor_unitario, quantidade}]
let pagamentos = [];       // [{forma, parcelas, valor, recebido}]
let caixaHoje = null;      // doc de cash_days/{hoje} ou null se não aberto

export function iniciarCaixa() {
  // vendas em tempo real (usado também pelos relatórios e cálculo de saldo)
  const qVendas = query(collection(db, "sales"), orderBy("criado_em", "desc"));
  onSnapshot(qVendas, (snap) => {
    store.vendas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    notifyStore();
    renderVendasHoje();
  });

  // status do caixa do dia
  onSnapshot(doc(db, "cash_days", hojeISO()), (snap) => {
    caixaHoje = snap.exists() ? snap.data() : null;
    atualizarBannerCaixa();
  });

  document.getElementById("busca-produto").addEventListener("input", renderGridProdutos);
  document.getElementById("btn-limpar-carrinho").addEventListener("click", () => { carrinho = []; renderCarrinho(); });
  document.getElementById("btn-add-pagamento").addEventListener("click", () => { adicionarPagamento(); });
  document.getElementById("btn-finalizar-venda").addEventListener("click", finalizarVenda);
  document.getElementById("btn-abrir-caixa").addEventListener("click", abrirModalAbrirCaixa);
  document.getElementById("btn-fechar-caixa").addEventListener("click", abrirModalFecharCaixa);

  renderGridProdutos();
  renderCarrinho();
}

// chamado sempre que produtos/vendas/movimentacoes mudam (registrado em main.js)
export function onDadosMudaram() {
  renderGridProdutos();
  renderVendasHoje();
}

function atualizarBannerCaixa() {
  const aviso = document.getElementById("caixa-fechado-aviso");
  const btnFinalizar = document.getElementById("btn-finalizar-venda");
  const btnFechar = document.getElementById("btn-fechar-caixa");
  const aberto = caixaHoje && !caixaHoje.fechado;
  aviso.hidden = !!aberto;
  btnFechar.hidden = !aberto;
  atualizarBotaoFinalizar();
  if (!aberto) btnFechar.hidden = true;
}

// ---------------- grid de produtos ----------------
function renderGridProdutos() {
  const grid = document.getElementById("grid-produtos");
  const termo = (document.getElementById("busca-produto").value || "").toLowerCase().trim();
  const saldos = calcularSaldos();

  const lista = store.produtos
    .filter(p => !termo || p.nome.toLowerCase().includes(termo) || (p.cor || "").toLowerCase().includes(termo))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  if (!lista.length) {
    grid.innerHTML = `<p class="vazio">Nenhum produto encontrado.</p>`;
    return;
  }

  grid.innerHTML = lista.map(p => {
    const saldo = saldos[p.id]?.saldo ?? 0;
    const semEstoque = saldo <= 0;
    return `
      <button class="produto-card" data-id="${p.id}" ${semEstoque ? "disabled" : ""} type="button">
        <span class="pnome">${escapeHtml(p.nome)}</span>
        <span class="pcor">${escapeHtml(p.cor || "—")} <span class="psaldo">${semEstoque ? "esgotado" : "saldo " + saldo}</span></span>
        <span class="pvalor">${formatarMoeda(p.valor_venda)}</span>
      </button>`;
  }).join("");

  grid.querySelectorAll(".produto-card").forEach(btn => {
    btn.addEventListener("click", () => adicionarAoCarrinho(btn.dataset.id));
  });
}

function adicionarAoCarrinho(produtoId) {
  const p = store.produtos.find(x => x.id === produtoId);
  if (!p) return;
  const saldo = calcularSaldos()[produtoId]?.saldo ?? 0;
  const item = carrinho.find(i => i.produto_id === produtoId);
  const qtdAtual = item ? item.quantidade : 0;
  if (qtdAtual + 1 > saldo) { toast(`Saldo insuficiente de "${p.nome}".`, "error"); return; }

  if (item) item.quantidade += 1;
  else carrinho.push({ produto_id: p.id, nome: p.nome, cor: p.cor, valor_unitario: p.valor_venda, quantidade: 1 });
  renderCarrinho();
}

function alterarQtd(produtoId, delta) {
  const item = carrinho.find(i => i.produto_id === produtoId);
  if (!item) return;
  const saldo = calcularSaldos()[produtoId]?.saldo ?? 0;
  const nova = item.quantidade + delta;
  if (nova <= 0) { carrinho = carrinho.filter(i => i.produto_id !== produtoId); }
  else if (nova > saldo) { toast("Saldo insuficiente.", "error"); return; }
  else { item.quantidade = nova; }
  renderCarrinho();
}

// ---------------- carrinho ----------------
function totalCarrinho() {
  return carrinho.reduce((s, i) => s + i.valor_unitario * i.quantidade, 0);
}

function renderCarrinho() {
  const lista = document.getElementById("lista-carrinho");
  if (!carrinho.length) {
    lista.innerHTML = `<p class="vazio">Nenhum item adicionado.</p>`;
  } else {
    lista.innerHTML = carrinho.map(i => `
      <div class="item-carrinho">
        <span class="ic-nome">${escapeHtml(i.nome)}<small>${escapeHtml(i.cor || "")} · ${formatarMoeda(i.valor_unitario)} un.</small></span>
        <div class="qtd-stepper">
          <button type="button" data-menos="${i.produto_id}">−</button>
          <span>${i.quantidade}</span>
          <button type="button" data-mais="${i.produto_id}">+</button>
        </div>
        <span class="ic-subtotal">${formatarMoeda(i.valor_unitario * i.quantidade)}</span>
        <button class="ic-remover" data-remover="${i.produto_id}" type="button" title="Remover">✕</button>
      </div>
    `).join("");
    lista.querySelectorAll("[data-mais]").forEach(b => b.addEventListener("click", () => alterarQtd(b.dataset.mais, 1)));
    lista.querySelectorAll("[data-menos]").forEach(b => b.addEventListener("click", () => alterarQtd(b.dataset.menos, -1)));
    lista.querySelectorAll("[data-remover]").forEach(b => b.addEventListener("click", () => {
      carrinho = carrinho.filter(i => i.produto_id !== b.dataset.remover);
      renderCarrinho();
    }));
  }
  document.getElementById("carrinho-total-valor").textContent = formatarMoeda(totalCarrinho());
  renderGridProdutos(); // atualiza saldo exibido nos cards
  renderPagamentos();
}

// ---------------- pagamentos ----------------
function adicionarPagamento() {
  const restante = Math.max(0, totalCarrinho() - somaPagamentos());
  pagamentos.push({ forma: "pix", parcelas: 1, valor: Number(restante.toFixed(2)), recebido: 0 });
  renderPagamentos();
}

function somaPagamentos() {
  return pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
}

function renderPagamentos() {
  const wrap = document.getElementById("lista-pagamentos");
  wrap.innerHTML = pagamentos.map((p, idx) => `
    <div class="linha-pagamento" data-idx="${idx}">
      <select data-campo="forma">
        <option value="pix" ${p.forma === "pix" ? "selected" : ""}>Pix</option>
        <option value="dinheiro" ${p.forma === "dinheiro" ? "selected" : ""}>Dinheiro</option>
        <option value="debito" ${p.forma === "debito" ? "selected" : ""}>Cartão débito</option>
        <option value="credito" ${p.forma === "credito" ? "selected" : ""}>Cartão crédito</option>
      </select>
      ${p.forma === "credito"
        ? `<input type="number" min="1" step="1" data-campo="parcelas" value="${p.parcelas || 1}" placeholder="Parcelas">`
        : `<span></span>`}
      <input type="number" min="0" step="0.01" data-campo="valor" value="${p.valor}" placeholder="Valor">
      <button type="button" class="lp-remover" data-remover-pg="${idx}">✕</button>
      ${p.forma === "dinheiro" ? `
        <div class="dinheiro-extra" style="grid-column:1 / -1;">
          <label>Valor recebido em dinheiro
            <input type="number" min="0" step="0.01" data-campo="recebido" value="${p.recebido || ""}" placeholder="0,00">
          </label>
          <label>Troco
            <input type="text" value="${formatarMoeda(Math.max(0, (Number(p.recebido) || 0) - (Number(p.valor) || 0)))}" disabled>
          </label>
        </div>` : ""}
    </div>
  `).join("");

  wrap.querySelectorAll(".linha-pagamento").forEach(linha => {
    const idx = Number(linha.dataset.idx);
    linha.querySelectorAll("[data-campo]").forEach(input => {
      input.addEventListener("input", () => {
        const campo = input.dataset.campo;
        pagamentos[idx][campo] = campo === "parcelas" ? Math.max(1, parseInt(input.value) || 1)
          : campo === "forma" ? input.value
          : parseFloat(input.value) || 0;
        renderPagamentos();
      });
    });
  });
  wrap.querySelectorAll("[data-remover-pg]").forEach(b => b.addEventListener("click", () => {
    pagamentos.splice(Number(b.dataset.removerPg), 1);
    renderPagamentos();
  }));

  const total = totalCarrinho();
  const alocado = somaPagamentos();
  const restante = Number((total - alocado).toFixed(2));
  const resumo = document.getElementById("pagamento-restante").closest(".pagamento-resumo");
  const rotuloResumo = resumo.querySelector("span");
  document.getElementById("pagamento-restante").textContent = formatarMoeda(Math.abs(restante));
  resumo.classList.toggle("ok", restante === 0 && total > 0);
  resumo.classList.toggle("falta", restante !== 0);
  rotuloResumo.textContent = restante === 0 ? "Valor alocado" : restante > 0 ? "Falta alocar" : "Excedente";
  atualizarBotaoFinalizar();
}

function atualizarBotaoFinalizar() {
  const total = totalCarrinho();
  const restante = Number((total - somaPagamentos()).toFixed(2));
  const aberto = caixaHoje && !caixaHoje.fechado;
  const recebidoOk = pagamentos.filter(p => p.forma === "dinheiro")
    .every(p => (Number(p.recebido) || 0) >= (Number(p.valor) || 0));
  document.getElementById("btn-finalizar-venda").disabled =
    !aberto || carrinho.length === 0 || restante !== 0 || pagamentos.length === 0 || !recebidoOk;
}

async function finalizarVenda() {
  const total = totalCarrinho();
  const itens = carrinho.map(i => ({
    produto_id: i.produto_id, nome: i.nome, cor: i.cor || "",
    quantidade: i.quantidade, valor_unitario: i.valor_unitario,
    subtotal: Number((i.valor_unitario * i.quantidade).toFixed(2))
  }));
  const pagamentosFinal = pagamentos.map(p => ({
    forma: p.forma,
    parcelas: p.forma === "credito" ? (Number(p.parcelas) || 1) : 1,
    valor: Number(p.valor) || 0,
    recebido: p.forma === "dinheiro" ? (Number(p.recebido) || 0) : Number(p.valor) || 0,
    troco: p.forma === "dinheiro" ? Number(((Number(p.recebido) || 0) - (Number(p.valor) || 0)).toFixed(2)) : 0
  }));

  const btn = document.getElementById("btn-finalizar-venda");
  btn.disabled = true; btn.textContent = "Registrando…";
  try {
    await addDoc(collection(db, "sales"), {
      data: hojeISO(),
      itens,
      pagamentos: pagamentosFinal,
      valor_total: Number(total.toFixed(2)),
      criado_em: serverTimestamp(),
      criado_por: auth.currentUser?.email || ""
    });
    toast("Venda registrada!", "success");
    carrinho = [];
    pagamentos = [];
    renderCarrinho();
  } catch (err) {
    toast("Erro ao registrar venda: " + err.message, "error");
  } finally {
    btn.textContent = "Finalizar venda";
    atualizarBotaoFinalizar();
  }
}

// ---------------- vendas de hoje ----------------
function renderVendasHoje() {
  const hoje = hojeISO();
  const vendasHoje = store.vendas.filter(v => v.data === hoje);
  const tbody = document.querySelector("#tbl-vendas-hoje tbody");

  if (!vendasHoje.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Nenhuma venda registrada hoje.</td></tr>`;
  } else {
    tbody.innerHTML = vendasHoje.map(v => {
      const hora = v.criado_em?.toDate ? formatarHora(v.criado_em.toDate()) : "—";
      const qtdItens = (v.itens || []).reduce((s, i) => s + i.quantidade, 0);
      const pag = (v.pagamentos || []).map(rotuloPagamento).join(" + ");
      return `<tr>
        <td>${hora}</td>
        <td>${(v.itens || []).map(i => escapeHtml(i.nome)).join(", ")}</td>
        <td>${qtdItens}</td>
        <td>${escapeHtml(pag)}</td>
        <td class="num">${formatarMoeda(v.valor_total)}</td>
      </tr>`;
    }).join("");
  }

  const totalDia = vendasHoje.reduce((s, v) => s + (v.valor_total || 0), 0);
  const qtdProdutos = vendasHoje.reduce((s, v) => s + (v.itens || []).reduce((a, i) => a + i.quantidade, 0), 0);
  document.getElementById("resumo-hoje").innerHTML =
    `<span>${vendasHoje.length} venda(s)</span><span>${qtdProdutos} produto(s)</span><span>Total <strong>${formatarMoeda(totalDia)}</strong></span>`;
}

// ---------------- abertura de caixa ----------------
function abrirModalAbrirCaixa() {
  abrirModal(`
    <h2>Abrir caixa</h2>
    <p class="modal-sub">Informe o valor em dinheiro que está no caixa no início do dia.</p>
    <form id="form-abrir-caixa">
      <label>Valor inicial em dinheiro (R$)</label>
      <input type="number" id="ac-valor" min="0" step="0.01" required autofocus>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancelar-abrir">Cancelar</button>
        <button type="submit" class="btn btn-primary">Abrir caixa</button>
      </div>
    </form>
  `);
  document.getElementById("btn-cancelar-abrir").addEventListener("click", fecharModal);
  document.getElementById("form-abrir-caixa").addEventListener("submit", async (e) => {
    e.preventDefault();
    const valor = parseFloat(document.getElementById("ac-valor").value) || 0;
    try {
      await setDoc(doc(db, "cash_days", hojeISO()), {
        data: hojeISO(),
        dinheiro_inicial: valor,
        aberto_em: serverTimestamp(),
        aberto_por: auth.currentUser?.email || "",
        fechado: false
      });
      toast("Caixa aberto.", "success");
      fecharModal();
    } catch (err) {
      toast("Erro ao abrir caixa: " + err.message, "error");
    }
  });
}

// ---------------- fechamento de caixa ----------------
function abrirModalFecharCaixa() {
  const hoje = hojeISO();
  const vendasHoje = store.vendas.filter(v => v.data === hoje);
  const totalDinheiro = vendasHoje.reduce((s, v) =>
    s + (v.pagamentos || []).filter(p => p.forma === "dinheiro").reduce((a, p) => a + (p.valor || 0), 0), 0);
  const inicial = caixaHoje?.dinheiro_inicial || 0;
  const esperado = inicial + totalDinheiro;

  abrirModal(`
    <h2>Fechar caixa</h2>
    <p class="modal-sub">Confira o dinheiro físico no caixa e informe o valor contado.</p>
    <div class="modal-diff"><span>Abertura</span><strong>${formatarMoeda(inicial)}</strong></div>
    <div class="modal-diff"><span>Vendas em dinheiro hoje</span><strong>${formatarMoeda(totalDinheiro)}</strong></div>
    <div class="modal-diff"><span>Esperado no caixa</span><strong>${formatarMoeda(esperado)}</strong></div>
    <form id="form-fechar-caixa">
      <label>Valor contado no caixa (R$)</label>
      <input type="number" id="fc-valor" min="0" step="0.01" required autofocus>
      <div id="fc-diferenca-wrap"></div>
      <label id="fc-just-label" hidden>Justificativa da diferença</label>
      <textarea id="fc-justificativa" hidden placeholder="Explique o motivo da diferença…"></textarea>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancelar-fechar">Cancelar</button>
        <button type="submit" class="btn btn-primary">Fechar caixa</button>
      </div>
    </form>
  `);

  const inputValor = document.getElementById("fc-valor");
  const diffWrap = document.getElementById("fc-diferenca-wrap");
  const justLabel = document.getElementById("fc-just-label");
  const justArea = document.getElementById("fc-justificativa");

  function atualizarDiferenca() {
    const contado = parseFloat(inputValor.value);
    if (isNaN(contado)) { diffWrap.innerHTML = ""; justLabel.hidden = true; justArea.hidden = true; return; }
    const diferenca = Number((contado - esperado).toFixed(2));
    const classe = diferenca === 0 ? "" : diferenca > 0 ? "pos" : "neg";
    diffWrap.innerHTML = `<div class="modal-diff ${classe}"><span>Diferença</span><strong>${diferenca > 0 ? "+" : ""}${formatarMoeda(diferenca)}</strong></div>`;
    const precisaJustificar = diferenca !== 0;
    justLabel.hidden = !precisaJustificar;
    justArea.hidden = !precisaJustificar;
    justArea.required = precisaJustificar;
  }
  inputValor.addEventListener("input", atualizarDiferenca);

  document.getElementById("btn-cancelar-fechar").addEventListener("click", fecharModal);
  document.getElementById("form-fechar-caixa").addEventListener("submit", async (e) => {
    e.preventDefault();
    const contado = parseFloat(inputValor.value) || 0;
    const diferenca = Number((contado - esperado).toFixed(2));
    if (diferenca !== 0 && !justArea.value.trim()) {
      toast("Informe a justificativa da diferença.", "error");
      return;
    }
    try {
      await updateDoc(doc(db, "cash_days", hoje), {
        fechado: true,
        dinheiro_final_esperado: esperado,
        dinheiro_final_contado: contado,
        diferenca,
        justificativa: justArea.value.trim(),
        vendas_dinheiro: totalDinheiro,
        fechado_em: serverTimestamp(),
        fechado_por: auth.currentUser?.email || ""
      });
      toast("Caixa fechado.", "success");
      fecharModal();
    } catch (err) {
      toast("Erro ao fechar caixa: " + err.message, "error");
    }
  });
}
