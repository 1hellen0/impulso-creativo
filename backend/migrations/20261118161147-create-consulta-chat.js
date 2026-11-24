"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("consultas_chat", {
      id_consulta: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      id_colaborador: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "colaboradores",
          key: "id_colaborador",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      pregunta: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      intencion: {
        type: Sequelize.ENUM(
          "politica",
          "dato_personal",
          "reporte",
          "mixta",
          "fuera_de_alcance",
        ),
        allowNull: false,
      },
      agente: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
      documentos_citados: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      resuelta: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      escalada: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      latencia_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      fecha: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("consultas_chat", ["fecha"], {
      name: "idx_consultas_fecha",
    });

    await queryInterface.addIndex("consultas_chat", ["intencion", "fecha"], {
      name: "idx_consultas_intencion_fecha",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("consultas_chat");
  },
};