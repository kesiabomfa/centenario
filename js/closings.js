import { db, collection, onSnapshot, query, orderBy } from "./firebase-init.js";
import { formatarMoeda, formatarDataBR, escapeHtml } from "./utils.js";

export function iniciarFechamentos() {
  const q = query(collection(db, "cash_days"), orderBy("data", "desc"));
  onSnapshot(q, (snap) => {
    const dias = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.fechado);
    renderTabela(dias);
  });
}

function renderTabela(dias) {
  const tbody = document.querySelector("#tbl-fechamentos tbody");
  if (!dias.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Nenhum fechamento registrado ainda.</td></tr>`;
    return;
  }
  tbody.innerHTML = dias.map(d => {
    const diferenca = d.diferenca || 0;
    const cor = diferenca === 0 ? "" : diferenca > 0 ? "style=\"color:var(--green)\"" : "style=\"color:var(--red)\"";
    return `<tr>
      <td>${formatarDataBR(d.id)}</td>
      <td class="num">${formatarMoeda(d.dinheiro_inicial)}</td>
      <td class="num">${formatarMoeda(d.vendas_dinheiro)}</td>
      <td class="num">${formatarMoeda(d.dinheiro_final_esperado)}</td>
      <td class="num">${formatarMoeda(d.dinheiro_final_contado)}</td>
      <td class="num" ${cor}>${diferenca > 0 ? "+" : ""}${formatarMoeda(diferenca)}</td>
      <td>${escapeHtml(d.justificativa || "—")}</td>
    </tr>`;
  }).join("");
}
