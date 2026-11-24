"use strict";

require("dotenv").config();

const path = require("node:path");
const readline = require("node:readline");
const XLSX = require("xlsx");

const WORKBOOK_PATH = path.resolve(
  __dirname,
  "../../documentos/evaluacion/banco-evaluacion-impulso-creativo.xlsx",
);
const MAX_CELL_LENGTH = 30_000;

function obtenerConfiguracion() {
  const baseUrl = (process.env.EVALUATION_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  const perfiles = {
    "Colaborador": {
      correo: process.env.EVALUATION_COLABORADOR_CORREO,
      password: process.env.EVALUATION_COLABORADOR_PASSWORD,
    },
    "RR. HH.": {
      correo: process.env.EVALUATION_RRHH_CORREO,
    },
  };

  if (!perfiles.Colaborador.correo || !perfiles.Colaborador.password || !perfiles["RR. HH."].correo) {
    throw new Error("Faltan las variables locales de correo o contraseña del colaborador de evaluación, o el correo de RR. HH. No se creó ninguna cuenta ni contraseña.");
  }
  return { baseUrl, perfiles };
}

function solicitarPasswordRRHH() {
  if (!process.stdin.isTTY) {
    throw new Error("La contraseña vigente de RR. HH. debe ingresarse en una terminal interactiva; no se lee ni almacena desde variables de entorno.");
  }

  return new Promise((resolve) => {
    const terminal = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const writeOriginal = terminal._writeToOutput.bind(terminal);
    process.stdout.write("Contraseña vigente de RR. HH. (no se mostrará ni guardará): ");
    terminal._writeToOutput = () => {};
    terminal.question("", (password) => {
      terminal._writeToOutput = writeOriginal;
      terminal.close();
      process.stdout.write("\n");
      resolve(password);
    });
  });
}

async function solicitar(baseUrl, endpoint, options = {}) {
  const response = await fetch(`${baseUrl}${endpoint}`, options);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, data };
}

async function iniciarSesion(baseUrl, credenciales, perfil) {
  const respuesta = await solicitar(baseUrl, "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credenciales),
  });
  if (!respuesta.ok || !respuesta.data?.token) {
    throw new Error(`No se pudo autenticar el perfil ${perfil}. Verifica que la cuenta simulada exista y que sus credenciales estén configuradas localmente.`);
  }
  return respuesta.data.token;
}

function resumirRespuesta({ status, data }) {
  const contenido = typeof data?.respuesta === "string"
    ? data.respuesta
    : JSON.stringify(data);
  const prefijo = `HTTP ${status}: `;
  const texto = `${prefijo}${contenido || "Sin contenido."}`;
  return texto.length > MAX_CELL_LENGTH ? `${texto.slice(0, MAX_CELL_LENGTH - 1)}…` : texto;
}

async function ejecutarCaso(baseUrl, token, agente, pregunta) {
  const inicio = performance.now();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const respuesta = agente === "dashboard-rrhh-sql"
    ? await solicitar(baseUrl, "/api/rrhh/dashboard", { headers })
    : await solicitar(baseUrl, "/api/chat/consulta", {
      method: "POST",
      headers,
      body: JSON.stringify({ pregunta }),
    });
  return {
    latencia: Math.round(performance.now() - inicio),
    respuesta: resumirRespuesta(respuesta),
  };
}

function establecerCelda(sheet, address, value, type = "s") {
  sheet[address] = { t: type, v: value };
}

async function main() {
  if (!require("node:fs").existsSync(WORKBOOK_PATH)) {
    throw new Error("No existe la hoja de evaluación. Ejecuta primero npm run evaluation:workbook.");
  }

  const { baseUrl, perfiles } = obtenerConfiguracion();
  const workbook = XLSX.readFile(WORKBOOK_PATH, { cellFormula: true });
  const sheet = workbook.Sheets.Preguntas;
  if (!sheet) throw new Error("La hoja Preguntas no existe en el archivo de evaluación.");

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const headers = rows[0] || [];
  const expectedHeaders = ["Pregunta", "Agente esperado", "Perfil de ejecución", "Respuesta obtenida", "Resultado", "Latencia (ms)"];
  const columns = Object.fromEntries(headers.map((header, index) => [header, index]));
  if (expectedHeaders.some((header) => columns[header] === undefined)) {
    throw new Error("La hoja no tiene el formato esperado. Regénérala con npm run evaluation:workbook.");
  }

  const tokens = {
    Colaborador: await iniciarSesion(baseUrl, perfiles.Colaborador, "Colaborador"),
  };
  let passwordRRHH = await solicitarPasswordRRHH();
  try {
    tokens["RR. HH."] = await iniciarSesion(baseUrl, {
      correo: perfiles["RR. HH."].correo,
      password: passwordRRHH,
    }, "RR. HH.");
  } finally {
    passwordRRHH = undefined;
  }

  let ejecutados = 0;
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index];
    const id = row[columns.ID];
    const pregunta = row[columns.Pregunta];
    const agente = row[columns["Agente esperado"]];
    const perfil = row[columns["Perfil de ejecución"]];
    if (!id || !pregunta || !tokens[perfil]) {
      throw new Error(`Caso inválido en la fila ${index + 1}. Revisa ID, pregunta y perfil de ejecución.`);
    }

    console.log(`Ejecutando ${id} con perfil ${perfil}.`);
    const resultado = await ejecutarCaso(baseUrl, tokens[perfil], agente, pregunta);
    const excelRow = index + 1;
    establecerCelda(sheet, XLSX.utils.encode_cell({ r: index, c: columns["Respuesta obtenida"] }), resultado.respuesta);
    establecerCelda(sheet, XLSX.utils.encode_cell({ r: index, c: columns["Latencia (ms)"] }), resultado.latencia, "n");
    // No se modifica Resultado: la revisión contra el criterio de aceptación es humana.
    ejecutados += 1;
  }

  XLSX.writeFile(workbook, WORKBOOK_PATH);
  console.log(`Evaluación ejecutada: ${ejecutados} casos actualizados. Los aciertos quedan pendientes de revisión humana.`);
}

main().catch((error) => {
  console.error("La evaluación no pudo ejecutarse.");
  console.error(error.message);
  process.exitCode = 1;
});
