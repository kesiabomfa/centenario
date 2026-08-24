import { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "./firebase-init.js";
import { toast } from "./utils.js";

export function initAuth(onLogin, onLogout) {
  const telaLogin = document.getElementById("tela-login");
  const app = document.getElementById("app");
  const form = document.getElementById("form-login");
  const erroEl = document.getElementById("login-erro");
  const btnLogin = document.getElementById("btn-login");
  const btnLogout = document.getElementById("btn-logout");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erroEl.hidden = true;
    btnLogin.disabled = true;
    btnLogin.textContent = "Entrando…";
    const email = document.getElementById("login-email").value.trim();
    const senha = document.getElementById("login-senha").value;
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (err) {
      erroEl.textContent = traduzErro(err.code);
      erroEl.hidden = false;
    } finally {
      btnLogin.disabled = false;
      btnLogin.textContent = "Entrar";
    }
  });

  btnLogout.addEventListener("click", async () => {
    await signOut(auth);
    toast("Sessão encerrada.");
  });

  onAuthStateChanged(auth, (user) => {
    if (user) {
      telaLogin.hidden = true;
      app.hidden = false;
      document.getElementById("user-email").textContent = user.email;
      onLogin(user);
    } else {
      app.hidden = true;
      telaLogin.hidden = false;
      onLogout();
    }
  });
}

function traduzErro(code) {
  const mapa = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um instante e tente novamente.",
    "auth/network-request-failed": "Falha de conexão. Verifique a internet."
  };
  return mapa[code] || "Não foi possível entrar. Tente novamente.";
}
