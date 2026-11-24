"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("colaboradores", {
      id_colaborador: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
      },
      codigo: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },
      nombre: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      correo: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: true,
      },
      departamento: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      puesto: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      fecha_ingreso: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      jefe_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: "colaboradores",
          key: "id_colaborador",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      rol: {
        type: Sequelize.ENUM("colaborador", "rrhh"),
        allowNull: false,
        defaultValue: "colaborador",
      },
      estado: {
        type: Sequelize.ENUM("activo", "inactivo", "licencia"),
        allowNull: false,
        defaultValue: "activo",
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("colaboradores");
  },
};