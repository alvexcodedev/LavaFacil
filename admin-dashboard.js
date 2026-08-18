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
  $("#stat-confirmados .stat-num").textContent = stats.confirmadosHoje;
  $("#stat-concluidos .stat-num").textContent = stats.concluidosHoje;
  $("#stat-cancelados .stat-num").textContent = stats.canceladosMes;
  $("#stat-total .stat-num").textContent = stats.totalHoje;
  $("#stat-faturamento .stat-num").textContent = fmtMoeda(stats.faturamentoHoje);

  renderProximos(stats.proximos);
}

export function initDashboard() {
  const cards = [
    { id: "stat-pendentes", filter: { status: "pendente", label: "Pendentes", view: "listWeek" } },
    { id: "stat-confirmados", filter: { status: "confirmado", onlyToday: true, label: "Confirmados hoje", view: "timeGridDay" } },
    { id: "stat-concluidos", filter: { status: "concluido", onlyToday: true, label: "Concluídos hoje", view: "timeGridDay" } },
    { id: "stat-cancelados", filter: { status: "cancelado", label: "Cancelados neste mês", view: "dayGridMonth" } },
    { id: "stat-total", filter: { onlyToday: true, label: "Hoje", view: "timeGridDay" } },
    // CORREÇÃO: Adicionado pago: true para o card de faturamento funcionar corretamente no filtro
    { id: "stat-faturamento", filter: { onlyToday: true, pago: true, label: "Pagos hoje", view: "timeGridDay" } },
  ];
  
  cards.forEach(({ id, filter }) => {
    $(`#${id}`).addEventListener("click", () => {
      setFilter(filter);
      goToAgenda();
    });
  });

  onStats((stats) => renderStats(stats));
}
