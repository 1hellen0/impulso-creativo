"use strict";

const { ConsultaChat } = require("../../models");

async function registrarConsulta({
  idColaborador,
  pregunta,
  intencion,
  agente,
  citas = [],
  resuelta,
  escalada,
  latenciaMs,
}) {
  return ConsultaChat.create({
    id_colaborador: idColaborador,
    pregunta,
    intencion,
    agente,
    documentos_citados: citas,
    resuelta,
    escalada,
    latencia_ms: latenciaMs,
    fecha: new Date(),
  });
}

async function registrarConsultaPoliticas({
  idColaborador,
  pregunta,
  citas = [],
  resuelta,
  escalada,
  latenciaMs,
}) {
  return registrarConsulta({
    idColaborador,
    pregunta,
    intencion: "politica",
    agente: "politicas-rag-deepseek",
    citas,
    resuelta,
    escalada,
    latencia_ms: latenciaMs,
  });
}

module.exports = { registrarConsulta, registrarConsultaPoliticas };
