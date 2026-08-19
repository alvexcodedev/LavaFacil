// =========================================================
// LÓGICA DA PÁGINA PÚBLICA DE AGENDAMENTO
// =========================================================
import { db } from "./firebase-config.js";
import { SERVICOS, HORARIO_FUNCIONAMENTO, TELEFONE_NEGOCIO } from "./config.js";
import {
  collection, addDoc, doc, setDoc, getDoc, query, where, getDocs,
  Timestamp, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const state = {
  step: 1,
  nome: "", telefone: "",
  carroModelo: "", placa: "",
  servico: null,
  data: null,        
  horaInicio: null,  
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function showToast(msg, isError = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 3200);
}

/* ---------------- máscara & validação ---------------- */
function maskTelefone(v) {
  v = v.replace(/\D/g, "").slice(0, 11);
  if (v.length > 6) return v.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
  if (v.length > 2) return v.replace(/(\d{2})(\d{0,5})/, "($1) $2").trim();
  return v;
}
function maskPlaca(v) {
  v = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
  return v;
}
function placaValida(v) {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(v); 
}

/* ---------------- steps navigation ---------------- */
function goToStep(n) {
  state.step = n;
  $$(".step-panel").forEach((p) => (p.hidden = Number(p.dataset.step) !== n));
  $$(".step-dot").forEach((d, i) => {
    d.classList.toggle("active", i + 1 === n);
    d.classList.toggle("done", i + 1 < n);
  });
  $$(".step-line").forEach((l, i) => l.classList.toggle("done", i + 1 < n));
  if (n === 4) renderResumo();
  $("#ticket").scrollIntoView({ behavior: "smooth", block: "start" });
}

function validarStep1() {
  let ok = true;
  if (state.nome.trim().length < 3) { setErr("#err-nome", "Informe seu nome completo"); ok = false; } else setErr("#err-nome");
  const digits = state.telefone.replace(/\D/g, "");
  if (digits.length < 10) { setErr("#err-telefone", "Informe um telefone válido com DDD"); ok = false; } else setErr("#err-telefone");
  return ok;
}
function validarStep2() {
  let ok = true;
  if (state.carroModelo.trim().length < 2) { setErr("#err-carro", "Informe o modelo do carro"); ok = false; } else setErr("#err-carro");
  if (!placaValida(state.placa)) { setErr("#err-placa", "Placa inválida (ex: ABC1D23)"); ok = false; } else setErr("#err-placa");
  return ok;
}
function setErr(sel, msg) {
  const el = $(sel);
  if (!el) return;
  if (msg) { el.textContent = msg; el.classList.add("show"); }
  else el.classList.remove("show");
}

/* ---------------- serviços ---------------- */
function renderServicos() {
  const wrap = $("#service-grid");
  wrap.innerHTML = SERVICOS.map((s) => `
    <div class="service-card" data-id="${s.id}" role="button" tabindex="0">
      <b>${s.nome}</b>
      <span class="meta">~${s.duracaoMin} min</span>
      <span class="price">R$ ${s.preco.toFixed(2).replace(".", ",")}</span>
    </div>`).join("");
  wrap.addEventListener("click", (e) => {
    const card = e.target.closest(".service-card");
    if (!card) return;
    state.servico = SERVICOS.find((s) => s.id === card.dataset.id);
    $$(".service-card").forEach((c) => c.classList.remove("selected"));
    card.classList.add("selected");
    $("#btn-step3-next").disabled = false;
  });
}

/* ---------------- horários / slots ---------------- */
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function minutesToHHMM(min) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function buscarAgendamentosDoDia(dataStr) {
  const inicioDia = new Date(`${dataStr}T00:00:00`);
  const fimDia = new Date(`${dataStr}T23:59:59`);
  const q = query(
    collection(db, "agendamentos"),
    where("inicio", ">=", Timestamp.fromDate(inicioDia)),
    where("inicio", "<=", Timestamp.fromDate(fimDia))
  );
  const snap = await getDocs(q);
  const ocupados = [];
  snap.forEach((d) => {
    const a = d.data();
    if (a.status === "cancelado") return;
    const ini = a.inicio.toDate();
    ocupados.push({ inicio: ini.getHours() * 60 + ini.getMinutes(), duracaoMin: a.duracaoMin || 60 });
  });
  return ocupados;
}

async function renderSlots() {
  const wrap = $("#slots");
  wrap.innerHTML = `<div class="slots-empty">Carregando horários…</div>`;
  const dataStr = state.data;
  if (!dataStr || !state.servico) return;

  const diaSemana = new Date(`${dataStr}T12:00:00`).getDay();
  if (!HORARIO_FUNCIONAMENTO.diasAtivos.includes(diaSemana)) {
    wrap.innerHTML = `<div class="slots-empty">Fechado nesse dia. Escolha outra data.</div>`;
    return;
  }

  const ocupados = await buscarAgendamentosDoDia(dataStr);
  const abre = toMinutes(HORARIO_FUNCIONAMENTO.abre);
  const fecha = toMinutes(HORARIO_FUNCIONAMENTO.fecha);
  const passo = HORARIO_FUNCIONAMENTO.intervaloSlotMin;
  const duracao = state.servico.duracaoMin;

  const agora = new Date();
  const ehHoje = dataStr === localDateStr(agora);
  const minMinutosHoje = agora.getHours() * 60 + agora.getMinutes() + HORARIO_FUNCIONAMENTO.antecedenciaMinMin;

  const slots = [];
  for (let t = abre; t + duracao <= fecha; t += passo) {
    let ocupado = ocupados.some((o) => t < o.inicio + o.duracaoMin && t + duracao > o.inicio);
    let passado = ehHoje && t < minMinutosHoje;
    slots.push({ minutos: t, ocupado: ocupado || passado });
  }

  if (!slots.length) {
    wrap.innerHTML = `<div class="slots-empty">Sem horários disponíveis para essa data.</div>`;
    return;
  }

  wrap.innerHTML = slots.map((s) => `
    <button type="button" class="slot-btn" data-min="${s.minutos}" ${s.ocupado ? "disabled" : ""}>
      ${minutesToHHMM(s.minutos)}
    </button>`).join("");

  if (slots.every((s) => s.ocupado)) {
    wrap.innerHTML += `<div class="slots-empty">Todos os horários desse dia já foram preenchidos.</div>`;
  }
}

/* ---------------- resumo & envio ---------------- */
function renderResumo() {
  const [h, m] = [Math.floor(toMinutes(state.horaInicio) / 60), toMinutes(state.horaInicio) % 60];
  const dataFmt = new Date(`${state.data}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  $("#resumo").innerHTML = `
    <div class="summary-row"><span>Cliente</span><span>${state.nome}</span></div>
    <div class="summary-row"><span>Telefone</span><span>${state.telefone}</span></div>
    <div class="summary-row"><span>Carro</span><span>${state.carroModelo}</span></div>
    <div class="summary-row"><span>Placa</span><span>${state.placa}</span></div>
    <div class="summary-row"><span>Serviço</span><span>${state.servico.nome}</span></div>
    <div class="summary-row"><span>Quando</span><span>${dataFmt}, ${state.horaInicio}</span></div>
    <div class="summary-row"><span>Valor</span><span>R$ ${state.servico.preco.toFixed(2).replace(".", ",")}</span></div>
  `;
}

async function enviarAgendamento() {
  const btn = $("#btn-confirmar");
  btn.disabled = true;
  btn.textContent = "Enviando…";
  try {
    const inicioDate = new Date(`${state.data}T${state.horaInicio}:00`);
    const fimDate = new Date(inicioDate.getTime() + state.servico.duracaoMin * 60000);

    await addDoc(collection(db, "agendamentos"), {
      clienteNome: state.nome.trim(),
      telefone: state.telefone,
      carroModelo: state.carroModelo.trim(),
      placa: state.placa,
      servicoId: state.servico.id,
      servicoNome: state.servico.nome,
      duracaoMin: state.servico.duracaoMin,
      preco: state.servico.preco,
      inicio: Timestamp.fromDate(inicioDate),
      fim: Timestamp.fromDate(fimDate),
      status: "pendente",
      pago: false,
      observacoes: "",
      origem: "cliente",
      criadoEm: serverTimestamp(),
    });

    await setDoc(doc(db, "clientes", state.placa), {
      nome: state.nome.trim(),
      telefone: state.telefone,
      carroModelo: state.carroModelo.trim(),
      placa: state.placa,
      atualizadoEm: serverTimestamp(),
    }, { merge: true });

    goToStep(6);

    const numeroLavaExpresso = "18996746300";
    const dataFormatada = state.data.split('-').reverse().join('/');
    const msgCliente = `Olá! Acabei de fazer um agendamento no site.\n\n🚗 *Veículo:* ${state.carroModelo} (${state.placa})\n📅 *Data:* ${dataFormatada} às ${state.horaInicio}\n💧 *Serviço:* ${state.servico.nome}`;
    
    window.open(`https://wa.me/55${numeroLavaExpresso}?text=${encodeURIComponent(msgCliente)}`, "_blank");

  } catch (err) {
    console.error(err);
    showToast("Não foi possível enviar. Tente novamente.", true);
    btn.disabled = false;
    btn.textContent = "Confirmar solicitação";
  }
}

/* ---------------- bind ---------------- */
function bind() {
  renderServicos();

  // ==========================================
  // LÓGICA DE BLOQUEIO DE EMERGÊNCIA NO CLIENTE
  // ==========================================
  onSnapshot(doc(db, "configuracoes", "sistema"), (snap) => {
    const msgBloqueio = $("#msg-bloqueio");
    const ticket = $("#ticket");
    const txtBloqueio = $("#txt-bloqueio");

    if (snap.exists() && snap.data().bloqueado) {
      if (ticket) ticket.style.display = "none";
      if (msgBloqueio) msgBloqueio.style.display = "block";
      if (txtBloqueio && snap.data().mensagem) {
        txtBloqueio.textContent = snap.data().mensagem;
      }
    } else {
      if (ticket) ticket.style.display = "block";
      if (msgBloqueio) msgBloqueio.style.display = "none";
    }
  });

  $("#input-nome").addEventListener("input", (e) => (state.nome = e.target.value));
  $("#input-telefone").addEventListener("input", (e) => {
    e.target.value = maskTelefone(e.target.value);
    state.telefone = e.target.value;
  });
  $("#input-carro").addEventListener("input", (e) => (state.carroModelo = e.target.value));
  $("#input-placa").addEventListener("input", (e) => {
    e.target.value = maskPlaca(e.target.value);
    state.placa = e.target.value;
  });
  $("#input-data").addEventListener("change", (e) => {
    state.data = e.target.value;
    state.horaInicio = null;
    $("#btn-step4-next").disabled = true;
    renderSlots();
  });
  $("#slots").addEventListener("click", (e) => {
    const btn = e.target.closest(".slot-btn");
    if (!btn || btn.disabled) return;
    state.horaInicio = minutesToHHMM(Number(btn.dataset.min));
    $$(".slot-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    $("#btn-step4-next").disabled = false;
  });

  $("#btn-step1-next").addEventListener("click", () => validarStep1() && goToStep(2));
  $("#btn-step2-back").addEventListener("click", () => goToStep(1));
  $("#btn-step2-next").addEventListener("click", () => validarStep2() && goToStep(3));
  $("#btn-step3-back").addEventListener("click", () => goToStep(2));
  $("#btn-step3-next").addEventListener("click", () => goToStep(4));
  $("#btn-step4-back").addEventListener("click", () => goToStep(3));
  $("#btn-step4-next").addEventListener("click", () => goToStep(5));
  $("#btn-confirmar").addEventListener("click", enviarAgendamento);

  const min = new Date();
  $("#input-data").min = localDateStr(min);
}

function aplicarServicoDaURL() {
  const params = new URLSearchParams(window.location.search);
  const servicoId = params.get("servico");
  if (!servicoId) return;
  const servico = SERVICOS.find((s) => s.id === servicoId);
  if (!servico) return;
  state.servico = servico;
  const card = document.querySelector(`.service-card[data-id="${servico.id}"]`);
  if (card) {
    card.classList.add("selected");
    $("#btn-step3-next").disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bind();
  aplicarServicoDaURL();
});

document.addEventListener("DOMContentLoaded", () => {
  const els = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => en.isIntersecting && en.target.classList.add("in"));
  }, { threshold: 0.15 });
  els.forEach((el) => io.observe(el));
});
