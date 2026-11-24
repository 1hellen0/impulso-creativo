require("dotenv").config();

const path = require("node:path");
const fs = require("node:fs");
const { google } = require("googleapis");

async function verificarDrive() {
  const rutaCredenciales = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const idCarpeta = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!rutaCredenciales || !idCarpeta) {
    throw new Error(
      "Faltan GOOGLE_APPLICATION_CREDENTIALS o GOOGLE_DRIVE_FOLDER_ID en .env."
    );
  }

  const archivoCredenciales = path.resolve(process.cwd(), rutaCredenciales);

  if (!fs.existsSync(archivoCredenciales)) {
    throw new Error(
      "No se encontró el archivo de credenciales en la ruta configurada."
    );
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: archivoCredenciales,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const drive = google.drive({ version: "v3", auth });

  const respuesta = await drive.files.list({
    q: `'${idCarpeta}' in parents and trashed = false`,
    pageSize: 100,
    fields: "files(id, name, mimeType)",
  });

  const archivos = respuesta.data.files || [];

  console.log(
    `Conexión con Drive correcta. Elementos encontrados: ${archivos.length}`
  );

  for (const archivo of archivos) {
    console.log(`- ${archivo.name}`);
  }
}

verificarDrive().catch((error) => {
  console.error("No se pudo acceder a la carpeta de Google Drive.");
  console.error(error.message);
  process.exitCode = 1;
});