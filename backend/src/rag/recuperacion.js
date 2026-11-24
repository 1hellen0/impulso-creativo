"use strict";

const {
  TABLE_NAME,
  conectarLanceDB,
  crearClienteGemini,
  crearLimitadorGemini,
  generarEmbedding,
  validarEsquemaVector,
} = require("./indexador");

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;
const CANDIDATE_MULTIPLIER = 3;

function normalizarPregunta(pregunta) {
  if (typeof pregunta !== "string" || !pregunta.trim()) {
    throw new Error("La pregunta no puede estar vacía.");
  }
  return pregunta.trim();
}

function normalizarLimite(limit) {
  if (limit === undefined) {
    return DEFAULT_LIMIT;
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`El límite debe ser un entero entre 1 y ${MAX_LIMIT}.`);
  }
  return limit;
}

function construirConsultaRecuperacion(pregunta) {
  // Gemini Embedding 2 usa una instrucción en el contenido para expresar la
  // tarea; no admite el campo taskType de los modelos Gemini anteriores.
  return `task: search result | query: ${pregunta}`;
}

function mapearResultado(row) {
  const distance = Number.isFinite(row._distance) ? row._distance : null;
  return {
    texto: row.texto,
    nombre_archivo: row.nombre,
    seccion: row.seccion,
    ruta: row.ruta,
    drive_file_id: row.drive_file_id,
    puntuacion_similitud: distance === null ? null : 1 / (1 + distance),
    distancia: distance,
    enlace_drive: row.enlace_drive || `https://drive.google.com/open?id=${row.drive_file_id}`,
  };
}

function nombreBase(nombre) {
  const lastDot = nombre.lastIndexOf(".");
  const base = lastDot > 0 ? nombre.slice(0, lastDot) : nombre;
  return base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function deduplicarPorNombreBase(rows, limit) {
  const bestResults = new Map();

  for (const row of rows) {
    const result = mapearResultado(row);
    const key = nombreBase(result.nombre_archivo);
    const current = bestResults.get(key);
    if (!current || result.puntuacion_similitud > current.puntuacion_similitud) {
      bestResults.set(key, result);
    }
  }

  return [...bestResults.values()]
    .sort((first, second) => second.puntuacion_similitud - first.puntuacion_similitud)
    .slice(0, limit);
}

async function buscarFragmentos(pregunta, options = {}) {
  const question = normalizarPregunta(pregunta);
  const limit = normalizarLimite(options.limit);
  const db = await conectarLanceDB();

  if (!(await db.tableNames()).includes(TABLE_NAME)) {
    throw new Error(`No existe la tabla local ${TABLE_NAME}. Ejecuta primero la indexación.`);
  }

  const table = await db.openTable(TABLE_NAME);
  await validarEsquemaVector(table);

  if (await table.countRows() === 0) {
    throw new Error(`La tabla ${TABLE_NAME} está vacía. Ejecuta primero la indexación.`);
  }

  const gemini = crearClienteGemini();
  const limiter = crearLimitadorGemini();
  const vector = await generarEmbedding(
    gemini,
    limiter,
    construirConsultaRecuperacion(question),
  );

  try {
    const candidateLimit = Math.min(limit * CANDIDATE_MULTIPLIER, MAX_LIMIT * CANDIDATE_MULTIPLIER);
    const rows = await table.vectorSearch(vector).limit(candidateLimit).toArray();
    return deduplicarPorNombreBase(rows, limit);
  } catch (error) {
    throw new Error(`La búsqueda en LanceDB falló: ${error.message}`);
  }
}

module.exports = { buscarFragmentos };
