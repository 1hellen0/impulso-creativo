"use strict";

module.exports = (sequelize, DataTypes) => {
  const CalendarioPago = sequelize.define(
    "CalendarioPago",
    {
      id_pago: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      periodo_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      periodo_fin: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          periodoValido() {
            if (
              this.periodo_inicio &&
              this.periodo_fin &&
              this.periodo_fin < this.periodo_inicio
            ) {
              throw new Error(
                "El fin del periodo no puede ser anterior a su inicio.",
              );
            }
          },
        },
      },
      fecha_pago: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      descripcion: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
    },
    {
      tableName: "calendario_pagos",
      timestamps: false,
      indexes: [
        {
          fields: ["fecha_pago"],
          name: "idx_calendario_pagos_fecha",
        },
      ],
    },
  );

  return CalendarioPago;
};