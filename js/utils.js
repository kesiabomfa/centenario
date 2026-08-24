export function formatarMoeda(v) {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function hojeISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

export function mesISO() {
  return hojeISO().slice(0, 7);
}

export function formatarDataBR(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatarHora(date) {
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export const ROTULO_PAGAMENTO = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  debito: "Débito",
  credito: "Crédito"
};

export function rotuloPagamento(p) {
  if (p.forma === "credito") {
    const n = Number(p.parcelas) || 1;
    return n <= 1 ? "Crédito à vista" : `Crédito ${n}x`;
  }
  return ROTULO_PAGAMENTO[p.forma] || p.forma;
}

let toastTimer;
export function toast(msg, tipo = "") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast" + (tipo ? " " + tipo : "");
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

const overlay = () => document.getElementById("modal-overlay");
const box = () => document.getElementById("modal-box");

export function abrirModal(html) {
  box().innerHTML = html;
  overlay().hidden = false;
}

export function fecharModal() {
  overlay().hidden = true;
  box().innerHTML = "";
}

overlayClickToClose();
function overlayClickToClose() {
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("modal-overlay").addEventListener("click", (e) => {
      if (e.target.id === "modal-overlay") fecharModal();
    });
  });
}

export function escapeHtml(s) {
  return (s ?? "").toString()
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
