"use strict";

module.exports = (sequelize, DataTypes) => {
  const MovimientoPersonal = sequelize.define(
    "MovimientoPersonal",
    {
      id_movimiento: {
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
        type: DataTypes.ENUM("ingreso", "salida", "ascenso"),
        allowNull: false,
      },
      fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      motivo: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "movimientos_personal",
      timestamps: false,
      indexes: [
        {
          fields: ["fecha", "tipo"],
          name: "idx_movimientos_fecha_tipo",
        },
      ],
    },
  );

  MovimientoPersonal.associate = (models) => {
    MovimientoPersonal.belongsTo(models.Colaborador, {
      foreignKey: "id_colaborador",
      as: "colaborador",
    });
  };

  return MovimientoPersonal;
};