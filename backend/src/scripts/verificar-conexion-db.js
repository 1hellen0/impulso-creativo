"use strict";

const {
  sequelize,
  verificarConexionDB,
} = require("../config/database");

async function ejecutarVerificacion() {
  try {
    await verificarConexionDB();
  } catch (error) {
    console.error("No se pudo conectar con MySQL.");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

ejecutarVerificacion().catch((error) => {
  console.error("No se pudo cerrar la conexión de Sequelize.");
  console.error(error.message);
  process.exitCode = 1;
});
