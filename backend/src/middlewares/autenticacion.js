"use strict";

const { Colaborador } = require("../../models");
const { verificarToken } = require("../services/authToken");

async function autenticar(req, res, next) {
  const authorization = req.get("authorization");
  const [scheme, token] = authorization ? authorization.split(" ") : [];

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Se requiere un token de autenticación válido." });
  }

  try {
    const payload = verificarToken(token);
    const idColaborador = Number(payload.sub);
    if (!Number.isInteger(idColaborador)) {
      throw new Error("Token sin identificador válido.");
    }

    const colaborador = await Colaborador.findByPk(idColaborador, {
      attributes: ["id_colaborador", "nombre", "correo", "rol", "estado"],
    });
    if (!colaborador || colaborador.estado !== "activo") {
      return res.status(401).json({ error: "La cuenta no está disponible." });
    }

    req.usuario = colaborador;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "El token de autenticación no es válido o venció." });
  }
}

function requerirRRHH(req, res, next) {
  if (req.usuario?.rol !== "rrhh") {
    return res.status(403).json({ error: "Esta operación requiere el rol de Recursos Humanos." });
  }
  return next();
}

module.exports = { autenticar, requerirRRHH };
