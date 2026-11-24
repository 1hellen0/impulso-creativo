const express = require("express");
const authRouter = require("./routes/auth");
const politicasRouter = require("./routes/politicas");

const app = express();

app.use(express.json());
app.use("/api", authRouter);
app.use("/api", politicasRouter);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    estado: "correcto",
    mensaje: "API de Impulso Creativo activa",
  });
});

module.exports = app;
