"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const {
  crearClienteDrive,
  listarRecursivamente,
} = require("./drive");
const {
  eliminarArchivosIndexados,
  indexarArchivosDrive,
  obtenerArchivosIndexados,
} = require("./indexador");
const { fechaCostaRica } = require("../services/analistaReportes");

const STATE_FILE_NAME = "drive-sync-state.json";
const LOCK_FILE_NAME = "drive-sync.lock";
let sincronizacionEnCurso = null;

function rutaEstado() {
  return path.resolve(process.cwd(), process.env.LANCEDB_PATH || "data/lancedb", STATE_FILE_NAME);
}

function rutaLock() {
  return path.resolve(process.cwd(), process.env.LANCEDB_PATH || "data/lancedb", LOCK_FILE_NAME);
}

async function adquirirLock() {
  const target = rutaLock();
  await fs.mkdir(path.dirname(target), { recursive: true });
  try {
    const handle = await fs.open(target, "wx");
    await handle.writeFile(`${process.pid}\n`, "utf8");
    await handle.close();
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error("Ya hay una sincronización de Drive en ejecución.");
    }
    throw error;
  }

  return async () => {
    try {
      await fs.unlink(target);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  };
}

async function leerEstado() {
  try {
    const raw = await fs.readFile(rutaEstado(), "utf8");
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || !Array.isArray(value.managedFileIds)) return null;
    return value;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw new Error("No fue posible leer el estado local de sincronización de Drive.");
  }
}

async function guardarEstado(estado) {
  const target = rutaEstado();
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporal = `${target}.tmp`;
  await fs.writeFile(temporal, `${JSON.stringify(estado, null, 2)}\n`, "utf8");
  await fs.rename(temporal, target);
}

function esCursorInvalido(error) {
  const status = error?.code || error?.status || error?.response?.status;
  return status === 410 || /page token|start page token|cursor|expired|invalid/i.test(error?.message || "");
}

async function obtenerCursorActual(drive) {
  const response = await drive.changes.getStartPageToken({
    supportsAllDrives: true,
  });
  const token = response.data.startPageToken;
  if (!token) throw new Error("Drive no devolvió un cursor inicial de cambios.");
  return token;
}

async function listarCambios(drive, pageToken) {
  const cambios = [];
  let token = pageToken;
  let nuevoCursor = null;

  do {
    const response = await drive.changes.list({
      pageToken: token,
      includeItemsFromAllDrives: true,
      pageSize: 100,
      restrictToMyDrive: false,
      spaces: "drive",
      supportsAllDrives: true,
      fields: "nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,modifiedTime,md5Checksum,trashed,parents))",
    });
    cambios.push(...(response.data.changes || []));
    token = response.data.nextPageToken;
    nuevoCursor = response.data.newStartPageToken || nuevoCursor;
  } while (token);

  return { cambios, nuevoCursor: nuevoCursor || await obtenerCursorActual(drive) };
}

function archivoCambioRequiereReconciliacion(cambio) {
  return cambio.file?.mimeType === "application/vnd.google-apps.folder";
}

async function reconciliar({ drive, folderId, estadoAnterior, reason }) {
  const archivosDrive = await listarRecursivamente(drive, folderId);
  const archivosIndexados = await obtenerArchivosIndexados();
  const porId = new Map(archivosDrive.map((file) => [file.id, file]));
  const idsAdministrados = new Set(
    estadoAnterior?.folderId === folderId ? estadoAnterior.managedFileIds : [],
  );

  const porIndexar = archivosDrive.filter((file) => {
    const indexado = archivosIndexados.get(file.id);
    return !indexado || indexado.fechaModificacion !== (file.modifiedTime || null);
  });
  const resultadoIndexacion = porIndexar.length
    ? await indexarArchivosDrive(porIndexar)
    : { archivos: 0, archivosIndexados: [], fragmentos: 0 };

  // Solo se eliminan IDs previamente confirmados dentro de la carpeta configurada.
  const porEliminar = [...idsAdministrados].filter((fileId) => !porId.has(fileId));
  const eliminados = await eliminarArchivosIndexados(porEliminar);
  const indexadosDespues = await obtenerArchivosIndexados();
  const managedFileIds = archivosDrive
    .filter((file) => indexadosDespues.has(file.id))
    .map((file) => file.id)
    .sort();
  const protegidosSinPropiedad = !estadoAnterior
    ? [...archivosIndexados.keys()].filter((fileId) => !porId.has(fileId)).length
    : 0;

  const cursor = await obtenerCursorActual(drive);
  await guardarEstado({
    version: 1,
    folderId,
    startPageToken: cursor,
    managedFileIds,
    sincronizadoEn: new Date().toISOString(),
  });

  return {
    modo: "reconciliacion",
    motivo: reason,
    archivosIndexados: resultadoIndexacion.archivos,
    fragmentosIndexados: resultadoIndexacion.fragmentos,
    archivosEliminados: eliminados,
    protegidosSinPropiedad,
  };
}

async function sincronizarInternamente() {
  const { drive, folderId } = crearClienteDrive();
  const estado = await leerEstado();
  if (!estado || estado.folderId !== folderId || !estado.startPageToken) {
    return reconciliar({
      drive,
      folderId,
      estadoAnterior: estado?.folderId === folderId ? estado : null,
      reason: estado ? "carpeta_cambiada_o_estado_incompleto" : "estado_inicial",
    });
  }

  let cambios;
  try {
    cambios = await listarCambios(drive, estado.startPageToken);
  } catch (error) {
    if (!esCursorInvalido(error)) throw error;
    return reconciliar({ drive, folderId, estadoAnterior: estado, reason: "cursor_invalido" });
  }

  if (cambios.cambios.some(archivoCambioRequiereReconciliacion)) {
    return reconciliar({ drive, folderId, estadoAnterior: estado, reason: "cambio_de_carpeta" });
  }

  const archivosDrive = await listarRecursivamente(drive, folderId);
  const porId = new Map(archivosDrive.map((file) => [file.id, file]));
  const archivosIndexados = await obtenerArchivosIndexados();
  const idsCambiados = new Set(cambios.cambios.map((cambio) => cambio.fileId));
  const porIndexar = archivosDrive.filter((file) => {
    const indexado = archivosIndexados.get(file.id);
    return idsCambiados.has(file.id)
      || !indexado
      || indexado.fechaModificacion !== (file.modifiedTime || null);
  });

  const resultadoIndexacion = porIndexar.length
    ? await indexarArchivosDrive(porIndexar)
    : { archivos: 0, archivosIndexados: [], fragmentos: 0 };
  const porEliminar = estado.managedFileIds.filter((fileId) => !porId.has(fileId));
  const eliminados = await eliminarArchivosIndexados(porEliminar);
  const indexadosDespues = await obtenerArchivosIndexados();
  const managedFileIds = archivosDrive
    .filter((file) => indexadosDespues.has(file.id))
    .map((file) => file.id)
    .sort();

  await guardarEstado({
    version: 1,
    folderId,
    startPageToken: cambios.nuevoCursor,
    managedFileIds,
    sincronizadoEn: new Date().toISOString(),
  });

  return {
    modo: "incremental",
    archivosIndexados: resultadoIndexacion.archivos,
    fragmentosIndexados: resultadoIndexacion.fragmentos,
    archivosEliminados: eliminados,
    cambiosDetectados: cambios.cambios.length,
  };
}

function sincronizarDrive() {
  if (sincronizacionEnCurso) return sincronizacionEnCurso;
  sincronizacionEnCurso = (async () => {
    const liberar = await adquirirLock();
    try {
      return await sincronizarInternamente();
    } finally {
      await liberar();
    }
  })().finally(() => {
    sincronizacionEnCurso = null;
  });
  return sincronizacionEnCurso;
}

function proximaEjecucionCostaRica() {
  const ahora = new Date();
  const [year, month, day] = fechaCostaRica(ahora).split("-").map(Number);
  const proxima = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (proxima <= ahora) proxima.setUTCDate(proxima.getUTCDate() + 1);
  return proxima;
}

function iniciarProgramadorSincronizacion() {
  const inicial = sincronizarDrive().catch(() => {
    console.error("No fue posible recuperar la sincronización pendiente de Drive.");
  });

  const programar = () => {
    const delay = proximaEjecucionCostaRica().getTime() - Date.now();
    setTimeout(async () => {
      try {
        await sincronizarDrive();
      } catch (error) {
        console.error("No fue posible ejecutar la sincronización diaria de Drive.");
      }
      programar();
    }, delay);
  };
  programar();
  return inicial;
}

module.exports = {
  iniciarProgramadorSincronizacion,
  sincronizarDrive,
};
