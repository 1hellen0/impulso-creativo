require("dotenv").config();

const { Sequelize } = require("sequelize");
const configurations = require("../../config/config");

const environment = process.env.NODE_ENV || "development";
const databaseConfig = configurations[environment];

if (!databaseConfig) {
  throw new Error(
    `NODE_ENV inválido: "${environment}". Usa development, test o production.`,
  );
}

const sequelize = new Sequelize(databaseConfig);

async function verificarConexionDB() {
  await sequelize.authenticate();
  console.log("Conexión con MySQL verificada correctamente.");
}

module.exports = {
  sequelize,
  verificarConexionDB,
};
