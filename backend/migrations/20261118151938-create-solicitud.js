"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("solicitudes", {
      id_solicitud: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      id_colaborador: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "colaboradores",
          key: "id_colaborador",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      tipo: {
        type: Sequelize.ENUM("vacaciones", "permiso", "licencia"),
        allowNull: false,
      },
      fecha_inicio: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      fecha_fin: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      estado: {
        type: Sequelize.ENUM("pendiente", "aprobada", "rechazada", "cancelada"),
        allowNull: false,
        defaultValue: "pendiente",
      },
      id_aprobador: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "colaboradores",
          key: "id_colaborador",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      creada_en: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("solicitudes", ["id_colaborador", "estado"], {
      name: "idx_solicitudes_colaborador_estado",
    });

    await queryInterface.addIndex("solicitudes", ["estado", "creada_en"], {
      name: "idx_solicitudes_estado_fecha",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("solicitudes");
  },
};