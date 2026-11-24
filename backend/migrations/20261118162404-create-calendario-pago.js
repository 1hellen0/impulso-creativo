"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("calendario_pagos", {
      id_pago: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      periodo_inicio: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      periodo_fin: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      fecha_pago: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      descripcion: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
    });

    await queryInterface.addIndex("calendario_pagos", ["fecha_pago"], {
      name: "idx_calendario_pagos_fecha",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("calendario_pagos");
  },
};
