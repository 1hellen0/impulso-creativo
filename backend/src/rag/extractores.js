"use strict";

const mammoth = require("mammoth");
const { PDFParse } = require("pdf-parse");
const XLSX = require("xlsx");

const MIME_TYPES = {
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  PDF: "application/pdf",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  MARKDOWN: "text/markdown",
  TEXT: "text/plain",
};

function extension(name) {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function isMimeOrExtension(file, mimeTypes, extensions) {
  return mimeTypes.includes(file.mimeType) || extensions.includes(extension(file.name));
}

async function extraerTexto(file, buffer, googleDocumentMimeType) {
  if (file.mimeType === googleDocumentMimeType) {
    return [{ seccion: "Documento", texto: buffer.toString("utf8") }];
  }

  if (isMimeOrExtension(file, [MIME_TYPES.MARKDOWN, MIME_TYPES.TEXT], [".md", ".markdown", ".txt"])) {
    return [{ seccion: "Documento", texto: buffer.toString("utf8") }];
  }

  if (isMimeOrExtension(file, [MIME_TYPES.DOCX], [".docx"])) {
    const result = await mammoth.extractRawText({ buffer });
    return [{ seccion: "Documento", texto: result.value }];
  }

  if (isMimeOrExtension(file, [MIME_TYPES.PDF], [".pdf"])) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return [{ seccion: "Documento", texto: result.text }];
    } finally {
      await parser.destroy();
    }
  }

  if (isMimeOrExtension(file, [MIME_TYPES.XLSX], [".xlsx"])) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    return workbook.SheetNames.map((sheetName) => ({
      seccion: `Hoja: ${sheetName}`,
      texto: XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]),
    }));
  }

  return null;
}

module.exports = { extraerTexto };
