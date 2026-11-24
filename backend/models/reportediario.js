"use strict";

module.exports = (sequelize, DataTypes) => {
  const ReporteDiario = sequelize.define(
    "ReporteDiario",
    {
      id_reporte: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        unique: true,
      },
      datos_json: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      resumen_texto: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      generado_por: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
    },
    {
      tableName: "reportes_diarios",
      timestamps: false,
    },
  );

  return ReporteDiario;
};