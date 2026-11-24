"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("reportes_diarios", {
      id_reporte: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      fecha: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        unique: true,
      },
      datos_json: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      resumen_texto: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      generado_por: {
        type: Sequelize.STRING(60),
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("reportes_diarios");
  },
};