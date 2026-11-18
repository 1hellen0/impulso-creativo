const { sequelize, verificarConexionDB } = require("../config/database");

async function ejecutarVerificacion() {
  try {
    await verificarConexionDB();
  } catch (error) {
    console.error("No fue posible conectar con MySQL.");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

ejecutarVerificacion();
