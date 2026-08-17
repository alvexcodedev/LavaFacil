// =========================================================
// AUTENTICAÇÃO DO PAINEL ADMIN
// Crie o usuário admin em: Firebase Console > Authentication > Users
// =========================================================
import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const $ = (sel) => document.querySelector(sel);

export function initAuth({ onLogin, onLogout }) {
  const loginScreen = $("#login-screen");
  const shell = $("#admin-shell");
  const form = $("#login-form");
  const errEl = $("#login-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.classList.remove("show");
    const email = $("#login-email").value.trim();
    const senha = $("#login-senha").value;
    const btn = $("#login-btn");
    btn.disabled = true;
    btn.textContent = "Entrando…";
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (err) {
      errEl.textContent = "E-mail ou senha inválidos.";
      errEl.classList.add("show");
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });

  $("#btn-logout").addEventListener("click", () => signOut(auth));

  onAuthStateChanged(auth, (user) => {
    if (user) {
      loginScreen.style.display = "none";
      shell.classList.add("active");
      onLogin(user);
    } else {
      loginScreen.style.display = "flex";
      shell.classList.remove("active");
      onLogout?.();
    }
  });
}
