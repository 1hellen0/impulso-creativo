const express = require("express");

const app = express();

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    estado: "correcto",
    mensaje: "API de Impulso Creativo activa",
  });
});

module.exports = app;