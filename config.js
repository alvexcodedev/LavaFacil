// =========================================================
// CONFIGURAÇÕES DO NEGÓCIO
// Ajuste aqui os serviços, preços e horário de funcionamento.
// Não precisa mexer em mais nenhum arquivo para isso.
// =========================================================

export const SERVICOS = [
  { id: "simples",      nome: "Lavagem Simples",       duracaoMin: 40,  preco: 40  },
  { id: "completa",     nome: "Lavagem Completa",       duracaoMin: 70,  preco: 70  },
  { id: "higienizacao", nome: "Higienização Interna",   duracaoMin: 100, preco: 150 },
  { id: "enceramento",  nome: "Enceramento + Lavagem",  duracaoMin: 90,  preco: 120 },
];

// 0 = domingo ... 6 = sábado
export const HORARIO_FUNCIONAMENTO = {
  diasAtivos: [1, 2, 3, 4, 5, 6], // seg a sáb
  abre: "08:00",
  fecha: "18:00",
  intervaloSlotMin: 30,           // granularidade dos horários exibidos
  antecedenciaMinMin: 60,         // não permite agendar em menos de 1h de antecedência
};

export const NOME_NEGOCIO = "Lava Expresso";
export const TELEFONE_NEGOCIO = "(11) 99999-0000";
export const ENDERECO_NEGOCIO = "Av. das Águas, 123 — Tarumã, SP";
