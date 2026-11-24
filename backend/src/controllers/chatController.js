"use strict";

const { responderDatosPersonales } = require("./datosPersonalesController");
const { responderPoliticas } = require("./politicasController");
const { esPreguntaPersonal } = require("../services/datosPersonales");

function responderChat(req, res) {
  const pregunta = typeof req.body?.pregunta === "string" ? req.body.pregunta.trim() : "";
  if (esPreguntaPersonal(pregunta)) return responderDatosPersonales(req, res);
  return responderPoliticas(req, res);
}

module.exports = { responderChat };
