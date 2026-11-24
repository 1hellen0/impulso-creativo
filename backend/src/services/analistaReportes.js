"use strict";

const { QueryTypes, UniqueConstraintError } = require("sequelize");
const { ReporteDiario, sequelize } = require("../../models");
const { generarResumenReporte } = require("./deepseek");

const TIME_ZONE = "America/Costa_Rica";
const GENERADO_POR_SQL = "analista-reportes-sql-v1";
const GENERADO_POR_DEEPSEEK = "analista-reportes-deepseek-v1";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function fechaCostaRica(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function fechaValida(fecha) {
  return typeof fecha === "string" && DATE_PATTERN.test(fecha);
}

function numero(value) {
  return Number(value || 0);
}

function serializarReporte(reporte) {
  const value = reporte.get ? reporte.get({ plain: true }) : reporte;
  return {
    fecha: value.fecha,
    indicadores: value.datos_json?.indicadores || {},
    resumen_ejecutivo: value.resumen_texto || "",
    generado_por: value.generado_por,
  };
}

function crearResumen(fecha, indicadores) {
  const ausencias = indicadores.ausencias.total_activas;
  const pendientes = indicadores.solicitudes_pendientes.total;
  const antiguas = indicadores.solicitudes_pendientes.mas_de_tres_dias;
  const activas = indicadores.incapacidades.activas;
  const ingresos = indicadores.movimientos_mes.ingresos;
  const salidas = indicadores.movimientos_mes.salidas;
  const chat = indicadores.chat_dia_anterior;

  return [
    `Al ${fecha}, se registran ${ausencias} ausencias activas y ${activas} incapacidades activas, sin incluir diagnósticos ni datos médicos.`,
    `Hay ${pendientes} solicitudes pendientes; ${antiguas} superan los tres días de antigüedad.`,
    `En el mes se registran ${ingresos} ingresos y ${salidas} salidas, con una rotación estimada de ${indicadores.movimientos_mes.rotacion_porcentaje}% sobre la dotación activa actual.`,
    `El día anterior el chat registró ${chat.total_consultas} consultas, con ${chat.resolucion_sin_escalamiento_porcentaje}% resueltas sin escalar y una latencia promedio de ${chat.latencia_promedio_ms} ms.`,
  ].join(" ");
}

async function calcularIndicadores(fecha) {
  const replacements = { fecha };
  const [ausencias, solicitudes, incapacidades, movimientos, vacaciones, chat, temas, sinRespuesta] = await Promise.all([
    sequelize.query(
      `SELECT tipo, departamento, COUNT(*) AS total
       FROM (
         SELECT CONCAT('solicitud_', s.tipo) AS tipo, c.departamento
         FROM solicitudes s
         INNER JOIN colaboradores c ON c.id_colaborador = s.id_colaborador
         WHERE s.estado = 'aprobada' AND :fecha BETWEEN s.fecha_inicio AND s.fecha_fin
         UNION ALL
         SELECT CONCAT('incapacidad_', i.tipo) AS tipo, c.departamento
         FROM incapacidades i
         INNER JOIN colaboradores c ON c.id_colaborador = i.id_colaborador
         WHERE :fecha BETWEEN i.fecha_inicio AND DATE_ADD(i.fecha_inicio, INTERVAL (i.dias - 1) DAY)
       ) AS ausencias
       GROUP BY tipo, departamento
       ORDER BY total DESC, tipo ASC, departamento ASC`,
      { replacements, type: QueryTypes.SELECT },
    ),
    sequelize.query(
      `SELECT
         SUM(estado = 'pendiente') AS total_pendientes,
         SUM(estado = 'pendiente' AND DATEDIFF(:fecha, DATE(creada_en)) > 3) AS mas_de_tres_dias
       FROM solicitudes`,
      { replacements, type: QueryTypes.SELECT },
    ),
    sequelize.query(
      `SELECT
         SUM(:fecha BETWEEN fecha_inicio AND DATE_ADD(fecha_inicio, INTERVAL (dias - 1) DAY)) AS activas,
         SUM(GREATEST(0, DATEDIFF(
           LEAST(DATE_ADD(fecha_inicio, INTERVAL (dias - 1) DAY), LAST_DAY(:fecha)),
           GREATEST(fecha_inicio, DATE_FORMAT(:fecha, '%Y-%m-01'))
         ) + 1)) AS dias_acumulados_mes
       FROM incapacidades
       WHERE fecha_inicio <= LAST_DAY(:fecha)
         AND DATE_ADD(fecha_inicio, INTERVAL (dias - 1) DAY) >= DATE_FORMAT(:fecha, '%Y-%m-01')`,
      { replacements, type: QueryTypes.SELECT },
    ),
    sequelize.query(
      `SELECT
         SUM(tipo = 'ingreso') AS ingresos,
         SUM(tipo = 'salida') AS salidas,
         (SELECT COUNT(*) FROM colaboradores WHERE estado IN ('activo', 'licencia')) AS dotacion_actual
       FROM movimientos_personal
       WHERE fecha BETWEEN DATE_FORMAT(:fecha, '%Y-%m-01') AND LAST_DAY(:fecha)`,
      { replacements, type: QueryTypes.SELECT },
    ),
    sequelize.query(
      `SELECT departamento, COUNT(*) AS total
       FROM saldos_vacaciones s
       INNER JOIN colaboradores c ON c.id_colaborador = s.id_colaborador
       WHERE s.periodo = YEAR(:fecha) AND s.dias_disponibles > 20
       GROUP BY departamento
       ORDER BY total DESC, departamento ASC`,
      { replacements, type: QueryTypes.SELECT },
    ),
    sequelize.query(
      `SELECT
         COUNT(*) AS total_consultas,
         SUM(resuelta = TRUE AND escalada = FALSE) AS resueltas_sin_escalar,
         AVG(latencia_ms) AS latencia_promedio_ms
       FROM consultas_chat
       WHERE DATE(fecha) = DATE_SUB(:fecha, INTERVAL 1 DAY)`,
      { replacements, type: QueryTypes.SELECT },
    ),
    sequelize.query(
      `SELECT intencion AS tema, COUNT(*) AS total
       FROM consultas_chat
       WHERE DATE(fecha) = DATE_SUB(:fecha, INTERVAL 1 DAY)
       GROUP BY intencion
       ORDER BY total DESC, tema ASC
       LIMIT 5`,
      { replacements, type: QueryTypes.SELECT },
    ),
    sequelize.query(
      `SELECT intencion AS tema, COUNT(*) AS total
       FROM consultas_chat
       WHERE DATE(fecha) = DATE_SUB(:fecha, INTERVAL 1 DAY) AND resuelta = FALSE
       GROUP BY intencion
       ORDER BY total DESC, tema ASC`,
      { replacements, type: QueryTypes.SELECT },
    ),
  ]);

  const solicitud = solicitudes[0] || {};
  const incapacidad = incapacidades[0] || {};
  const movimiento = movimientos[0] || {};
  const usoChat = chat[0] || {};
  const dotacion = numero(movimiento.dotacion_actual);
  const salidas = numero(movimiento.salidas);
  const totalConsultas = numero(usoChat.total_consultas);
  const resueltas = numero(usoChat.resueltas_sin_escalar);

  return {
    ausencias: {
      total_activas: ausencias.reduce((total, item) => total + numero(item.total), 0),
      por_tipo_y_departamento: ausencias.map((item) => ({ ...item, total: numero(item.total) })),
    },
    solicitudes_pendientes: {
      total: numero(solicitud.total_pendientes),
      mas_de_tres_dias: numero(solicitud.mas_de_tres_dias),
    },
    incapacidades: {
      activas: numero(incapacidad.activas),
      dias_acumulados_mes: numero(incapacidad.dias_acumulados_mes),
    },
    movimientos_mes: {
      ingresos: numero(movimiento.ingresos),
      salidas,
      dotacion_actual: dotacion,
      rotacion_porcentaje: dotacion ? Number(((salidas / dotacion) * 100).toFixed(2)) : 0,
    },
    vacaciones_mayores_a_veinte_dias: {
      total: vacaciones.reduce((total, item) => total + numero(item.total), 0),
      por_departamento: vacaciones.map((item) => ({ ...item, total: numero(item.total) })),
    },
    chat_dia_anterior: {
      total_consultas: totalConsultas,
      resueltas_sin_escalar: resueltas,
      resolucion_sin_escalamiento_porcentaje: totalConsultas ? Number(((resueltas / totalConsultas) * 100).toFixed(2)) : 0,
      latencia_promedio_ms: Math.round(numero(usoChat.latencia_promedio_ms)),
    },
    top_cinco_temas: temas.map((item) => ({ tema: item.tema, total: numero(item.total) })),
    consultas_sin_respuesta: {
      total: sinRespuesta.reduce((total, item) => total + numero(item.total), 0),
      por_tema: sinRespuesta.map((item) => ({ tema: item.tema, total: numero(item.total) })),
    },
  };
}

async function generarReporteDiario(fecha = fechaCostaRica()) {
  if (!fechaValida(fecha)) throw new Error("La fecha del reporte debe tener formato YYYY-MM-DD.");
  const existente = await ReporteDiario.findOne({ where: { fecha } });
  if (existente) return { reporte: serializarReporte(existente), creado: false };

  const indicadores = await calcularIndicadores(fecha);
  const datosJson = { version: 1, fecha, indicadores };
  const respaldoLocal = crearResumen(fecha, indicadores);
  let resumenTexto = respaldoLocal;
  let generadoPor = GENERADO_POR_SQL;

  try {
    const resumenDeepSeek = await generarResumenReporte(indicadores);
    if (resumenDeepSeek) {
      resumenTexto = resumenDeepSeek;
      generadoPor = GENERADO_POR_DEEPSEEK;
    }
  } catch (error) {
    console.error("No fue posible generar el resumen ejecutivo con DeepSeek; se usó el respaldo local.");
  }

  try {
    const reporte = await ReporteDiario.create({
      fecha,
      datos_json: datosJson,
      resumen_texto: resumenTexto,
      generado_por: generadoPor,
    });
    return { reporte: serializarReporte(reporte), creado: true };
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
    const concurrente = await ReporteDiario.findOne({ where: { fecha } });
    if (!concurrente) throw error;
    return { reporte: serializarReporte(concurrente), creado: false };
  }
}

async function obtenerDashboard(fecha = fechaCostaRica()) {
  if (!fechaValida(fecha)) throw new Error("La fecha del reporte debe tener formato YYYY-MM-DD.");
  const reporte = await ReporteDiario.findOne({ where: { fecha } });
  if (!reporte) return null;

  const historial = await ReporteDiario.findAll({
    attributes: ["fecha", "datos_json", "resumen_texto", "generado_por"],
    order: [["fecha", "DESC"]],
    limit: 30,
  });
  return {
    reporte: serializarReporte(reporte),
    tendencia_30_dias: historial.reverse().map((item) => {
      const value = serializarReporte(item);
      return {
        fecha: value.fecha,
        consultas_chat: numero(value.indicadores.chat_dia_anterior?.total_consultas),
        solicitudes_pendientes: numero(value.indicadores.solicitudes_pendientes?.total),
      };
    }),
  };
}

async function listarReportes(limit = 30) {
  const reportes = await ReporteDiario.findAll({
    attributes: ["fecha", "datos_json", "resumen_texto", "generado_por"],
    order: [["fecha", "DESC"]],
    limit,
  });
  return reportes.map(serializarReporte);
}

async function listarSolicitudesPendientes(fecha) {
  return sequelize.query(
    `SELECT s.id_solicitud, s.tipo, s.fecha_inicio, s.fecha_fin, c.departamento,
       DATEDIFF(:fecha, DATE(s.creada_en)) AS dias_pendiente
     FROM solicitudes s
     INNER JOIN colaboradores c ON c.id_colaborador = s.id_colaborador
     WHERE s.estado = 'pendiente'
     ORDER BY dias_pendiente DESC, s.creada_en ASC
     LIMIT 20`,
    { replacements: { fecha }, type: QueryTypes.SELECT },
  ).then((rows) => rows.map((row) => ({ ...row, dias_pendiente: numero(row.dias_pendiente) })));
}

function proximaEjecucionCostaRica() {
  const ahora = new Date();
  const [year, month, day] = fechaCostaRica(ahora).split("-").map(Number);
  const proxima = new Date(Date.UTC(year, month - 1, day, 13, 0, 0));
  if (proxima <= ahora) proxima.setUTCDate(proxima.getUTCDate() + 1);
  return proxima;
}

function iniciarProgramadorReportes() {
  generarReporteDiario().catch(() => console.error("No fue posible generar el reporte diario pendiente."));

  const programar = () => {
    const proxima = proximaEjecucionCostaRica();
    const delay = proxima.getTime() - Date.now();
    setTimeout(async () => {
      try {
        await generarReporteDiario();
      } catch (error) {
        console.error("No fue posible generar el reporte diario programado.");
      }
      programar();
    }, delay);
  };
  programar();
}

module.exports = {
  fechaCostaRica,
  generarReporteDiario,
  iniciarProgramadorReportes,
  listarSolicitudesPendientes,
  listarReportes,
  obtenerDashboard,
};
