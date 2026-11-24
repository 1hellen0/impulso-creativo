"use strict";

/**
 * Normaliza instalaciones reparadas por la migración anterior antes de que
 * esta declarara explícitamente AUTO_INCREMENT tras un renameColumn de MySQL.
 * En instalaciones nuevas las dos columnas ya tienen esta definición.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [foreignKeys] = await queryInterface.sequelize.query(`
      SELECT TABLE_NAME, CONSTRAINT_NAME
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME = 'colaboradores'
        AND REFERENCED_COLUMN_NAME = 'id_colaborador'
    `);

    for (const foreignKey of foreignKeys) {
      await queryInterface.removeConstraint(foreignKey.TABLE_NAME, foreignKey.CONSTRAINT_NAME);
    }

    await queryInterface.changeColumn("colaboradores", "id_colaborador", {
      type: Sequelize.INTEGER,
      allowNull: false,
      autoIncrement: true,
    });
    await queryInterface.changeColumn("saldos_vacaciones", "id_saldo", {
      type: Sequelize.INTEGER,
      allowNull: false,
      autoIncrement: true,
    });

    await queryInterface.addConstraint("colaboradores", {
      fields: ["jefe_id"], type: "foreign key", name: "fk_colaboradores_jefe",
      references: { table: "colaboradores", field: "id_colaborador" },
      onUpdate: "CASCADE", onDelete: "SET NULL",
    });
    await queryInterface.addConstraint("saldos_vacaciones", {
      fields: ["id_colaborador"], type: "foreign key", name: "fk_saldos_vacaciones_colaborador",
      references: { table: "colaboradores", field: "id_colaborador" },
      onUpdate: "CASCADE", onDelete: "RESTRICT",
    });
    await queryInterface.addConstraint("solicitudes", {
      fields: ["id_colaborador"], type: "foreign key", name: "solicitudes_ibfk_1",
      references: { table: "colaboradores", field: "id_colaborador" },
      onUpdate: "CASCADE", onDelete: "RESTRICT",
    });
    await queryInterface.addConstraint("solicitudes", {
      fields: ["id_aprobador"], type: "foreign key", name: "solicitudes_ibfk_2",
      references: { table: "colaboradores", field: "id_colaborador" },
      onUpdate: "CASCADE", onDelete: "SET NULL",
    });
  },

  async down() {
    // AUTO_INCREMENT es parte del esquema previo y del esquema destino; no se
    // elimina para evitar una reversión que rompa inserciones posteriores.
  },
};
