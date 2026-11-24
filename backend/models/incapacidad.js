"use strict";

module.exports = (sequelize, DataTypes) => {
  const Incapacidad = sequelize.define(
    "Incapacidad",
    {
      id_incapacidad: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_colaborador: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      tipo: {
        type: DataTypes.ENUM(
          "enfermedad_comun",
          "riesgo_trabajo",
          "maternidad",
          "paternidad",
          "otro",
        ),
        allowNull: false,
      },
      fecha_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      dias: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      entidad: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      observacion_administrativa: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "incapacidades",
      timestamps: false,
      indexes: [
        {
          fields: ["id_colaborador", "fecha_inicio"],
          name: "idx_incapacidades_colaborador_fecha",
        },
      ],
    },
  );

  Incapacidad.associate = (models) => {
    Incapacidad.belongsTo(models.Colaborador, {
      foreignKey: "id_colaborador",
      as: "colaborador",
    });
  };

  return Incapacidad;
};0