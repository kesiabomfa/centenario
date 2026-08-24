import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "./firebase-init.js";
import { toast, abrirModal, fecharModal, escapeHtml, hojeISO, formatarDataBR } from "./utils.js";
import { store, notifyStore, calcularSaldos } from "./store.js";

const ROTULOS_TIPO = { reposicao: "Reposição", perda: "Perda", doacao: "Doação" };
const CLASSE_TIPO = { reposicao: "tag-reposicao", perda: "tag-perda", doacao: "tag-doacao" };

export function iniciarEstoque() {
  const q = query(collection(db, "stock_movements"), orderBy("data", "desc"));
  onSnapshot(q, (snap) => {
    store.movimentacoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTabelaEstoque();
    renderTabelaMovimentacoes();
    notifyStore();
  });

  document.getElementById("btn-add-reposicao").addEventListener("click", () => abrirModalMovimento("reposicao"));
  document.getElementById("btn-add-perda").addEventListener("click", () => abrirModalMovimento("perda"));
}

function renderTabelaEstoque() {
  const tbody = document.querySelector("#tbl-estoque tbody");
  const saldos = calcularSaldos();
  const linhas = Object.values(saldos);
  if (!linhas.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Cadastre produtos na aba "Produtos" para ver o estoque.</td></tr>`;
    return;
  }
  tbody.innerHTML = linhas
    .sort((a, b) => a.produto.nome.localeCompare(b.produto.nome))
    .map(l => `
      <tr>
        <td>${escapeHtml(l.produto.nome)}</td>
        <td>${escapeHtml(l.produto.cor || "—")}</td>
        <td class="num">${l.estoque_inicial}</td>
        <td class="num">${l.reposicao}</td>
        <td class="num">${l.vendido}</td>
        <td class="num">${l.perda}</td>
        <td class="num"><strong>${l.saldo}</strong></td>
      </tr>
    `).join("");
}

function renderTabelaMovimentacoes() {
  const tbody = document.querySelector("#tbl-movimentacoes tbody");
  if (!store.movimentacoes.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Nenhuma movimentação registrada.</td></tr>`;
    return;
  }
  tbody.innerHTML = store.movimentacoes.map(m => {
    const produto = store.produtos.find(p => p.id === m.produto_id);
    return `
      <tr>
        <td>${formatarDataBR(m.data)}</td>
        <td>${escapeHtml(produto?.nome || "(produto removido)")}</td>
        <td><span class="tag ${CLASSE_TIPO[m.tipo] || ""}">${ROTULOS_TIPO[m.tipo] || m.tipo}</span></td>
        <td class="num">${m.quantidade}</td>
        <td>${escapeHtml(m.observacao || "—")}</td>
      </tr>`;
  }).join("");
}

function abrirModalMovimento(tipoInicial) {
  if (!store.produtos.length) {
    toast("Cadastre ao menos um produto antes de registrar movimentações.", "error");
    return;
  }
  const opcoesProdutos = store.produtos
    .map(p => `<option value="${p.id}">${escapeHtml(p.nome)}${p.cor ? " — " + escapeHtml(p.cor) : ""}</option>`)
    .join("");

  abrirModal(`
    <h2>${tipoInicial === "reposicao" ? "Registrar reposição" : "Registrar perda / doação"}</h2>
    <form id="form-movimento">
      <label>Produto</label>
      <select id="m-produto" required>${opcoesProdutos}</select>

      <label>Tipo</label>
      <select id="m-tipo" required>
        <option value="reposicao" ${tipoInicial === "reposicao" ? "selected" : ""}>Reposição (entrada)</option>
        <option value="perda" ${tipoInicial === "perda" ? "selected" : ""}>Perda</option>
        <option value="doacao">Doação</option>
      </select>

      <label>Quantidade</label>
      <input type="number" id="m-qtd" min="1" step="1" required>

      <label>Data</label>
      <input type="date" id="m-data" value="${hojeISO()}" required>

      <label>Observação (opcional)</label>
      <textarea id="m-obs" placeholder="Ex: reposição do fornecedor X, produto danificado, doado para..."></textarea>

      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancelar-mov">Cancelar</button>
        <button type="submit" class="btn btn-primary">Registrar</button>
      </div>
    </form>
  `);

  document.getElementById("btn-cancelar-mov").addEventListener("click", fecharModal);
  document.getElementById("form-movimento").addEventListener("submit", async (e) => {
    e.preventDefault();
    const dados = {
      produto_id: document.getElementById("m-produto").value,
      tipo: document.getElementById("m-tipo").value,
      quantidade: parseInt(document.getElementById("m-qtd").value) || 0,
      data: document.getElementById("m-data").value,
      observacao: document.getElementById("m-obs").value.trim(),
      criado_em: serverTimestamp()
    };
    if (dados.quantidade <= 0) { toast("Informe uma quantidade maior que zero.", "error"); return; }
    try {
      await addDoc(collection(db, "stock_movements"), dados);
      toast("Movimentação registrada.", "success");
      fecharModal();
    } catch (err) {
      toast("Erro ao registrar: " + err.message, "error");
    }
  });
}
