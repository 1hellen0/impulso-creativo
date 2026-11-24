"use strict";

require("dotenv").config();

const bcrypt = require("bcryptjs");
const { Colaborador, sequelize } = require("../../models");

const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_ROUNDS = 12;

async function configurarCuentaInicialRRHH() {
  const correo = typeof process.env.INITIAL_RRHH_CORREO === "string"
    ? process.env.INITIAL_RRHH_CORREO.trim()
    : "";
  const password = process.env.INITIAL_RRHH_PASSWORD || "";

  if (!correo || password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
    throw new Error("INITIAL_RRHH_CORREO e INITIAL_RRHH_PASSWORD válida de al menos 12 caracteres son obligatorias.");
  }

  const colaborador = await Colaborador.findOne({ where: { correo } });
  if (!colaborador) {
    throw new Error("No existe un colaborador con el correo configurado.");
  }
  if (colaborador.rol !== "rrhh" || colaborador.estado !== "activo") {
    throw new Error("La cuenta inicial debe pertenecer a un colaborador activo con rol rrhh.");
  }
  if (colaborador.password_hash) {
    throw new Error("La cuenta ya tiene una contraseña configurada.");
  }

  await colaborador.update({
    password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
  });
  console.log("Cuenta inicial de RR. HH. configurada correctamente.");
}

configurarCuentaInicialRRHH()
  .catch((error) => {
    console.error("No se pudo configurar la cuenta inicial de RR. HH.");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
