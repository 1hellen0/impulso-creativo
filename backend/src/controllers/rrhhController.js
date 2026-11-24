"use strict";

const { Op } = require("sequelize");
const {
  Colaborador,
  EvaluacionDesempeno,
  MovimientoPersonal,
  ReporteDiario,
  SaldoVacaciones,
  Solicitud,
} = require("../../models");
const { obtenerResumenPersonal } = require("../services/datosPersonales");
const {
  fechaCostaRica,
  listarReportes,
  listarSolicitudesPendientes,
  obtenerDashboard,
} = require("../services/analistaReportes");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function idValido(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function fechaValida(value) {
  return typeof value === "string" && DATE_PATTERN.test(value) ? value : null;
}

async function listarColaboradoresRRHH(req, res) {
  const colaboradores = await Colaborador.findAll({
    attributes: ["id_colaborador", "nombre", "correo", "departamento", "puesto", "estado"],
    order: [["nombre", "ASC"]],
  });
  return res.status(200).json({
    colaboradores: colaboradores.map((colaborador) => colaborador.get({ plain: true })),
  });
}

async function obtenerDatosColaboradorRRHH(req, res) {
  const idColaborador = idValido(req.params.id_colaborador);
  if (!idColaborador) return res.status(400).json({ error: "Identificador de colaborador inválido." });

  const resumen = await obtenerResumenPersonal(idColaborador);
  if (!resumen) return res.status(404).json({ error: "No se encontró el colaborador solicitado." });
  return res.status(200).json(resumen);
}

async function reporteDiarioColaborador(req, res) {
  const idColaborador = idValido(req.query.colaborador_id);
  const fecha = fechaValida(req.query.fecha) || fechaCostaRica();
  if (!idColaborador) return res.status(400).json({ error: "colaborador_id debe ser un entero positivo." });
  if (req.query.fecha && !fechaValida(req.query.fecha)) {
    return res.status(400).json({ error: "fecha debe tener formato YYYY-MM-DD." });
  }

  const [colaborador, movimientos, solicitudes, evaluaciones, saldo, reporteGlobal] = await Promise.all([
    Colaborador.findByPk(idColaborador, {
      attributes: ["id_colaborador", "nombre", "departamento", "puesto", "estado"],
    }),
    MovimientoPersonal.findAll({
      where: { id_colaborador: idColaborador, fecha },
      attributes: ["tipo", "fecha", "motivo"],
      order: [["id_movimiento", "DESC"]],
    }),
    Solicitud.findAll({
      where: {
        id_colaborador: idColaborador,
        fecha_inicio: { [Op.lte]: fecha },
        fecha_fin: { [Op.gte]: fecha },
      },
      attributes: ["tipo", "fecha_inicio", "fecha_fin", "estado"],
      order: [["creada_en", "DESC"]],
    }),
    EvaluacionDesempeno.findAll({
      where: { id_colaborador: idColaborador, fecha_programada: fecha },
      attributes: ["fecha_programada", "estado"],
    }),
    SaldoVacaciones.findOne({
      where: { id_colaborador: idColaborador },
      attributes: ["periodo", "dias_asignados", "dias_tomados", "dias_disponibles"],
      order: [["periodo", "DESC"]],
    }),
    ReporteDiario.findOne({
      where: { fecha },
      attributes: ["fecha", "resumen_texto", "generado_por"],
    }),
  ]);

  if (!colaborador) return res.status(404).json({ error: "No se encontró el colaborador solicitado." });

  return res.status(200).json({
    fecha,
    colaborador: colaborador.get({ plain: true }),
    movimientos: movimientos.map((movimiento) => movimiento.get({ plain: true })),
    solicitudes: solicitudes.map((solicitud) => solicitud.get({ plain: true })),
    evaluaciones: evaluaciones.map((evaluacion) => evaluacion.get({ plain: true })),
    saldo_vacaciones: saldo ? saldo.get({ plain: true }) : null,
    reporte_global: reporteGlobal ? reporteGlobal.get({ plain: true }) : null,
  });
}

async function obtenerDashboardRRHH(req, res) {
  const fecha = fechaValida(req.query.fecha) || fechaCostaRica();
  if (req.query.fecha && !fechaValida(req.query.fecha)) {
    return res.status(400).json({ error: "fecha debe tener formato YYYY-MM-DD." });
  }

  try {
    const dashboard = await obtenerDashboard(fecha);
    if (!dashboard) {
      return res.status(404).json({ error: "Aún no existe un reporte global para la fecha solicitada." });
    }
    const solicitudesPendientes = await listarSolicitudesPendientes(fecha);
    return res.status(200).json({ ...dashboard, solicitudes_pendientes: solicitudesPendientes });
  } catch (error) {
    return res.status(503).json({ error: "No fue posible cargar el dashboard de reportes." });
  }
}

async function listarReportesRRHH(req, res) {
  const limit = req.query.limit === undefined ? 30 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 90) {
    return res.status(400).json({ error: "limit debe ser un entero entre 1 y 90." });
  }

  try {
    return res.status(200).json({ reportes: await listarReportes(limit) });
  } catch (error) {
    return res.status(503).json({ error: "No fue posible cargar el historial de reportes." });
  }
}

module.exports = {
  listarColaboradoresRRHH,
  listarReportesRRHH,
  obtenerDatosColaboradorRRHH,
  obtenerDashboardRRHH,
  reporteDiarioColaborador,
};
