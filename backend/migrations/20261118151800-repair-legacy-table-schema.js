"use strict";

/**
 * Repara las tablas creadas anteriormente por `sequelize.sync()`. Esa
 * creación usó la pluralización y los atributos predeterminados de Sequelize,
 * mientras que el esquema del proyecto se gestiona mediante migraciones.
 *
 * La migración no elimina las columnas heredadas `createdAt` y `updatedAt`:
 * pueden contener auditoría en instalaciones que ya tengan datos. Los modelos
 * no las usan porque tienen `timestamps: false`.
 */

const legacyTables = {
  colaboradores: "colaboradors",
  saldos_vacaciones: "saldovacaciones",
};

async function tableNames(queryInterface) {
  return (await queryInterface.showAllTables()).map((table) =>
    typeof table === "string" ? table : table.tableName,
  );
}

async function assertLegacyDataIsCompatible(queryInterface) {
  const [colaboradorIssues] = await queryInterface.sequelize.query(`
    SELECT
      SUM(id IS NULL) AS id_nulo,
      SUM(codigo IS NULL OR CHAR_LENGTH(codigo) > 20) AS codigo_invalido,
      SUM(nombre IS NULL OR CHAR_LENGTH(nombre) > 120) AS nombre_invalido,
      SUM(correo IS NULL OR CHAR_LENGTH(correo) > 150) AS correo_invalido,
      SUM(departamento IS NULL OR CHAR_LENGTH(departamento) > 80) AS departamento_invalido,
      SUM(puesto IS NULL OR CHAR_LENGTH(puesto) > 100) AS puesto_invalido,
      SUM(fecha_ingreso IS NULL) AS fecha_ingreso_nula,
      SUM(rol IS NULL OR rol NOT IN ('colaborador', 'rrhh')) AS rol_invalido,
      SUM(estado IS NULL OR estado NOT IN ('activo', 'inactivo', 'licencia')) AS estado_invalido,
      SUM(jefe_id IS NOT NULL AND jefe_id NOT IN (SELECT id FROM colaboradors)) AS jefe_invalido
    FROM colaboradors
  `);
  const [colaboradorDuplicates] = await queryInterface.sequelize.query(`
    SELECT
      (SELECT COUNT(*) FROM (SELECT codigo FROM colaboradors GROUP BY codigo HAVING COUNT(*) > 1) AS codigos) AS codigos_duplicados,
      (SELECT COUNT(*) FROM (SELECT correo FROM colaboradors GROUP BY correo HAVING COUNT(*) > 1) AS correos) AS correos_duplicados
  `);
  const [saldoIssues] = await queryInterface.sequelize.query(`
    SELECT
      SUM(id IS NULL) AS id_nulo,
      SUM(id_colaborador IS NULL) AS id_colaborador_nulo,
      SUM(periodo IS NULL) AS periodo_nulo,
      SUM(dias_asignados IS NULL OR dias_asignados < -999.99 OR dias_asignados > 999.99) AS dias_asignados_invalidos,
      SUM(dias_tomados IS NULL OR dias_tomados < -999.99 OR dias_tomados > 999.99) AS dias_tomados_invalidos,
      SUM(dias_disponibles IS NULL OR dias_disponibles < -999.99 OR dias_disponibles > 999.99) AS dias_disponibles_invalidos,
      SUM(id_colaborador IS NOT NULL AND id_colaborador NOT IN (SELECT id FROM colaboradors)) AS colaborador_invalido
    FROM saldovacaciones
  `);
  const [saldoDuplicates] = await queryInterface.sequelize.query(`
    SELECT COUNT(*) AS saldos_duplicados
    FROM (
      SELECT id_colaborador, periodo
      FROM saldovacaciones
      GROUP BY id_colaborador, periodo
      HAVING COUNT(*) > 1
    ) AS duplicados
  `);

  const values = [
    ...Object.values(colaboradorIssues[0]),
    ...Object.values(colaboradorDuplicates[0]),
    ...Object.values(saldoIssues[0]),
    ...Object.values(saldoDuplicates[0]),
  ].map(Number);

  if (values.some((value) => value > 0)) {
    throw new Error(
      "La reparación se detuvo: hay datos heredados incompatibles con las restricciones previstas. No se modificó ninguna tabla.",
    );
  }
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await tableNames(queryInterface);
    const hasLegacyColaboradores = tables.includes(legacyTables.colaboradores);
    const hasLegacySaldos = tables.includes(legacyTables.saldos_vacaciones);
    const hasColaboradores = tables.includes("colaboradores");
    const hasSaldos = tables.includes("saldos_vacaciones");

    if (!hasLegacyColaboradores && !hasLegacySaldos) {
      return;
    }

    if (!hasLegacyColaboradores || !hasLegacySaldos || hasColaboradores || hasSaldos) {
      throw new Error(
        "La reparación requiere exactamente las tablas heredadas colaboradors y saldovacaciones, sin tablas destino con el mismo nombre.",
      );
    }

    await assertLegacyDataIsCompatible(queryInterface);

    await queryInterface.renameTable(legacyTables.colaboradores, "colaboradores");
    await queryInterface.renameTable(legacyTables.saldos_vacaciones, "saldos_vacaciones");

    await queryInterface.renameColumn("colaboradores", "id", "id_colaborador");
    await queryInterface.renameColumn("saldos_vacaciones", "id", "id_saldo");

    // MySQL puede quitar AUTO_INCREMENT al renombrar una columna con la
    // implementación usada por Sequelize, por lo que se declara de nuevo.
    await queryInterface.changeColumn("colaboradores", "id_colaborador", {
      type: Sequelize.INTEGER, allowNull: false, autoIncrement: true,
    });
    await queryInterface.changeColumn("saldos_vacaciones", "id_saldo", {
      type: Sequelize.INTEGER, allowNull: false, autoIncrement: true,
    });

    await queryInterface.changeColumn("colaboradores", "codigo", {
      type: Sequelize.STRING(20), allowNull: false,
    });
    await queryInterface.changeColumn("colaboradores", "nombre", {
      type: Sequelize.STRING(120), allowNull: false,
    });
    await queryInterface.changeColumn("colaboradores", "correo", {
      type: Sequelize.STRING(150), allowNull: false,
    });
    await queryInterface.changeColumn("colaboradores", "departamento", {
      type: Sequelize.STRING(80), allowNull: false,
    });
    await queryInterface.changeColumn("colaboradores", "puesto", {
      type: Sequelize.STRING(100), allowNull: false,
    });
    await queryInterface.changeColumn("colaboradores", "fecha_ingreso", {
      type: Sequelize.DATEONLY, allowNull: false,
    });
    await queryInterface.changeColumn("colaboradores", "rol", {
      type: Sequelize.ENUM("colaborador", "rrhh"), allowNull: false, defaultValue: "colaborador",
    });
    await queryInterface.changeColumn("colaboradores", "estado", {
      type: Sequelize.ENUM("activo", "inactivo", "licencia"), allowNull: false, defaultValue: "activo",
    });

    await queryInterface.changeColumn("saldos_vacaciones", "id_colaborador", {
      type: Sequelize.INTEGER, allowNull: false,
    });
    await queryInterface.changeColumn("saldos_vacaciones", "periodo", {
      type: Sequelize.INTEGER, allowNull: false,
    });
    for (const column of ["dias_asignados", "dias_tomados", "dias_disponibles"]) {
      await queryInterface.changeColumn("saldos_vacaciones", column, {
        type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0,
      });
    }

    await queryInterface.addConstraint("colaboradores", {
      fields: ["codigo"], type: "unique", name: "uq_colaboradores_codigo",
    });
    await queryInterface.addConstraint("colaboradores", {
      fields: ["correo"], type: "unique", name: "uq_colaboradores_correo",
    });
    await queryInterface.addConstraint("colaboradores", {
      fields: ["jefe_id"], type: "foreign key", name: "fk_colaboradores_jefe",
      references: { table: "colaboradores", field: "id_colaborador" },
      onUpdate: "CASCADE", onDelete: "SET NULL",
    });
    await queryInterface.addConstraint("saldos_vacaciones", {
      fields: ["id_colaborador", "periodo"], type: "unique", name: "uq_saldos_colaborador_periodo",
    });
    await queryInterface.addConstraint("saldos_vacaciones", {
      fields: ["id_colaborador"], type: "foreign key", name: "fk_saldos_vacaciones_colaborador",
      references: { table: "colaboradores", field: "id_colaborador" },
      onUpdate: "CASCADE", onDelete: "RESTRICT",
    });
  },

  async down(queryInterface, Sequelize) {
    const tables = await tableNames(queryInterface);
    if (!tables.includes("colaboradores") || !tables.includes("saldos_vacaciones")) {
      return;
    }

    // Solo se revierte una reparación real; en una base nueva las tablas no
    // tienen estas columnas heredadas y la migración up fue un no-op.
    const columns = await queryInterface.describeTable("colaboradores");
    if (!columns.createdAt || !columns.updatedAt) {
      return;
    }

    await queryInterface.removeConstraint("saldos_vacaciones", "fk_saldos_vacaciones_colaborador");
    await queryInterface.removeConstraint("saldos_vacaciones", "uq_saldos_colaborador_periodo");
    await queryInterface.removeConstraint("colaboradores", "fk_colaboradores_jefe");
    await queryInterface.removeConstraint("colaboradores", "uq_colaboradores_correo");
    await queryInterface.removeConstraint("colaboradores", "uq_colaboradores_codigo");

    await queryInterface.changeColumn("colaboradores", "codigo", { type: Sequelize.STRING, allowNull: true });
    await queryInterface.changeColumn("colaboradores", "nombre", { type: Sequelize.STRING, allowNull: true });
    await queryInterface.changeColumn("colaboradores", "correo", { type: Sequelize.STRING, allowNull: true });
    await queryInterface.changeColumn("colaboradores", "departamento", { type: Sequelize.STRING, allowNull: true });
    await queryInterface.changeColumn("colaboradores", "puesto", { type: Sequelize.STRING, allowNull: true });
    await queryInterface.changeColumn("colaboradores", "fecha_ingreso", { type: Sequelize.DATE, allowNull: true });
    await queryInterface.changeColumn("colaboradores", "rol", { type: Sequelize.STRING, allowNull: true });
    await queryInterface.changeColumn("colaboradores", "estado", { type: Sequelize.STRING, allowNull: true });
    await queryInterface.changeColumn("saldos_vacaciones", "id_colaborador", {
      type: Sequelize.INTEGER, allowNull: true,
    });
    await queryInterface.changeColumn("saldos_vacaciones", "periodo", {
      type: Sequelize.INTEGER, allowNull: true,
    });
    for (const column of ["dias_asignados", "dias_tomados", "dias_disponibles"]) {
      await queryInterface.changeColumn("saldos_vacaciones", column, {
        type: Sequelize.DECIMAL(10, 0), allowNull: true,
      });
    }

    await queryInterface.renameColumn("colaboradores", "id_colaborador", "id");
    await queryInterface.renameColumn("saldos_vacaciones", "id_saldo", "id");
    await queryInterface.renameTable("colaboradores", legacyTables.colaboradores);
    await queryInterface.renameTable("saldos_vacaciones", legacyTables.saldos_vacaciones);
  },
};
