"use strict";

module.exports = (sequelize, DataTypes) => {
  const SaldoVacaciones = sequelize.define(
    "SaldoVacaciones",
    {
      id_saldo: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_colaborador: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      periodo: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1901,
          max: 2155,
        },
      },
      dias_asignados: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      dias_tomados: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      dias_disponibles: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      tableName: "saldos_vacaciones",
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ["id_colaborador", "periodo"],
          name: "uq_saldos_colaborador_periodo",
        },
      ],
    },
  );

  SaldoVacaciones.associate = (models) => {
    SaldoVacaciones.belongsTo(models.Colaborador, {
      foreignKey: "id_colaborador",
      as: "colaborador",
    });
  };

  return SaldoVacaciones;
};