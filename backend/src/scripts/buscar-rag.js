"use strict";

require("dotenv").config();

const { buscarFragmentos } = require("../rag/recuperacion");

function leerArgumentos(argumentsList) {
  let limit;
  const questionParts = [];

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--limit") {
      const parsed = Number(argumentsList[index + 1]);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
        throw new Error("--limit debe ser un entero entre 1 y 20.");
      }
      limit = parsed;
      index += 1;
    } else {
      questionParts.push(argument);
    }
  }

  return { pregunta: questionParts.join(" "), limit };
}

async function main() {
  const { pregunta, limit } = leerArgumentos(process.argv.slice(2));
  const resultados = await buscarFragmentos(pregunta, { limit });
  console.log(JSON.stringify(resultados, null, 2));
}

main().catch((error) => {
  console.error("La recuperación RAG no pudo completarse.");
  console.error(error.message);
  process.exitCode = 1;
});
