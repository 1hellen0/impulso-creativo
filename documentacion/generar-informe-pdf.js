"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const { PDFParse } = require("../backend/node_modules/pdf-parse");

const sourcePath = path.join(__dirname, "informe-tecnico.md");
const outputPath = path.join(__dirname, "informe-tecnico.pdf");
const pageWidth = 595;
const pageHeight = 842;

function normalizarTexto(texto) {
  return texto
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2026/g, "...");
}

function escaparPdf(texto) {
  const caracteres = {
    "\u20AC": "\u0080", "\u201A": "\u0082", "\u0192": "\u0083", "\u201E": "\u0084",
    "\u2026": "\u0085", "\u2020": "\u0086", "\u2021": "\u0087", "\u02C6": "\u0088",
    "\u2030": "\u0089", "\u0160": "\u008A", "\u2039": "\u008B", "\u0152": "\u008C",
    "\u017D": "\u008E", "\u2018": "\u0091", "\u2019": "\u0092", "\u201C": "\u0093",
    "\u201D": "\u0094", "\u2022": "\u0095", "\u2013": "\u0096", "\u2014": "\u0097",
    "\u02DC": "\u0098", "\u2122": "\u0099", "\u0161": "\u009A", "\u203A": "\u009B",
    "\u0153": "\u009C", "\u017E": "\u009E", "\u0178": "\u009F",
  };
  return Buffer.from(texto.replace(/[\u0080-\uFFFF]/g, (caracter) => caracteres[caracter] || "?"), "latin1")
    .toString("latin1")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function dividir(texto, limite) {
  const palabras = normalizarTexto(texto).trim().split(/\s+/).filter(Boolean);
  const lineas = [];
  let linea = "";
  for (const palabra of palabras) {
    if (linea && `${linea} ${palabra}`.length > limite) {
      lineas.push(linea);
      linea = palabra;
    } else {
      linea = linea ? `${linea} ${palabra}` : palabra;
    }
  }
  if (linea) lineas.push(linea);
  return lineas;
}

function obtenerBloques(markdown) {
  const bloques = [];
  const lineas = markdown.split(/\r?\n/);
  let parrafo = [];
  let codigo = false;
  const cerrarParrafo = () => {
    if (parrafo.length) bloques.push({ tipo: "parrafo", texto: parrafo.join(" ") });
    parrafo = [];
  };
  for (const linea of lineas) {
    if (linea.startsWith("```")) {
      cerrarParrafo();
      codigo = !codigo;
      continue;
    }
    if (codigo) {
      bloques.push({ tipo: "codigo", texto: linea });
      continue;
    }
    const encabezado = linea.match(/^(#{1,3})\s+(.+)$/);
    if (encabezado) {
      cerrarParrafo();
      bloques.push({ tipo: `h${encabezado[1].length}`, texto: encabezado[2] });
      continue;
    }
    const lista = linea.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    if (lista) {
      cerrarParrafo();
      bloques.push({ tipo: "lista", texto: `• ${lista[1]}` });
      continue;
    }
    if (!linea.trim() || /^-{3,}$/.test(linea.trim())) {
      cerrarParrafo();
      continue;
    }
    parrafo.push(linea.trim());
  }
  cerrarParrafo();
  return bloques;
}

function crearLineas(bloques, limite) {
  const estilos = {
    h1: { fuente: "F2", tamano: 22, avance: 28, color: "0.09 0.13 0.21", limite: 42, antes: 1, despues: 1 },
    h2: { fuente: "F2", tamano: 15, avance: 20, color: "0.30 0.23 0.72", limite: 57, antes: 1.2, despues: 0.5 },
    h3: { fuente: "F2", tamano: 11.5, avance: 16, color: "0.30 0.23 0.72", limite: 67, antes: 0.8, despues: 0.2 },
    parrafo: { fuente: "F1", tamano: 10.8, avance: 15, color: "0.11 0.15 0.22", limite, antes: 0, despues: 0.55 },
    lista: { fuente: "F1", tamano: 10.6, avance: 15, color: "0.11 0.15 0.22", limite: limite - 4, antes: 0, despues: 0.15 },
    codigo: { fuente: "F3", tamano: 8.6, avance: 12, color: "0.16 0.20 0.29", limite: limite - 5, antes: 0, despues: 0.1 },
  };
  const lineas = [];
  for (const bloque of bloques) {
    const estilo = estilos[bloque.tipo];
    for (let i = 0; i < Math.ceil(estilo.antes); i += 1) lineas.push({ espacio: estilo.avance * (i === 0 ? estilo.antes : 1) });
    for (const texto of dividir(bloque.texto, estilo.limite)) lineas.push({ ...estilo, texto });
    for (let i = 0; i < Math.ceil(estilo.despues); i += 1) lineas.push({ espacio: estilo.avance * (i === 0 ? estilo.despues : 1) });
  }
  return lineas;
}

function paginar(lineas) {
  const paginas = [[]];
  let y = 766;
  for (const linea of lineas) {
    const avance = linea.espacio || linea.avance;
    if (y - avance < 66 && paginas.at(-1).length) {
      paginas.push([]);
      y = 766;
    }
    paginas.at(-1).push({ ...linea, y });
    y -= avance;
  }
  return paginas;
}

function contenidoPagina(lineas, numero, total) {
  const partes = [
    "q 0.36 0.27 0.91 rg 48 798 499 3 re f Q",
    "BT /F1 8 Tf 0.35 0.39 0.48 rg 48 814 Td (IMPULSO CREATIVO | INFORME TECNICO) Tj ET",
  ];
  for (const linea of lineas) {
    if (linea.espacio) continue;
    partes.push(`BT /${linea.fuente} ${linea.tamano} Tf ${linea.color} rg 48 ${linea.y.toFixed(1)} Td (${escaparPdf(linea.texto)}) Tj ET`);
  }
  partes.push(`BT /F1 8 Tf 0.35 0.39 0.48 rg 48 35 Td (Documento tecnico | ${numero} de ${total}) Tj ET`);
  return partes.join("\n");
}

function construirPdf(paginas) {
  const objetos = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"];
  const referenciasPagina = [];
  for (let indice = 0; indice < paginas.length; indice += 1) {
    const pagina = 6 + indice * 2;
    const contenido = pagina + 1;
    referenciasPagina.push(`${pagina} 0 R`);
    const flujo = contenidoPagina(paginas[indice], indice + 1, paginas.length);
    objetos[pagina - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contenido} 0 R >>`;
    objetos[contenido - 1] = `<< /Length ${Buffer.byteLength(flujo, "latin1")} >>\nstream\n${flujo}\nendstream`;
  }
  objetos[1] = `<< /Type /Pages /Kids [${referenciasPagina.join(" ")}] /Count ${paginas.length} >>`;
  let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const posiciones = [0];
  objetos.forEach((objeto, indice) => {
    posiciones[indice + 1] = Buffer.byteLength(pdf, "latin1");
    pdf += `${indice + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const inicioXref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (let indice = 1; indice <= objetos.length; indice += 1) pdf += `${String(posiciones[indice]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

async function contarPaginas(ruta) {
  const parser = new PDFParse({ data: await fs.readFile(ruta) });
  try {
    return (await parser.getInfo()).total;
  } finally {
    await parser.destroy();
  }
}

async function main() {
  const markdown = await fs.readFile(sourcePath, "utf8");
  const bloques = obtenerBloques(markdown);
  let paginas = [];
  for (let limite = 78; limite >= 48; limite -= 2) {
    const candidatas = paginar(crearLineas(bloques, limite));
    if (candidatas.length >= 8 && candidatas.length <= 12) {
      paginas = candidatas;
      break;
    }
  }
  if (!paginas.length) throw new Error("No se pudo ajustar la maquetacion al rango de 8 a 12 paginas sin alterar el contenido.");
  await fs.writeFile(outputPath, construirPdf(paginas));
  const total = await contarPaginas(outputPath);
  if (total < 8 || total > 12) throw new Error(`El PDF tiene ${total} paginas; se requieren entre 8 y 12.`);
  console.log(`PDF generado y verificado: ${total} paginas.`);
}

main().catch((error) => {
  console.error("No se pudo generar el informe PDF.");
  console.error(error.message);
  process.exitCode = 1;
});
