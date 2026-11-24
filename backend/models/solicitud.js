"use strict";

module.exports = (sequelize, DataTypes) => {
  const Solicitud = sequelize.define(
    "Solicitud",
    {
      id_solicitud: {
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
        type: DataTypes.ENUM("vacaciones", "permiso", "licencia"),
        allowNull: false,
      },
      fecha_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      fecha_fin: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          fechaFinValida() {
            if (this.fecha_inicio && this.fecha_fin && this.fecha_fin < this.fecha_inicio) {
              throw new Error("La fecha final no puede ser anterior a la fecha inicial.");
            }
          },
        },
      },
      estado: {
        type: DataTypes.ENUM("pendiente", "aprobada", "rechazada", "cancelada"),
        allowNull: false,
        defaultValue: "pendiente",
      },
      id_aprobador: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      creada_en: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: "solicitudes",
      timestamps: false,
      indexes: [
        {
          fields: ["id_colaborador", "estado"],
          name: "idx_solicitudes_colaborador_estado",
        },
        {
          fields: ["estado", "creada_en"],
          name: "idx_solicitudes_estado_fecha",
        },
      ],
    },
  );

  Solicitud.associate = (models) => {
    Solicitud.belongsTo(models.Colaborador, {
      foreignKey: "id_colaborador",
      as: "colaborador",
    });

    Solicitud.belongsTo(models.Colaborador, {
      foreignKey: "id_aprobador",
      as: "aprobador",
    });
  };

  return Solicitud;
};