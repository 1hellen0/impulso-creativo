"use strict";

module.exports = (sequelize, DataTypes) => {
  const ConsultaChat = sequelize.define(
    "ConsultaChat",
    {
      id_consulta: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      id_colaborador: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      pregunta: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      intencion: {
        type: DataTypes.ENUM(
          "politica",
          "dato_personal",
          "reporte",
          "mixta",
          "fuera_de_alcance",
        ),
        allowNull: false,
      },
      agente: {
        type: DataTypes.STRING(60),
        allowNull: false,
      },
      documentos_citados: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      resuelta: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      escalada: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      latencia_ms: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      fecha: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: "consultas_chat",
      timestamps: false,
      indexes: [
        {
          fields: ["fecha"],
          name: "idx_consultas_fecha",
        },
        {
          fields: ["intencion", "fecha"],
          name: "idx_consultas_intencion_fecha",
        },
        {
          fields: ["id_colaborador", "fecha"],
          name: "idx_consultas_colaborador_fecha",
        },
      ],
    },
  );

  ConsultaChat.associate = (models) => {
    ConsultaChat.belongsTo(models.Colaborador, {
      foreignKey: "id_colaborador",
      as: "colaborador",
    });
  };

  return ConsultaChat;
};
