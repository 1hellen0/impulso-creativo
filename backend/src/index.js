require("dotenv").config();

const app = require("./app");
const { iniciarProgramadorReportes } = require("./services/analistaReportes");
const { iniciarProgramadorSincronizacion } = require("./rag/sincronizacion");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor de Impulso Creativo activo en http://localhost:${PORT}`);
  iniciarProgramadorSincronizacion().finally(() => iniciarProgramadorReportes());
});
