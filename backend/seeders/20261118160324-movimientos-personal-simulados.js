"use strict";

const MOTIVO_SIMULADO = "SIMULADO_DIA_2: ingreso inicial";

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [colaboradores] = await queryInterface.sequelize.query(
        "SELECT id_colaborador, fecha_ingreso FROM colaboradores ORDER BY id_colaborador",
        { transaction },
      );

      if (colaboradores.length !== 100) {
        throw new Error(
          `Se esperaban 100 colaboradores; se encontraron ${colaboradores.length}.`,
        );
      }

      const [movimientosExistentes] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS total FROM movimientos_personal",
        { transaction },
      );

      if (Number(movimientosExistentes[0].total) > 0) {
        throw new Error(
          "La tabla movimientos_personal ya contiene registros. No se insertaron duplicados.",
        );
      }

      const movimientos = colaboradores.map((colaborador) => ({
        id_colaborador: colaborador.id_colaborador,
        tipo: "ingreso",
        fecha: colaborador.fecha_ingreso,
        motivo: MOTIVO_SIMULADO,
      }));

      await queryInterface.bulkInsert("movimientos_personal", movimientos, {
        transaction,
      });

      const [resultado] = await queryInterface.sequelize.query(
        `SELECT
          COUNT(*) AS total,
          COUNT(DISTINCT DATE_FORMAT(fecha, '%Y-%m')) AS meses,
          MIN(fecha) AS primera_fecha,
          MAX(fecha) AS ultima_fecha
        FROM movimientos_personal
        WHERE motivo = '${MOTIVO_SIMULADO}'`,
        { transaction },
      );

      const resumen = resultado[0];

      if (Number(resumen.total) !== 100 || Number(resumen.meses) !== 3) {
        throw new Error(
          `La verificación esperaba 100 movimientos en 3 meses; obtuvo ${resumen.total} movimientos en ${resumen.meses} meses.`,
        );
      }

      await transaction.commit();

      console.log(
        `Se insertaron ${resumen.total} movimientos de ingreso simulados entre ${resumen.primera_fecha} y ${resumen.ultima_fecha}, distribuidos en ${resumen.meses} meses.`,
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.bulkDelete(
        "movimientos_personal",
        { motivo: MOTIVO_SIMULADO },
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};