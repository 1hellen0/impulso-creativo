"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("evaluaciones_desempeno", {
      id_evaluacion: {
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
      fecha_programada: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      estado: {
        type: Sequelize.ENUM("pendiente", "completada", "reprogramada"),
        allowNull: false,
        defaultValue: "pendiente",
      },
    });

    await queryInterface.addIndex(
      "evaluaciones_desempeno",
      ["fecha_programada", "estado"],
      { name: "idx_evaluaciones_fecha_estado" },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("evaluaciones_desempeno");
  },
};