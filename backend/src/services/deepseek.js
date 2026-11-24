"use strict";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";

async function solicitarDeepSeek(messages) {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY no está configurada.");
  }

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
      temperature: 0.2,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek respondió con estado ${response.status}.`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("DeepSeek no devolvió contenido de respuesta.");
  }
  return content.trim();
}

function construirContexto(fragmentos) {
  return fragmentos.map((fragmento, index) => [
    `[Fragmento ${index + 1}]`,
    `Documento: ${fragmento.nombre_archivo}`,
    `Sección: ${fragmento.seccion}`,
    `Contenido: ${fragmento.texto}`,
  ].join("\n")).join("\n\n");
}

async function generarRespuestaPoliticas(pregunta, fragmentos) {
  return solicitarDeepSeek([
    {
      role: "system",
      content: [
        "Eres el asistente interno de políticas de RR. HH. de Impulso Creativo.",
        "Responde únicamente con base en los fragmentos de políticas proporcionados.",
        "No inventes reglas, plazos, beneficios, enlaces, fuentes ni datos.",
        "Si los fragmentos no contienen la respuesta, indícalo claramente y recomienda consultar a Recursos Humanos.",
        "No afirmes haber consultado fuentes fuera del contexto recibido.",
      ].join(" "),
    },
    {
      role: "user",
      content: `Pregunta: ${pregunta}\n\nFragmentos de políticas:\n${construirContexto(fragmentos)}`,
    },
  ]);
}

function recolectarNumeros(value, numeros = []) {
  if (typeof value === "number" && Number.isFinite(value)) numeros.push(value);
  if (Array.isArray(value)) value.forEach((item) => recolectarNumeros(item, numeros));
  if (value && typeof value === "object") Object.values(value).forEach((item) => recolectarNumeros(item, numeros));
  return numeros;
}

function formatosPermitidos(indicadores) {
  const formatos = new Set();
  for (const numero of recolectarNumeros(indicadores)) {
    formatos.add(String(numero));
    formatos.add(numero.toLocaleString("es-CR", { maximumFractionDigits: 2 }));
    formatos.add(numero.toLocaleString("en-US", { maximumFractionDigits: 2 }));
  }
  return formatos;
}

function tieneEntreTresYCincoFrases(texto) {
  const frases = texto.match(/[^.!?]+[.!?]+/g) || [];
  const reconstruido = frases.join("").trim();
  return frases.length >= 3 && frases.length <= 5 && reconstruido === texto.trim();
}

function resumenEsValido(resumen, indicadores) {
  if (!tieneEntreTresYCincoFrases(resumen)) return false;
  const permitidos = formatosPermitidos(indicadores);
  const numeros = resumen.match(/\d[\d.,]*/g) || [];
  return numeros.every((numero) => permitidos.has(numero));
}

async function generarResumenReporte(indicadores) {
  const resumen = await solicitarDeepSeek([
    {
      role: "system",
      content: [
        "Redacta un resumen ejecutivo de RR. HH. estrictamente basado en el JSON de métricas agregadas recibido.",
        "Devuelve de 3 a 5 frases completas, sin viñetas ni título.",
        "No inventes cifras, porcentajes, fechas, causas, tendencias o recomendaciones.",
        "No menciones nombres, correos, preguntas textuales, datos personales, diagnósticos, entidades médicas ni observaciones médicas.",
        "Usa solo cifras que aparezcan literalmente en el JSON.",
      ].join(" "),
    },
    {
      role: "user",
      content: `Métricas agregadas autorizadas:\n${JSON.stringify(indicadores)}`,
    },
  ]);

  return resumenEsValido(resumen, indicadores) ? resumen : null;
}

module.exports = { generarRespuestaPoliticas, generarResumenReporte, resumenEsValido };
