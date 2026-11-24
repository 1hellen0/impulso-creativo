"use strict";

const express = require("express");
const { responderPoliticas } = require("../controllers/politicasController");
const { responderChat } = require("../controllers/chatController");
const {
  listarColaboradoresRRHH,
  listarReportesRRHH,
  obtenerDatosColaboradorRRHH,
  obtenerDashboardRRHH,
  reporteDiarioColaborador,
} = require("../controllers/rrhhController");
const {
  listarConsultasPropias,
  listarConsultasRRHH,
} = require("../controllers/consultasController");
const { autenticar, requerirRRHH } = require("../middlewares/autenticacion");

const router = express.Router();

router.post("/chat/politicas", autenticar, responderPoliticas);
router.post("/chat/consulta", autenticar, responderChat);
router.get("/chat/consultas/mias", autenticar, listarConsultasPropias);
router.get("/chat/consultas", autenticar, requerirRRHH, listarConsultasRRHH);
router.get("/rrhh/colaboradores", autenticar, requerirRRHH, listarColaboradoresRRHH);
router.get("/rrhh/colaboradores/:id_colaborador", autenticar, requerirRRHH, obtenerDatosColaboradorRRHH);
router.get("/rrhh/dashboard", autenticar, requerirRRHH, obtenerDashboardRRHH);
router.get("/rrhh/reportes-diarios/historial", autenticar, requerirRRHH, listarReportesRRHH);
router.get("/rrhh/reportes-diarios", autenticar, requerirRRHH, reporteDiarioColaborador);

module.exports = router;
