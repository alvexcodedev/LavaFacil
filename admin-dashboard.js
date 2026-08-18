// =========================================================
// PAINEL ADMIN — dashboard inicial com cards de indicadores
// =========================================================
import { onStats, setFilter, openEditModal } from "./admin-calendar.js";

const $ = (sel) => document.querySelector(sel);

function fmtMoeda(v) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

function fmtHora(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function renderProximos(lista) {
  const wrap = $("#dash-proximos");
  if (!lista.length) {
    wrap.innerHTML = `<p class="muted-empty">Nenhum agendamento futuro no momento.</p>`;
    return;
  }
  wrap.innerHTML = lista.map((a) => `
    <button type="button" class="proximo-row" data-id="${a._id}">
      <span class="hora">${fmtHora(a._inicio)}</span>
      <span class="info">
        <b>${a.clienteNome}</b>
        <span>${a.servicoNome} · ${a.placa}</span>
      </span>
      <span class="badge badge-${a.status}">${a.status}</span>
    </button>
  `).join("");
  wrap.querySelectorAll(".proximo-row").forEach((btn) => {
    btn.addEventListener("click", () => {
      goToAgenda();
      setTimeout(() => openEditModal(btn.dataset.id), 50);
    });
  });
}

function goToAgenda() {
  document.querySelector('.admin-tab[data-view="agenda"]').click();
}

function renderStats(stats) {
  $("#stat-pendentes .stat-num").textContent = stats.pendentes;
  $("#stat-confirmados .stat-num").textContent = stats.confirmadosGerais;
  $("#stat-concluidos .stat-num").textContent = stats.concluidosGerais;
  $("#stat-cancelados .stat-num").textContent = stats.canceladosGerais;
  $("#stat-total .stat-num").textContent = stats.totalHoje;
  $("#stat-faturamento .stat-num").textContent = fmtMoeda(stats.faturamentoHoje);

  renderProximos(stats.proximos);
}

export function initDashboard() {
  // AQUI ESTÁ A CORREÇÃO:
  // Removido o 'onlyToday: true' dos cards de status gerais.
  // Adicionado 'label' para mostrar na chip flutuante da agenda.
  const cards = [
    { id: "stat-pendentes", filter: { status: "pendente", label: "Pendentes Gerais", view: "listWeek" } },
    { id: "stat-confirmados", filter: { status: "confirmado", label: "Confirmados Gerais", view: "listWeek" } },
    { id: "stat-concluidos", filter: { status: "concluido", label: "Concluídos Gerais", view: "listWeek" } },
    { id: "stat-cancelados", filter: { status: "cancelado", label: "Cancelados Gerais", view: "listWeek" } },
    
    // Estes continuam apenas para "Hoje"
    { id: "stat-total", filter: { onlyToday: true, label: "Agendamentos de Hoje", view: "timeGridDay" } },
    { id: "stat-faturamento", filter: { onlyToday: true, pago: true, label: "Pagos Hoje", view: "timeGridDay" } },
  ];
  
  cards.forEach(({ id, filter }) => {
    $(`#${id}`).addEventListener("click", () => {
      setFilter(filter);
      goToAgenda();
    });
  });

  onStats((stats) => renderStats(stats));
}
