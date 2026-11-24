"use strict";

const jwt = require("jsonwebtoken");

const DEFAULT_EXPIRATION = "8h";

function obtenerJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET debe configurarse con al menos 32 caracteres.");
  }
  return secret;
}

function firmarToken(colaborador) {
  return jwt.sign(
    { sub: String(colaborador.id_colaborador) },
    obtenerJwtSecret(),
    {
      algorithm: "HS256",
      expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRATION,
      issuer: "impulso-creativo",
      audience: "impulso-creativo-api",
    },
  );
}

function verificarToken(token) {
  return jwt.verify(token, obtenerJwtSecret(), {
    algorithms: ["HS256"],
    issuer: "impulso-creativo",
    audience: "impulso-creativo-api",
  });
}

module.exports = { firmarToken, verificarToken };
