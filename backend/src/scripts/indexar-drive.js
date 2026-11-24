"use strict";

require("dotenv").config();

const { indexarDrive } = require("../rag/indexador");

function leerEntero(argument, value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${argument} debe ser un entero positivo.`);
  }
  return parsed;
}

function leerOpciones(argumentsList) {
  const options = {};

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    const value = argumentsList[index + 1];

    if (argument === "--limit-files") {
      options.limitFiles = leerEntero(argument, value);
      index += 1;
    } else if (argument === "--limit-chunks") {
      options.limitChunks = leerEntero(argument, value);
      index += 1;
    } else if (argument === "--file-id") {
      if (!value) {
        throw new Error("--file-id requiere un ID de Google Drive.");
      }
      options.fileId = value;
      index += 1;
    } else if (argument === "--file-name") {
      if (!value) {
        throw new Error("--file-name requiere un nombre de archivo exacto.");
      }
      options.fileName = value;
      index += 1;
    } else if (argument === "--help") {
      console.log("Uso: npm run rag:index -- [--limit-files N] [--limit-chunks N] [--file-id ID] [--file-name NOMBRE]");
      process.exit(0);
    } else {
      throw new Error(`Argumento no reconocido: ${argument}`);
    }
  }

  return options;
}

async function main() {
  const options = leerOpciones(process.argv.slice(2));
  const { archivos, fragmentos } = await indexarDrive(options);
  console.log(`Indexación completada: ${archivos} archivos y ${fragmentos} fragmentos.`);
}

main().catch((error) => {
  console.error("La indexación de Google Drive no pudo completarse.");
  console.error(error.message);
  process.exitCode = 1;
});
