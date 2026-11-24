"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const { GoogleGenAI } = require("@google/genai");
const lancedb = require("@lancedb/lancedb");
const {
  Field,
  FixedSizeList,
  Float32,
  Schema,
  Utf8,
} = require("apache-arrow");
const {
  crearClienteDrive,
  descargarArchivo,
  listarRecursivamente,
  GOOGLE_DOCUMENT_MIME_TYPE,
} = require("./drive");
const { extraerTexto } = require("./extractores");

const TABLE_NAME = "rag_chunks";
const CHUNK_SIZE = 1_200;
const CHUNK_OVERLAP = 180;
const EMBEDDING_DIMENSIONS = 768;
const MAX_TOKENS_PER_MINUTE = 3_000;
const MIN_REQUEST_INTERVAL_MS = 1_500;
const MAX_RATE_LIMIT_RETRIES = 4;

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizarTexto(texto) {
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function dividirTexto(texto, seccion) {
  const chunks = [];
  const normalized = normalizarTexto(texto);
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length);
    if (end < normalized.length) {
      const boundary = Math.max(
        normalized.lastIndexOf("\n", end),
        normalized.lastIndexOf(". ", end),
        normalized.lastIndexOf(" ", end),
      );
      if (boundary > start + Math.floor(CHUNK_SIZE / 2)) {
        end = boundary + 1;
      }
    }

    const content = normalized.slice(start, end).trim();
    if (content) {
      chunks.push({ seccion, texto: content });
    }
    start = end >= normalized.length
      ? normalized.length
      : Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

function dividirEnSecciones(texto, seccionInicial) {
  const sections = [];
  let section = seccionInicial;
  let lines = [];

  for (const line of normalizarTexto(texto).split("\n")) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const content = lines.join("\n").trim();
      if (content) {
        sections.push({ seccion: section, texto: content });
      }
      section = heading[1].trim();
      lines = [];
    } else {
      lines.push(line);
    }
  }

  const content = lines.join("\n").trim();
  if (content) {
    sections.push({ seccion: section, texto: content });
  }

  return sections;
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function estimarTokens(texto) {
  // Estimación deliberadamente conservadora para texto en español.
  return Math.max(1, Math.ceil(texto.length / 3));
}

function crearLimitadorGemini() {
  const requests = [];
  let lastRequestAt = 0;

  return {
    async esperarTurno(tokens) {
      const now = Date.now();
      const waitForInterval = Math.max(0, MIN_REQUEST_INTERVAL_MS - (now - lastRequestAt));
      if (waitForInterval > 0) {
        await sleep(waitForInterval);
      }

      while (true) {
        const current = Date.now();
        while (requests.length && current - requests[0].at >= 60_000) {
          requests.shift();
        }
        const usedTokens = requests.reduce((total, request) => total + request.tokens, 0);
        if (usedTokens + tokens <= MAX_TOKENS_PER_MINUTE) {
          return;
        }
        const milliseconds = Math.max(1_000, 60_000 - (current - requests[0].at) + 100);
        console.log(`Límite local de ritmo: esperando ${Math.ceil(milliseconds / 1000)} s.`);
        await sleep(milliseconds);
      }
    },

    registrarSolicitud(tokens) {
      lastRequestAt = Date.now();
      requests.push({ at: lastRequestAt, tokens });
    },
  };
}

function crearClienteGemini() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "Falta GEMINI_API_KEY. Añádela solo a tu archivo .env local antes de ejecutar la indexación.",
    );
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

function esErrorTransitorio(error) {
  return error?.status === 429
    || error?.code === 429
    || error?.status === 503
    || error?.code === 503
    || /\b429\b|\b503\b|RESOURCE_EXHAUSTED|UNAVAILABLE|rate limit|temporarily unavailable|service unavailable/i.test(error?.message || "");
}

function obtenerEsperaReintento(error, attempt) {
  const header = error?.response?.headers?.get?.("retry-after")
    || error?.response?.headers?.["retry-after"];
  const secondsFromHeader = Number(header);
  if (Number.isFinite(secondsFromHeader) && secondsFromHeader > 0) {
    return Math.ceil(secondsFromHeader * 1_000);
  }

  const message = error?.message || "";
  const match = message.match(/(?:retry in|retryDelay["':\s]+)([\d.]+)s/i);
  if (match) {
    return Math.ceil(Number(match[1]) * 1_000);
  }

  return Math.min(60_000, 5_000 * (2 ** attempt));
}

function validarRespuestaEmbedding(response) {
  const properties = response && typeof response === "object" ? Object.keys(response) : [];
  if (!Array.isArray(response?.embeddings) || response.embeddings.length !== 1) {
    throw new Error(
      `Respuesta de Gemini inválida: se esperaba response.embeddings con 1 elemento; propiedades recibidas: ${properties.join(", ") || "ninguna"}.`,
    );
  }

  const values = response.embeddings[0]?.values;
  if (!Array.isArray(values) && !ArrayBuffer.isView(values)) {
    throw new Error("Respuesta de Gemini inválida: response.embeddings[0].values no es un vector.");
  }

  const vector = Array.from(values, Number);
  if (vector.length !== EMBEDDING_DIMENSIONS || vector.some((value) => !Number.isFinite(value))) {
    throw new Error(
      `Respuesta de Gemini inválida: se esperaban ${EMBEDDING_DIMENSIONS} valores numéricos y se recibieron ${vector.length}.`,
    );
  }
  return vector;
}

async function generarEmbedding(client, limiter, texto) {
  const model = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2";
  const tokenEstimate = estimarTokens(texto);

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    await limiter.esperarTurno(tokenEstimate);
    limiter.registrarSolicitud(tokenEstimate);
    try {
      const response = await client.models.embedContent({
        model,
        contents: texto,
        config: { outputDimensionality: EMBEDDING_DIMENSIONS },
      });
      return validarRespuestaEmbedding(response);
    } catch (error) {
      if (!esErrorTransitorio(error) || attempt === MAX_RATE_LIMIT_RETRIES) {
        throw error;
      }
      const delay = obtenerEsperaReintento(error, attempt);
      const status = error?.status || error?.code || "transitorio";
      console.log(`Gemini respondió ${status}. Reintentando en ${Math.ceil(delay / 1000)} s (${attempt + 1}/${MAX_RATE_LIMIT_RETRIES}).`);
      await sleep(delay);
    }
  }

  throw new Error("No fue posible generar el embedding.");
}

function crearSchemaChunks() {
  return new Schema([
    new Field("id", new Utf8(), false),
    new Field("drive_file_id", new Utf8(), false),
    new Field("nombre", new Utf8(), false),
    new Field("ruta", new Utf8(), false),
    new Field("mime_type", new Utf8(), false),
    new Field("seccion", new Utf8(), false),
    new Field("fecha_modificacion", new Utf8(), true),
    new Field("hash", new Utf8(), false),
    new Field("source_hash", new Utf8(), false),
    new Field("texto", new Utf8(), false),
    new Field(
      "vector",
      new FixedSizeList(
        EMBEDDING_DIMENSIONS,
        new Field("item", new Float32(), false),
      ),
      false,
    ),
  ]);
}

function convertirEnTablaArrow(rows) {
  const schema = crearSchemaChunks();
  return lancedb.makeArrowTable(rows, { schema });
}

async function validarEsquemaVector(table) {
  const schema = await table.schema();
  const vectorField = schema.fields.find((field) => field.name === "vector");
  if (!vectorField || vectorField.type?.listSize !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `La tabla ${TABLE_NAME} no usa un vector fijo de ${EMBEDDING_DIMENSIONS} dimensiones. Crea una base LanceDB nueva antes de continuar.`,
    );
  }
}

async function conectarLanceDB() {
  const dbPath = path.resolve(process.cwd(), process.env.LANCEDB_PATH || "data/lancedb");
  return lancedb.connect(dbPath);
}

function normalizarOpciones(options) {
  return {
    fileId: options.fileId || null,
    fileName: options.fileName || null,
    limitFiles: Number.isInteger(options.limitFiles) && options.limitFiles > 0
      ? options.limitFiles
      : Number.POSITIVE_INFINITY,
    limitChunks: Number.isInteger(options.limitChunks) && options.limitChunks > 0
      ? options.limitChunks
      : Number.POSITIVE_INFINITY,
  };
}

async function indexarArchivosDrive(files, options = {}) {
  const config = normalizarOpciones(options);
  const gemini = crearClienteGemini();
  const limiter = crearLimitadorGemini();
  const db = await conectarLanceDB();
  let selectedFiles = files;
  if (config.fileId) {
    selectedFiles = selectedFiles.filter((file) => file.id === config.fileId);
  }
  if (config.fileName) {
    selectedFiles = selectedFiles.filter((file) => file.name === config.fileName);
  }
  selectedFiles = selectedFiles.slice(0, config.limitFiles);

  if (!selectedFiles.length) {
    throw new Error("No se encontraron archivos de Drive que coincidan con la prueba solicitada.");
  }

  const batches = [];
  let remainingChunks = config.limitChunks;

  // El bucle es secuencial: concurrencia 1 para descargas y embeddings.
  for (const file of selectedFiles) {
    if (remainingChunks <= 0) {
      break;
    }
    try {
      const buffer = await descargarArchivo(drive, file);
      const sections = await extraerTexto(file, buffer, GOOGLE_DOCUMENT_MIME_TYPE);
      if (!sections) {
        console.log(`Omitido (formato no compatible): ${file.path}`);
        continue;
      }

      const sourceHash = sha256(Buffer.concat([buffer, Buffer.from(file.modifiedTime || "")]));
      const chunks = sections
        .flatMap(({ seccion, texto }) => dividirEnSecciones(texto, seccion))
        .flatMap(({ seccion, texto }) => dividirTexto(texto, seccion))
        .slice(0, remainingChunks);
      if (!chunks.length) {
        console.log(`Omitido (sin texto extraíble): ${file.path}`);
        continue;
      }

      const rows = [];
      for (const chunk of chunks) {
        const vector = await generarEmbedding(gemini, limiter, chunk.texto);
        const hash = sha256(`${file.id}:${sourceHash}:${chunk.seccion}:${chunk.texto}`);
        rows.push({
          id: hash,
          drive_file_id: file.id,
          nombre: file.name,
          ruta: file.path,
          mime_type: file.mimeType,
          seccion: chunk.seccion,
          fecha_modificacion: file.modifiedTime || null,
          hash,
          source_hash: sourceHash,
          texto: chunk.texto,
          vector,
        });
      }

      // Construir la tabla Arrow valida el schema antes de eliminar chunks previos.
      batches.push({ file, rows, arrowTable: convertirEnTablaArrow(rows) });
      remainingChunks -= rows.length;
    } catch (error) {
      console.error(`No se pudo procesar ${file.path}: ${error.message}`);
    }
  }

  if (!batches.length) {
    throw new Error("No se indexó ningún archivo: no se modificó LanceDB.");
  }

  const tableExists = (await db.tableNames()).includes(TABLE_NAME);
  let table = tableExists ? await db.openTable(TABLE_NAME) : null;
  if (table) {
    await validarEsquemaVector(table);
  }

  let chunkCount = 0;
  const archivosIndexados = [];
  for (const batch of batches) {
    if (!table) {
      table = await db.createTable(TABLE_NAME, batch.arrowTable);
      await validarEsquemaVector(table);
    } else {
      // Los embeddings y el schema ya se validaron antes de reemplazar el archivo.
      await table.delete(`drive_file_id = '${escapeSqlString(batch.file.id)}'`);
      await table.add(batch.arrowTable);
    }
    chunkCount += batch.rows.length;
    archivosIndexados.push(batch.file.id);
    console.log(`Indexado: ${batch.file.path} (${batch.rows.length} fragmentos)`);
  }

  return { archivos: batches.length, archivosIndexados, fragmentos: chunkCount };
}

async function indexarDrive(options = {}) {
  const { drive, folderId } = crearClienteDrive();
  const files = await listarRecursivamente(drive, folderId);
  return indexarArchivosDrive(files, options);
}

async function obtenerArchivosIndexados() {
  const db = await conectarLanceDB();
  if (!(await db.tableNames()).includes(TABLE_NAME)) return new Map();

  const table = await db.openTable(TABLE_NAME);
  await validarEsquemaVector(table);
  const rows = await table.query()
    .select(["drive_file_id", "fecha_modificacion", "source_hash"])
    .toArray();
  const files = new Map();
  for (const row of rows) {
    if (!files.has(row.drive_file_id)) {
      files.set(row.drive_file_id, {
        fechaModificacion: row.fecha_modificacion || null,
        sourceHash: row.source_hash || null,
      });
    }
  }
  return files;
}

async function eliminarArchivosIndexados(fileIds) {
  if (!fileIds.length) return 0;
  const db = await conectarLanceDB();
  if (!(await db.tableNames()).includes(TABLE_NAME)) return 0;

  const table = await db.openTable(TABLE_NAME);
  await validarEsquemaVector(table);
  for (const fileId of fileIds) {
    await table.delete(`drive_file_id = '${escapeSqlString(fileId)}'`);
  }
  return fileIds.length;
}

module.exports = {
  TABLE_NAME,
  EMBEDDING_DIMENSIONS,
  conectarLanceDB,
  crearClienteGemini,
  crearLimitadorGemini,
  generarEmbedding,
  eliminarArchivosIndexados,
  indexarArchivosDrive,
  indexarDrive,
  obtenerArchivosIndexados,
  validarEsquemaVector,
};
