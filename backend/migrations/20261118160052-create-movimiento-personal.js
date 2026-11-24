"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("movimientos_personal", {
      id_movimiento: {
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
        type: Sequelize.ENUM("ingreso", "salida", "ascenso"),
        allowNull: false,
      },
      fecha: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      motivo: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
    });

    await queryInterface.addIndex(
      "movimientos_personal",
      ["fecha", "tipo"],
      { name: "idx_movimientos_fecha_tipo" },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("movimientos_personal");
  },
};