"use strict";

const {
  obtenerResumenPersonal,
  preguntaMencionaOtraPersona,
  responderConDatos,
} = require("../services/datosPersonales");
const { registrarConsulta } = require("../services/registroConsultas");

const MAX_PREGUNTA_LENGTH = 1_000;

async function registrarSinBloquear(usuario, pregunta, resuelta, escalada, inicio) {
  try {
    await registrarConsulta({
      idColaborador: usuario.id_colaborador,
      pregunta,
      intencion: "dato_personal",
      agente: "datos-personales-mysql",
      resuelta,
      escalada,
      latenciaMs: Date.now() - inicio,
    });
  } catch (error) {
    console.error("No fue posible registrar la consulta de datos personales.");
  }
}

async function responderDatosPersonales(req, res) {
  const inicio = Date.now();
  const pregunta = typeof req.body?.pregunta === "string" ? req.body.pregunta.trim() : "";
  if (!pregunta) return res.status(400).json({ error: "El campo pregunta es obligatorio y no puede estar vacío." });
  if (pregunta.length > MAX_PREGUNTA_LENGTH) {
    return res.status(400).json({ error: `La pregunta no puede superar ${MAX_PREGUNTA_LENGTH} caracteres.` });
  }

  if (req.usuario.rol !== "rrhh" && preguntaMencionaOtraPersona(pregunta)) {
    await registrarSinBloquear(req.usuario, pregunta, false, true, inicio);
    return res.status(403).json({
      error: "Solo puedes consultar tus propios datos personales. Para información de otra persona, contacta a Recursos Humanos.",
    });
  }

  try {
    const resumen = await obtenerResumenPersonal(req.usuario.id_colaborador);
    if (!resumen) throw new Error("No se encontró la cuenta autenticada.");
    const respuesta = responderConDatos(pregunta, resumen);
    await registrarSinBloquear(req.usuario, pregunta, true, false, inicio);
    return res.status(200).json({ respuesta, citas: [], agente: "datos-personales-mysql" });
  } catch (error) {
    await registrarSinBloquear(req.usuario, pregunta, false, true, inicio);
    return res.status(503).json({ error: "No fue posible consultar tus datos personales en este momento. Intenta de nuevo más tarde." });
  }
}

module.exports = { responderDatosPersonales };
