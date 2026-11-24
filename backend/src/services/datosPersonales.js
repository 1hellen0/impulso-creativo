"use strict";

const {
  Colaborador,
  EvaluacionDesempeno,
  SaldoVacaciones,
  Solicitud,
} = require("../../models");

const PERSONAL_PATTERNS = [
  /\b(mi|mis|m[ií]o|m[ií]a|tengo|me quedan|para m[ií])\b/i,
  /\b(cu[aá]ntos|cu[aá]ntas)\s+d[ií]as\s+(?:me|tengo|me quedan)/i,
  /\b(?:saldo|vacaciones|solicitudes?|evaluaci[oó]n|puesto|departamento)\b.*\b(?:tengo|mis|mi|me)\b/i,
];
const DATOS_PERSONALES_PATTERN = /\b(vacaciones|saldo|solicitudes?|evaluaci[oó]n|puesto|departamento|fecha de ingreso|estado)\b/i;
const TERCERA_PERSONA_PATTERN = /\b(otro|otra|alguien|compa(?:ñ|n)er[oa]|emplead[oa]|colaborador(?:a)?|persona|tiene|tienen|sus|su)\b/i;

function esPreguntaPersonal(pregunta) {
  return PERSONAL_PATTERNS.some((pattern) => pattern.test(pregunta))
    || (DATOS_PERSONALES_PATTERN.test(pregunta) && TERCERA_PERSONA_PATTERN.test(pregunta));
}

function preguntaMencionaOtraPersona(pregunta) {
  return /\b(otro|otra|alguien|compa(?:ñ|n)er[oa]|emplead[oa]|colaborador(?:a)?|persona)\b/i.test(pregunta)
    || /\b(tiene|tienen|sus|su)\s+(?:d[ií]as|vacaciones|saldo|datos|solicitudes?|evaluaci[oó]n)/i.test(pregunta)
    || /\b(?:vacaciones|saldo|datos|solicitudes?|evaluaci[oó]n)\b.*\b(tiene|tienen)\b/i.test(pregunta)
    || /\bde\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+/.test(pregunta);
}

function textoNumero(value) {
  return Number(value || 0).toLocaleString("es-CR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

async function obtenerResumenPersonal(idColaborador) {
  const [colaborador, saldoVacaciones, solicitudes, proximaEvaluacion] = await Promise.all([
    Colaborador.findByPk(idColaborador, {
      attributes: ["id_colaborador", "codigo", "nombre", "correo", "departamento", "puesto", "fecha_ingreso", "estado"],
    }),
    SaldoVacaciones.findOne({
      where: { id_colaborador: idColaborador },
      order: [["periodo", "DESC"]],
    }),
    Solicitud.findAll({
      where: { id_colaborador: idColaborador },
      attributes: ["tipo", "fecha_inicio", "fecha_fin", "estado", "creada_en"],
      order: [["creada_en", "DESC"]],
      limit: 5,
    }),
    EvaluacionDesempeno.findOne({
      where: { id_colaborador: idColaborador },
      attributes: ["fecha_programada", "estado"],
      order: [["fecha_programada", "ASC"]],
    }),
  ]);

  if (!colaborador) return null;

  return {
    colaborador: colaborador.get({ plain: true }),
    saldo_vacaciones: saldoVacaciones ? saldoVacaciones.get({ plain: true }) : null,
    solicitudes: solicitudes.map((solicitud) => solicitud.get({ plain: true })),
    proxima_evaluacion: proximaEvaluacion ? proximaEvaluacion.get({ plain: true }) : null,
  };
}

function responderConDatos(pregunta, resumen) {
  const normalizada = pregunta.toLowerCase();
  const saldo = resumen.saldo_vacaciones;

  if (/vacaciones|saldo|d[ií]as/.test(normalizada)) {
    if (!saldo) return "No encontré un saldo de vacaciones registrado para tu cuenta.";
    return `Para el periodo ${saldo.periodo}, tienes ${textoNumero(saldo.dias_disponibles)} días de vacaciones disponibles (${textoNumero(saldo.dias_asignados)} asignados y ${textoNumero(saldo.dias_tomados)} tomados).`;
  }

  if (/evaluaci[oó]n|desempeñ/.test(normalizada)) {
    if (!resumen.proxima_evaluacion) return "No encontré una evaluación de desempeño programada para tu cuenta.";
    return `Tu evaluación de desempeño está ${resumen.proxima_evaluacion.estado} y tiene fecha programada para ${resumen.proxima_evaluacion.fecha_programada}.`;
  }

  if (/solicitud|permiso|licencia/.test(normalizada)) {
    if (!resumen.solicitudes.length) return "No encontré solicitudes registradas para tu cuenta.";
    const ultima = resumen.solicitudes[0];
    return `Tu solicitud más reciente es de ${ultima.tipo}, del ${ultima.fecha_inicio} al ${ultima.fecha_fin}, y está ${ultima.estado}.`;
  }

  const { colaborador } = resumen;
  return `Según tu registro, tu puesto es ${colaborador.puesto} en ${colaborador.departamento}; tu fecha de ingreso es ${colaborador.fecha_ingreso} y tu estado es ${colaborador.estado}.`;
}

module.exports = {
  esPreguntaPersonal,
  obtenerResumenPersonal,
  preguntaMencionaOtraPersona,
  responderConDatos,
};
