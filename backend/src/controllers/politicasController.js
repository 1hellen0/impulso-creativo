"use strict";

const { buscarFragmentos } = require("../rag/recuperacion");
const { generarRespuestaPoliticas } = require("../services/deepseek");
const { registrarConsultaPoliticas } = require("../services/registroConsultas");

const MAX_PREGUNTA_LENGTH = 1_000;
const MAX_RAG_RESULTS = 3;
const DEFAULT_MIN_SIMILARITY = 0.55;

function obtenerMinSimilarity() {
  const value = Number(process.env.RAG_MIN_SIMILARITY ?? DEFAULT_MIN_SIMILARITY);
  return Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : DEFAULT_MIN_SIMILARITY;
}

function construirCitas(fragmentos) {
  return fragmentos.map((fragmento) => ({
    documento: fragmento.nombre_archivo,
    seccion: fragmento.seccion,
    enlace: fragmento.enlace_drive,
  }));
}

async function registrarSinBloquear(usuario, pregunta, citas, resuelta, escalada, inicio) {
  try {
    await registrarConsultaPoliticas({
      idColaborador: usuario.id_colaborador,
      pregunta,
      citas,
      resuelta,
      escalada,
      latenciaMs: Date.now() - inicio,
    });
  } catch (error) {
    console.error("No fue posible registrar la consulta del chat.");
  }
}

async function responderPoliticas(req, res) {
  const inicio = Date.now();
  const pregunta = req.body?.pregunta;

  if (typeof pregunta !== "string" || !pregunta.trim()) {
    return res.status(400).json({
      error: "El campo pregunta es obligatorio y no puede estar vacío.",
    });
  }

  const preguntaNormalizada = pregunta.trim();
  if (preguntaNormalizada.length > MAX_PREGUNTA_LENGTH) {
    return res.status(400).json({
      error: `La pregunta no puede superar ${MAX_PREGUNTA_LENGTH} caracteres.`,
    });
  }

  let fragmentos;
  try {
    fragmentos = await buscarFragmentos(preguntaNormalizada, {
      limit: MAX_RAG_RESULTS,
    });
  } catch (error) {
    await registrarSinBloquear(req.usuario, preguntaNormalizada, [], false, true, inicio);
    return res.status(503).json({
      error: "No fue posible consultar las políticas en este momento. Intenta de nuevo más tarde.",
    });
  }

  const fragmentosConRespaldo = fragmentos.filter((fragmento) => (
    Number.isFinite(fragmento.puntuacion_similitud)
    && fragmento.puntuacion_similitud >= obtenerMinSimilarity()
  ));

  if (!fragmentosConRespaldo.length) {
    await registrarSinBloquear(req.usuario, preguntaNormalizada, [], false, true, inicio);
    return res.status(200).json({
      respuesta: "No encontré respaldo suficiente en las políticas disponibles. Consulta a Recursos Humanos para confirmar esta información.",
      citas: [],
    });
  }

  try {
    const respuesta = await generarRespuestaPoliticas(preguntaNormalizada, fragmentosConRespaldo);
    const citas = construirCitas(fragmentosConRespaldo);
    await registrarSinBloquear(req.usuario, preguntaNormalizada, citas, true, false, inicio);
    return res.status(200).json({
      respuesta,
      citas,
    });
  } catch (error) {
    await registrarSinBloquear(req.usuario, preguntaNormalizada, [], false, true, inicio);
    return res.status(502).json({
      error: "No fue posible generar una respuesta de políticas en este momento. Intenta de nuevo más tarde.",
    });
  }
}

module.exports = { responderPoliticas };
