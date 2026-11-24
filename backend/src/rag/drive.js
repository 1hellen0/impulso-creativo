"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { google } = require("googleapis");

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const GOOGLE_DOCUMENT_MIME_TYPE = "application/vnd.google-apps.document";

function crearClienteDrive() {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!credentialPath || !folderId) {
    throw new Error(
      "Faltan GOOGLE_APPLICATION_CREDENTIALS o GOOGLE_DRIVE_FOLDER_ID en la configuración local.",
    );
  }

  const keyFile = path.resolve(process.cwd(), credentialPath);
  if (!fs.existsSync(keyFile)) {
    throw new Error("No se encontró el archivo local de credenciales de Google Drive.");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  return {
    drive: google.drive({ version: "v3", auth }),
    folderId,
  };
}

async function listarRecursivamente(drive, folderId, parentPath = "") {
  const files = [];
  let pageToken;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      includeItemsFromAllDrives: true,
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, md5Checksum)",
    });

    for (const file of response.data.files || []) {
      const filePath = parentPath ? `${parentPath}/${file.name}` : file.name;
      if (file.mimeType === FOLDER_MIME_TYPE) {
        files.push(...await listarRecursivamente(drive, file.id, filePath));
      } else {
        files.push({ ...file, path: filePath });
      }
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return files;
}

async function descargarArchivo(drive, file) {
  if (file.mimeType === GOOGLE_DOCUMENT_MIME_TYPE) {
    const response = await drive.files.export(
      { fileId: file.id, mimeType: "text/plain", supportsAllDrives: true },
      { responseType: "arraybuffer" },
    );
    return Buffer.from(response.data);
  }

  const response = await drive.files.get(
    { fileId: file.id, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(response.data);
}

module.exports = {
  crearClienteDrive,
  descargarArchivo,
  listarRecursivamente,
  GOOGLE_DOCUMENT_MIME_TYPE,
};
