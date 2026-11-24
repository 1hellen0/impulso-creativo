"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("colaboradores", "password_hash", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addIndex("consultas_chat", ["id_colaborador", "fecha"], {
      name: "idx_consultas_colaborador_fecha",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("consultas_chat", "idx_consultas_colaborador_fecha");
    await queryInterface.removeColumn("colaboradores", "password_hash");
  },
};
