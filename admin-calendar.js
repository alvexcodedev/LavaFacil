// =========================================================
// PAINEL ADMIN — calendário, criação/edição/cancelamento,
// estatísticas do dashboard e filtros vindos dos cards.
// =========================================================
import { db } from "./firebase-config.js";
import { SERVICOS } from "./config.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc, getDoc, onSnapshot,
  Timestamp, serverTimestamp, orderBy, query
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let calendar;
let agendamentosCache = new Map();
let modalMode = "create"; // "create" | "edit"
let editingId = null;
let statsCallback = null;

let currentFilter = { status: null, onlyToday: false, pago: null, label: "" };

function showToast(msg, isError = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 3000);
}

function isHoje(dateObj) {
  const hoje = new Date();
  return dateObj.getFullYear() === hoje.getFullYear() &&
         dateObj.getMonth() === hoje.getMonth() &&
         dateObj.getDate() === hoje.getDate();
}

function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ---------------- helpers de evento ---------------- */
function classNamesFor(a) {
  if (a.status === "cancelado") return ["st-cancelado"];
  if (a.status === "confirmado" && a.pago) return ["st-pago"];
  if (a.status === "concluido") return ["st-pago"];
  if (a.status === "confirmado") return ["st-confirmado"];
  return ["st-pendente"];
}

function eventTitle(a) {
  const pagoIcon = a.pago ? "💧" : "";
  return `${a.clienteNome.split(" ")[0]} · ${a.servicoNome} ${pagoIcon}`;
}

function fillServiceSelect() {
  const sel = $("#f-servico");
  sel.innerHTML = SERVICOS.map((s) => `<option value="${s.id}">${s.nome} — R$ ${s.preco.toFixed(2)} (${s.duracaoMin}min)</option>`).join("");
}

/* ---------------- estatísticas para o dashboard ---------------- */
function computeStats() {
  const stats = {
    pendentes: 0, confirmadosGerais: 0, concluidosGerais: 0,
    canceladosGerais: 0, totalHoje: 0, faturamentoHoje: 0, proximos: [],
  };
  const agora = new Date();
  agendamentosCache.forEach((a, id) => {
    const ini = a.inicio.toDate();
    
    // Contagem GERAL (Independente do dia/mês)
    if (a.status === "pendente") stats.pendentes++;
    if (a.status === "confirmado") stats.confirmadosGerais++;
    if (a.status === "concluido") stats.concluidosGerais++;
    if (a.status === "cancelado") stats.canceladosGerais++;

    // Contagem HOJE
    if (isHoje(ini) && a.status !== "cancelado") {
      stats.totalHoje++;
      if (a.pago) stats.faturamentoHoje += a.preco || 0;
    }
    
    if (ini >= agora && a.status !== "cancelado" && a.status !== "concluido") {
      stats.proximos.push({ ...a, _inicio: ini, _id: id });
    }
  });
  stats.proximos.sort((x, y) => x._inicio - y._inicio);
  stats.proximos = stats.proximos.slice(0, 5);
  return stats;
}

export function onStats(cb) {
  statsCallback = cb;
}

/* ---------------- filtro aplicado ao calendário ---------------- */
function eventoPassaNoFiltro(a, iniDate) {
  // Agora os filtros funcionam em conjunto (ex: Hoje + Pendente)
  if (currentFilter.status && a.status !== currentFilter.status) return false;
  if (currentFilter.onlyToday && !isHoje(iniDate)) return false;
  if (currentFilter.pago === true && !a.pago) return false; 
  return true;
}

function renderEventosFiltrados() {
  if (calendar) {
    calendar.refetchEvents();
  }
}

export function setFilter({ status = null, onlyToday = false, pago = null, label = "", view = null } = {}) {
  // Sobrepõe o filtro atual com o que veio do Card do Dashboard
  currentFilter = { status, onlyToday, pago, label };
  
  if (view && calendar) calendar.changeView(view);
  if (onlyToday && calendar) calendar.gotoDate(new Date());

  // 1. Sincroniza o select nativo da agenda para refletir o status
  const selectAgenda = $("#agenda-status-filter");
  if (selectAgenda) {
    selectAgenda.value = status || "";
  }

  // 2. Sincroniza a tag "Filtro: [Nome]" (Chip)
  const chip = $("#filter-chip");
  if (label) {
    chip.hidden = false;
    chip.querySelector(".label").textContent = label;
  } else {
    chip.hidden = true;
  }

  renderEventosFiltrados();
}

export function clearFilter() {
  // Reseta completamente as variáveis de filtro
  currentFilter = { status: null, onlyToday: false, pago: null, label: "" };
  
  // Reseta o visual do select para "Todos os status"
  const selectAgenda = $("#agenda-status-filter");
  if (selectAgenda) selectAgenda.value = "";

  // Oculta a chip
  const chip = $("#filter-chip");
  if (chip) chip.hidden = true;

  renderEventosFiltrados();
}

export function resizeCalendar() {
  calendar?.updateSize();
}

/* ---------------- calendário ---------------- */
export function initCalendar() {
  fillServiceSelect();
  const el = $("#calendar");
  calendar = new FullCalendar.Calendar(el, {
    locale: "pt-br",
    height: "auto",
    initialView: "dayGridMonth",
    headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" },
    buttonText: { today: "Hoje", month: "Mês", week: "Semana", day: "Dia", list: "Lista" },
    slotMinTime: "07:00:00",
    slotMaxTime: "20:00:00",
    editable: true,
    eventStartEditable: true,
    eventDurationEditable: false,
    nowIndicator: true,
    dayMaxEvents: 3,
    
    events: function(fetchInfo, successCallback, failureCallback) {
      const eventosFiltrados = [];
      agendamentosCache.forEach((a, id) => {
        const ini = a.inicio.toDate();
        if (eventoPassaNoFiltro(a, ini)) {
          eventosFiltrados.push({
            id: id,
            title: eventTitle(a),
            start: ini,
            end: a.fim.toDate(),
            classNames: classNamesFor(a),
            allDay: false, 
            extendedProps: {
              cliente: a.clienteNome,
              carro: a.carroModelo,
              placa: a.placa,
              servico: a.servicoNome
            }
          });
        }
      });
      successCallback(eventosFiltrados);
    },

    eventDidMount: function(info) {
      const p = info.event.extendedProps;
      const balaoDeTexto = `Cliente: ${p.cliente}\nCarro: ${p.carro}\nPlaca: ${p.placa}\nServiço: ${p.servico}`;
      info.el.setAttribute("title", balaoDeTexto);
    },

    eventClick(info) { openEditModal(info.event.id); },
    dateClick(info) { openCreateModal(info.date); },
    eventDrop(info) { reagendar(info.event.id, info.event.start); },
  });
  calendar.render();

  $("#filter-chip-clear").addEventListener("click", clearFilter);

  onSnapshot(query(collection(db, "agendamentos"), orderBy("inicio", "asc")), (snap) => {
    agendamentosCache.clear();
    snap.forEach((d) => agendamentosCache.set(d.id, d.data()));
    renderEventosFiltrados();
    const stats = computeStats();
    statsCallback?.(stats);
  });
}

async function reagendar(id, novaData) {
  const a = agendamentosCache.get(id);
  if (!a) return;
  const duracaoMs = a.fim.toDate() - a.inicio.toDate();
  try {
    await updateDoc(doc(db, "agendamentos", id), {
      inicio: Timestamp.fromDate(novaData),
      fim: Timestamp.fromDate(new Date(novaData.getTime() + duracaoMs)),
    });
    showToast("Agendamento reagendado.");
  } catch (err) {
    console.error(err);
    showToast("Erro ao reagendar.", true);
    calendar.refetchEvents();
  }
}

/* ---------------- modal ---------------- */
function resetForm() {
  $("#agendamento-form").reset();
  $$(".status-chip").forEach((c) => c.classList.remove("active"));
  setStatusChip("pendente");
  $("#f-pago").checked = false;
  $("#modal-delete-row").hidden = true;
}

function setStatusChip(v) {
  $$(".status-chip").forEach((c) => c.classList.toggle("active", c.dataset.v === v));
  $("#f-status-hidden").value = v;
}

function openCreateModal(date) {
  modalMode = "create";
  editingId = null;
  resetForm();
  $("#modal-title").textContent = "Novo agendamento";
  $("#modal-sub").textContent = "Preencha os dados — o horário já entra como confirmado.";
  setStatusChip("confirmado");
  if (date) {
    $("#f-data").value = localDateStr(date);
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    $("#f-hora").value = date.getHours() ? `${hh}:${mm}` : "09:00";
  } else {
    $("#f-data").value = localDateStr(new Date());
    $("#f-hora").value = "09:00";
  }
  $("#modal-overlay").classList.add("open");
}

export function openEditModal(id) {
  const a = agendamentosCache.get(id);
  if (!a) return;
  modalMode = "edit";
  editingId = id;
  resetForm();
  $("#modal-title").textContent = "Editar agendamento";
  $("#modal-sub").textContent = `Criado ${a.origem === "cliente" ? "pelo cliente" : "pela equipe"}`;

  $("#f-nome").value = a.clienteNome;
  $("#f-telefone").value = a.telefone;
  $("#f-carro").value = a.carroModelo;
  $("#f-placa").value = a.placa;
  $("#f-servico").value = a.servicoId;
  const ini = a.inicio.toDate();
  $("#f-data").value = localDateStr(ini);
  $("#f-hora").value = `${String(ini.getHours()).padStart(2, "0")}:${String(ini.getMinutes()).padStart(2, "0")}`;
  $("#f-obs").value = a.observacoes || "";
  $("#f-pago").checked = !!a.pago;
  setStatusChip(a.status);

  $("#modal-delete-row").hidden = false;
  $("#modal-overlay").classList.add("open");
}

function closeModal() {
  $("#modal-overlay").classList.remove("open");
}

async function lookupClientePorPlaca() {
  const placaEl = $("#f-placa");
  const placa = placaEl.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  placaEl.value = placa;
  if (modalMode !== "create" || placa.length < 7) return;
  try {
    const snap = await getDoc(doc(db, "clientes", placa));
    if (snap.exists()) {
      const c = snap.data();
      if (!$("#f-nome").value) $("#f-nome").value = c.nome || "";
      if (!$("#f-telefone").value) $("#f-telefone").value = c.telefone || "";
      if (!$("#f-carro").value) $("#f-carro").value = c.carroModelo || "";
      showToast("Cliente encontrado — dados preenchidos.");
    }
  } catch (err) { /* silencioso */ }
}

async function salvarAgendamento(e) {
  e.preventDefault();
  const nome = $("#f-nome").value.trim();
  const telefone = $("#f-telefone").value.trim();
  const carroModelo = $("#f-carro").value.trim();
  const placa = $("#f-placa").value.trim().toUpperCase();
  const servicoId = $("#f-servico").value;
  const servico = SERVICOS.find((s) => s.id === servicoId);
  const data = $("#f-data").value;
  const hora = $("#f-hora").value;
  const status = $("#f-status-hidden").value;
  const pago = $("#f-pago").checked;
  const observacoes = $("#f-obs").value.trim();

  if (!nome || !telefone || !carroModelo || !placa || !data || !hora) {
    showToast("Preencha todos os campos obrigatórios.", true);
    return;
  }

  const inicio = new Date(`${data}T${hora}:00`);
  const fim = new Date(inicio.getTime() + servico.duracaoMin * 60000);

  const payload = {
    clienteNome: nome, telefone, carroModelo, placa,
    servicoId: servico.id, servicoNome: servico.nome, duracaoMin: servico.duracaoMin, preco: servico.preco,
    inicio: Timestamp.fromDate(inicio), fim: Timestamp.fromDate(fim),
    status, pago, observacoes,
  };

  const btn = $("#btn-salvar");
  btn.disabled = true;
  try {
    if (modalMode === "create") {
      await addDoc(collection(db, "agendamentos"), { ...payload, origem: "admin", criadoEm: serverTimestamp() });
      showToast("Agendamento criado.");
    } else {
      await updateDoc(doc(db, "agendamentos", editingId), payload);
      showToast("Agendamento atualizado.");
    }
    await setDoc(doc(db, "clientes", placa), {
      nome, telefone, carroModelo, placa, atualizadoEm: serverTimestamp(),
    }, { merge: true });
    closeModal();
  } catch (err) {
    console.error(err);
    showToast("Erro ao salvar. Tente novamente.", true);
  } finally {
    btn.disabled = false;
  }
}

async function cancelarAgendamento() {
  if (!editingId) return;
  if (!confirm("Cancelar este agendamento?")) return;
  try {
    await updateDoc(doc(db, "agendamentos", editingId), { status: "cancelado" });
    showToast("Agendamento cancelado.");
    closeModal();
  } catch (err) {
    showToast("Erro ao cancelar.", true);
  }
}

async function excluirAgendamento() {
  if (!editingId) return;
  if (!confirm("Excluir definitivamente este agendamento? Essa ação não pode ser desfeita.")) return;
  try {
    await deleteDoc(doc(db, "agendamentos", editingId));
    showToast("Agendamento excluído.");
    closeModal();
  } catch (err) {
    showToast("Erro ao excluir.", true);
  }
}

/* ---------------- bind ---------------- */
export function bindAdminUI() {
  $("#btn-novo-agendamento").addEventListener("click", () => openCreateModal(null));
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal-overlay").addEventListener("click", (e) => { if (e.target.id === "modal-overlay") closeModal(); });
  $("#agendamento-form").addEventListener("submit", salvarAgendamento);
  $("#f-placa").addEventListener("blur", lookupClientePorPlaca);
  $("#btn-cancelar-agendamento").addEventListener("click", cancelarAgendamento);
  $("#btn-excluir-agendamento").addEventListener("click", excluirAgendamento);
  $$(".status-chip").forEach((c) => c.addEventListener("click", () => setStatusChip(c.dataset.v)));

  const selectAgenda = $("#agenda-status-filter");
  if (selectAgenda) {
    selectAgenda.addEventListener("change", (e) => {
      // O SEGREDO AQUI: Em vez de sobrescrever tudo, apenas atualiza a propriedade 
      // de "status" dentro do objeto de filtro que já está funcionando no momento.
      currentFilter.status = e.target.value || null;
      renderEventosFiltrados();
    });
  }
}
