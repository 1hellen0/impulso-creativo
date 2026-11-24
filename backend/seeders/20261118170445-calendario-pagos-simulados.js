"use strict";

const pagosSimulados = [
  {
    id_pago: 1,
    periodo_inicio: "2026-09-01",
    periodo_fin: "2026-09-15",
    fecha_pago: "2026-09-15",
  },
  {
    id_pago: 2,
    periodo_inicio: "2026-09-16",
    periodo_fin: "2026-09-30",
    fecha_pago: "2026-09-30",
  },
  {
    id_pago: 3,
    periodo_inicio: "2026-10-01",
    periodo_fin: "2026-10-15",
    fecha_pago: "2026-10-15",
  },
  {
    id_pago: 4,
    periodo_inicio: "2026-10-16",
    periodo_fin: "2026-10-31",
    fecha_pago: "2026-10-31",
  },
  {
    id_pago: 5,
    periodo_inicio: "2026-11-01",
    periodo_fin: "2026-11-15",
    fecha_pago: "2026-11-16",
  },
  {
    id_pago: 6,
    periodo_inicio: "2026-11-16",
    periodo_fin: "2026-11-30",
    fecha_pago: "2026-11-30",
  },
].map((pago) => ({
  ...pago,
  descripcion:
    "Pago quincenal simulado para pruebas; no es un calendario aprobado.",
}));

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [existentes] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS total FROM calendario_pagos",
        { transaction },
      );

      if (Number(existentes[0].total) > 0) {
        throw new Error(
          "calendario_pagos ya contiene registros. No se insertaron duplicados.",
        );
      }

      await queryInterface.bulkInsert("calendario_pagos", pagosSimulados, {
        transaction,
      });

      const [resultado] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS total FROM calendario_pagos",
        { transaction },
      );

      if (Number(resultado[0].total) !== 6) {
        throw new Error(
          `Se esperaban 6 fechas de pago; se encontraron ${resultado[0].total}.`,
        );
      }

      await transaction.commit();
      console.log("Se insertaron 6 fechas de pago simuladas.");
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.bulkDelete(
        "calendario_pagos",
        {
          id_pago: {
            [Sequelize.Op.between]: [1, 6],
          },
        },
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};