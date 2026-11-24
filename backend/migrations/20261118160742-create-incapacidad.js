"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("incapacidades", {
      id_incapacidad: {
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
        type: Sequelize.ENUM(
          "enfermedad_comun",
          "riesgo_trabajo",
          "maternidad",
          "paternidad",
          "otro",
        ),
        allowNull: false,
      },
      fecha_inicio: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      dias: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      entidad: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },
      observacion_administrativa: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
    });

    await queryInterface.addIndex(
      "incapacidades",
      ["id_colaborador", "fecha_inicio"],
      { name: "idx_incapacidades_colaborador_fecha" },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("incapacidades");
  },
};