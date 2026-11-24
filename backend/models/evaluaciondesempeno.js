"use strict";

module.exports = (sequelize, DataTypes) => {
  const EvaluacionDesempeno = sequelize.define(
    "EvaluacionDesempeno",
    {
      id_evaluacion: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_colaborador: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      fecha_programada: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      estado: {
        type: DataTypes.ENUM("pendiente", "completada", "reprogramada"),
        allowNull: false,
        defaultValue: "pendiente",
      },
    },
    {
      tableName: "evaluaciones_desempeno",
      timestamps: false,
      indexes: [
        {
          fields: ["fecha_programada", "estado"],
          name: "idx_evaluaciones_fecha_estado",
        },
      ],
    },
  );

  EvaluacionDesempeno.associate = (models) => {
    EvaluacionDesempeno.belongsTo(models.Colaborador, {
      foreignKey: "id_colaborador",
      as: "colaborador",
    });
  };

  return EvaluacionDesempeno;
};