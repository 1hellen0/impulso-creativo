"use strict";

const { Colaborador, ConsultaChat } = require("../../models");

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function obtenerPaginacion(query) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.page_size || DEFAULT_PAGE_SIZE);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new Error("Paginación inválida.");
  }
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function serializarConsulta(consulta, incluirColaborador) {
  const value = consulta.get({ plain: true });
  const response = {
    id_consulta: value.id_consulta,
    pregunta: value.pregunta,
    fecha: value.fecha,
    resultado: value.resuelta ? "resuelta" : "sin_respaldo_o_error",
    resuelta: value.resuelta,
    escalada: value.escalada,
    citas: value.documentos_citados || [],
    agente: value.agente,
    latencia_ms: value.latencia_ms,
  };

  if (incluirColaborador && value.colaborador) {
    response.colaborador = {
      nombre: value.colaborador.nombre,
      correo: value.colaborador.correo,
    };
  }
  return response;
}

async function listarConsultasPropias(req, res) {
  let pagination;
  try {
    pagination = obtenerPaginacion(req.query);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const { count, rows } = await ConsultaChat.findAndCountAll({
    where: { id_colaborador: req.usuario.id_colaborador },
    order: [["fecha", "DESC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  return res.status(200).json({
    pagina: pagination.page,
    por_pagina: pagination.pageSize,
    total: count,
    consultas: rows.map((consulta) => serializarConsulta(consulta, false)),
  });
}

async function listarConsultasRRHH(req, res) {
  let pagination;
  try {
    pagination = obtenerPaginacion(req.query);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const colaboradorId = req.query.colaborador_id === undefined
    ? null
    : Number(req.query.colaborador_id);
  if (req.query.colaborador_id !== undefined && (!Number.isInteger(colaboradorId) || colaboradorId < 1)) {
    return res.status(400).json({ error: "colaborador_id debe ser un entero positivo." });
  }

  const { count, rows } = await ConsultaChat.findAndCountAll({
    where: colaboradorId ? { id_colaborador: colaboradorId } : undefined,
    include: [{
      model: Colaborador,
      as: "colaborador",
      attributes: ["nombre", "correo"],
      required: false,
    }],
    order: [["fecha", "DESC"]],
    limit: pagination.pageSize,
    offset: pagination.offset,
  });

  return res.status(200).json({
    pagina: pagination.page,
    por_pagina: pagination.pageSize,
    total: count,
    consultas: rows.map((consulta) => serializarConsulta(consulta, true)),
  });
}

module.exports = { listarConsultasPropias, listarConsultasRRHH };
