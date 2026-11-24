"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("saldos_vacaciones", {
      id_saldo: {
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
      periodo: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      dias_asignados: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      dias_tomados: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      dias_disponibles: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
    });

    await queryInterface.addConstraint("saldos_vacaciones", {
      fields: ["id_colaborador", "periodo"],
      type: "unique",
      name: "uq_saldos_colaborador_periodo",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("saldos_vacaciones");
  },
};