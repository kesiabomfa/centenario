import {
  db, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, writeBatch, serverTimestamp
} from "./firebase-init.js";
import { formatarMoeda, toast, abrirModal, fecharModal, escapeHtml } from "./utils.js";
import { store, notifyStore } from "./store.js";

export function iniciarProdutos() {
  const q = query(collection(db, "products"), orderBy("nome"));
  onSnapshot(q, (snap) => {
    store.produtos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTabelaProdutos();
    notifyStore();
  });

  document.getElementById("btn-novo-produto").addEventListener("click", () => abrirModalProduto());
  document.getElementById("input-importar").addEventListener("change", importarPlanilha);
}

function renderTabelaProdutos() {
  const tbody = document.querySelector("#tbl-produtos tbody");
  if (!store.produtos.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Nenhum produto cadastrado ainda.</td></tr>`;
    return;
  }
  tbody.innerHTML = store.produtos.map(p => `
    <tr>
      <td>${escapeHtml(p.nome)}</td>
      <td>${escapeHtml(p.cor || "—")}</td>
      <td class="num">${formatarMoeda(p.valor_custo)}</td>
      <td class="num">${formatarMoeda(p.valor_venda)}</td>
      <td class="num">${p.estoque_inicial ?? 0}</td>
      <td>
        <button class="btn btn-ghost btn-sm" data-editar="${p.id}">Editar</button>
        <button class="btn btn-ghost btn-sm" data-excluir="${p.id}">Excluir</button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-editar]").forEach(b =>
    b.addEventListener("click", () => abrirModalProduto(store.produtos.find(p => p.id === b.dataset.editar))));
  tbody.querySelectorAll("[data-excluir]").forEach(b =>
    b.addEventListener("click", () => confirmarExcluir(b.dataset.excluir)));
}

function abrirModalProduto(produto = null) {
  const editando = !!produto;
  abrirModal(`
    <h2>${editando ? "Editar produto" : "Novo produto"}</h2>
    <form id="form-produto">
      <label>Nome</label>
      <input type="text" id="p-nome" required value="${escapeHtml(produto?.nome || "")}">
      <label>Cor</label>
      <input type="text" id="p-cor" value="${escapeHtml(produto?.cor || "")}">
      <label>Valor de custo (R$)</label>
      <input type="number" id="p-custo" step="0.01" min="0" required value="${produto?.valor_custo ?? ""}">
      <label>Valor de venda (R$)</label>
      <input type="number" id="p-venda" step="0.01" min="0" required value="${produto?.valor_venda ?? ""}">
      <label>Estoque inicial</label>
      <input type="number" id="p-estoque" step="1" min="0" required value="${produto?.estoque_inicial ?? 0}">
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" id="btn-cancelar-produto">Cancelar</button>
        <button type="submit" class="btn btn-primary">${editando ? "Salvar" : "Adicionar"}</button>
      </div>
    </form>
  `);
  document.getElementById("btn-cancelar-produto").addEventListener("click", fecharModal);
  document.getElementById("form-produto").addEventListener("submit", async (e) => {
    e.preventDefault();
    const dados = {
      nome: document.getElementById("p-nome").value.trim(),
      cor: document.getElementById("p-cor").value.trim(),
      valor_custo: parseFloat(document.getElementById("p-custo").value) || 0,
      valor_venda: parseFloat(document.getElementById("p-venda").value) || 0,
      estoque_inicial: parseInt(document.getElementById("p-estoque").value) || 0
    };
    try {
      if (editando) {
        await updateDoc(doc(db, "products", produto.id), dados);
        toast("Produto atualizado.", "success");
      } else {
        await addDoc(collection(db, "products"), { ...dados, criado_em: serverTimestamp() });
        toast("Produto adicionado.", "success");
      }
      fecharModal();
    } catch (err) {
      toast("Erro ao salvar: " + err.message, "error");
    }
  });
}

function confirmarExcluir(id) {
  const p = store.produtos.find(x => x.id === id);
  abrirModal(`
    <h2>Excluir produto</h2>
    <p class="modal-sub">Tem certeza que deseja excluir <strong>${escapeHtml(p?.nome || "")}</strong>? As vendas e movimentações já registradas não serão apagadas.</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="btn-cancelar-excluir">Cancelar</button>
      <button class="btn btn-danger" id="btn-confirmar-excluir">Excluir</button>
    </div>
  `);
  document.getElementById("btn-cancelar-excluir").addEventListener("click", fecharModal);
  document.getElementById("btn-confirmar-excluir").addEventListener("click", async () => {
    try {
      await deleteDoc(doc(db, "products", id));
      toast("Produto excluído.", "success");
      fecharModal();
    } catch (err) {
      toast("Erro ao excluir: " + err.message, "error");
    }
  });
}

async function importarPlanilha(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const linhas = await lerPlanilha(file);
    if (!linhas.length) { toast("Planilha vazia ou em formato não reconhecido.", "error"); return; }

    const normalizados = linhas.map(normalizarLinha).filter(l => l.nome);
    if (!normalizados.length) {
      toast("Não encontrei as colunas nome/cor/valor_custo/valor_venda/estoque_inicial.", "error");
      return;
    }

    abrirModal(`
      <h2>Confirmar importação</h2>
      <p class="modal-sub">${normalizados.length} produto(s) encontrado(s) na planilha. Isso vai <strong>adicionar novos produtos</strong> (não substitui os já cadastrados).</p>
      <div class="table-wrap" style="max-height:260px;overflow-y:auto;">
        <table class="tbl"><thead><tr><th>Nome</th><th>Cor</th><th class="num">Custo</th><th class="num">Venda</th><th class="num">Estoque</th></tr></thead>
        <tbody>${normalizados.map(l => `<tr><td>${escapeHtml(l.nome)}</td><td>${escapeHtml(l.cor)}</td><td class="num">${formatarMoeda(l.valor_custo)}</td><td class="num">${formatarMoeda(l.valor_venda)}</td><td class="num">${l.estoque_inicial}</td></tr>`).join("")}</tbody></table>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="btn-cancelar-import">Cancelar</button>
        <button class="btn btn-primary" id="btn-confirmar-import">Importar ${normalizados.length} produto(s)</button>
      </div>
    `);
    document.getElementById("btn-cancelar-import").addEventListener("click", fecharModal);
    document.getElementById("btn-confirmar-import").addEventListener("click", async () => {
      try {
        const batch = writeBatch(db);
        normalizados.forEach(l => {
          const ref = doc(collection(db, "products"));
          batch.set(ref, { ...l, criado_em: serverTimestamp() });
        });
        await batch.commit();
        toast(`${normalizados.length} produto(s) importado(s).`, "success");
        fecharModal();
      } catch (err) {
        toast("Erro ao importar: " + err.message, "error");
      }
    });
  } catch (err) {
    toast("Erro ao ler a planilha: " + err.message, "error");
  } finally {
    e.target.value = "";
  }
}

function lerPlanilha(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve(json);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function pegarCampo(obj, alvos) {
  const chaves = Object.keys(obj);
  for (const alvo of alvos) {
    const achou = chaves.find(k => k.toString().trim().toLowerCase() === alvo);
    if (achou !== undefined) return obj[achou];
  }
  return "";
}

function normalizarLinha(row) {
  const parseNum = (v) => {
    if (typeof v === "number") return v;
    const s = (v ?? "").toString().trim().replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  return {
    nome: pegarCampo(row, ["nome", "produto", "nome do produto"]).toString().trim(),
    cor: pegarCampo(row, ["cor", "color"]).toString().trim(),
    valor_custo: parseNum(pegarCampo(row, ["valor_custo", "valor de custo", "custo"])),
    valor_venda: parseNum(pegarCampo(row, ["valor_venda", "valor de venda", "venda", "preço", "preco"])),
    estoque_inicial: Math.round(parseNum(pegarCampo(row, ["estoque_inicial", "estoque inicial", "quantidade", "qtd", "estoque"])))
  };
}
