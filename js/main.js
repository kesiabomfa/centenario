import { initAuth } from "./auth.js";
import { iniciarProdutos } from "./products.js";
import { iniciarEstoque } from "./stock.js";
import { iniciarCaixa, onDadosMudaram } from "./caixa.js";
import { iniciarRelatorios } from "./reports.js";
import { iniciarFechamentos } from "./closings.js";
import { onStoreChange } from "./store.js";

let iniciado = false;

function iniciarApp() {
  if (iniciado) return; // evita registrar listeners duplicados em re-logins
  iniciado = true;

  iniciarProdutos();
  iniciarEstoque();
  iniciarCaixa();
  iniciarRelatorios();
  iniciarFechamentos();

  onStoreChange(() => onDadosMudaram());

  iniciarTabs();
}

function iniciarTabs() {
  const botoes = document.querySelectorAll(".tab-btn");
  botoes.forEach(btn => {
    btn.addEventListener("click", () => {
      botoes.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });
}

initAuth(
  () => iniciarApp(),
  () => {} // logout: os listeners do Firestore continuam registrados, mas as regras de segurança bloqueiam leitura sem login
);
