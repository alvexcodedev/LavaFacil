// =========================================================
// PAINEL ADMIN — dashboard inicial com cards de indicadores
// =========================================================
import { onStats, setFilter, openEditModal } from "./admin-calendar.js";
import { db } from "./firebase-config.js";
import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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
  const cards = [
    { id: "stat-pendentes", filter: { status: "pendente", label: "Pendentes Gerais", view: "listWeek" } },
    { id: "stat-confirmados", filter: { status: "confirmado", label: "Confirmados Gerais", view: "listWeek" } },
    { id: "stat-concluidos", filter: { status: "concluido", label: "Concluídos Gerais", view: "listWeek" } },
    { id: "stat-cancelados", filter: { status: "cancelado", label: "Cancelados Gerais", view: "listWeek" } },
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

  // ==========================================
  // LÓGICA DO BOTÃO DE EMERGÊNCIA (COM SENHA)
  // ==========================================
  const toggleBloqueio = $("#toggle-bloqueio-site");
  if (toggleBloqueio) {
    onSnapshot(doc(db, "configuracoes", "sistema"), (snap) => {
      if (snap.exists()) {
        toggleBloqueio.checked = snap.data().bloqueado === true;
      }
    });

    toggleBloqueio.addEventListener("change", async (e) => {
      const isBloqueado = e.target.checked;
      
      // Solicita a senha ao usuário
      const senhaDigitada = prompt("Ação restrita! Digite a senha administrativa para confirmar o bloqueio/desbloqueio:");
      
      // Validação da Senha
      // ATENÇÃO: Você pode alterar a senha "1234" para a senha que preferir.
      if (senhaDigitada !== "1234") {
        alert("Senha incorreta! Ação cancelada.");
        e.target.checked = !isBloqueado; // Devolve o botão para a posição original
        return;
      }

      // Se a senha estiver certa, pergunta se ele tem certeza
      const confirmMsg = isBloqueado 
        ? "Você digitou a senha correta.\nTem certeza que deseja BLOQUEAR o site para clientes?"
        : "Você digitou a senha correta.\nTem certeza que deseja LIBERAR o site para clientes?";
        
      if (confirm(confirmMsg)) {
        try {
          await setDoc(doc(db, "configuracoes", "sistema"), { 
            bloqueado: isBloqueado,
            mensagem: "Devido a problemas de força maior (como falta de água ou energia na região), estamos temporariamente impossibilitados de receber novos agendamentos online. Por favor, tente novamente mais tarde."
          }, { merge: true });
        } catch (err) {
          console.error("Erro ao alterar status do sistema", err);
          e.target.checked = !isBloqueado; 
        }
      } else {
        e.target.checked = !isBloqueado; 
      }
    });
  }
}
