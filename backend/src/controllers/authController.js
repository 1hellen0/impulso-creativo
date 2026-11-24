"use strict";

const bcrypt = require("bcryptjs");
const { Colaborador } = require("../../models");
const { firmarToken } = require("../services/authToken");

async function iniciarSesion(req, res) {
  const correo = typeof req.body?.correo === "string" ? req.body.correo.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!correo || !password || correo.length > 150 || password.length > 200) {
    return res.status(400).json({ error: "Correo y contraseña son obligatorios." });
  }

  const colaborador = await Colaborador.findOne({ where: { correo } });
  const passwordValido = colaborador?.password_hash
    ? await bcrypt.compare(password, colaborador.password_hash)
    : false;

  if (!colaborador || colaborador.estado !== "activo" || !passwordValido) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  }

  const token = firmarToken(colaborador);
  return res.status(200).json({
    token,
    usuario: {
      id_colaborador: colaborador.id_colaborador,
      nombre: colaborador.nombre,
      correo: colaborador.correo,
      rol: colaborador.rol,
    },
  });
}

module.exports = { iniciarSesion };
