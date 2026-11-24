"use strict";

require("dotenv").config();

const bcrypt = require("bcryptjs");
const { Colaborador, sequelize } = require("../../models");

sequelize.options.logging = false;

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 200;
const BCRYPT_ROUNDS = 12;

async function configurarUsuarioEvaluacion() {
  const correo = typeof process.env.EVALUATION_COLABORADOR_CORREO === "string"
    ? process.env.EVALUATION_COLABORADOR_CORREO.trim()
    : "";
  const password = process.env.EVALUATION_COLABORADOR_PASSWORD || "";

  if (!correo || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new Error("EVALUATION_COLABORADOR_CORREO y EVALUATION_COLABORADOR_PASSWORD válida de al menos 12 caracteres son obligatorias.");
  }

  const colaborador = await Colaborador.findOne({ where: { correo } });
  if (!colaborador) {
    throw new Error("No existe un colaborador con el correo de evaluación configurado.");
  }
  if (colaborador.rol !== "colaborador" || colaborador.estado !== "activo") {
    throw new Error("La cuenta de evaluación debe pertenecer a un colaborador activo con rol colaborador.");
  }
  if (colaborador.password_hash) {
    throw new Error("La cuenta de evaluación ya tiene una contraseña configurada; no se modificó.");
  }

  await colaborador.update({
    password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
  });
  console.log("Cuenta de evaluación configurada correctamente.");
}

configurarUsuarioEvaluacion()
  .catch((error) => {
    console.error("No se pudo configurar la cuenta de evaluación.");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
