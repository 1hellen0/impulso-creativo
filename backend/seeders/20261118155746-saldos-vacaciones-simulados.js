"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [colaboradores] = await queryInterface.sequelize.query(
        "SELECT id_colaborador FROM colaboradores ORDER BY id_colaborador",
        { transaction },
      );

      if (colaboradores.length !== 100) {
        throw new Error(
          `Se esperaban 100 colaboradores; se encontraron ${colaboradores.length}.`,
        );
      }

      const [saldosExistentes] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS total FROM saldos_vacaciones WHERE periodo = 2026",
        { transaction },
      );

      const totalExistente = Number(saldosExistentes[0].total);

      if (totalExistente > 0) {
        throw new Error(
          `Ya existen ${totalExistente} saldos para 2026. No se insertaron duplicados.`,
        );
      }

      const ahora = new Date();

      const saldos = colaboradores.map((colaborador, indice) => {
        const id = indice + 1;
        const diasAsignados = 2 + (id % 5) * 0.5;
        const diasTomados = Math.min((id % 4) * 0.5, diasAsignados);
        const diasDisponibles = diasAsignados - diasTomados;

        return {
          id_saldo: id,
          id_colaborador: colaborador.id_colaborador,
          periodo: 2026,
          dias_asignados: diasAsignados.toFixed(2),
          dias_tomados: diasTomados.toFixed(2),
          dias_disponibles: diasDisponibles.toFixed(2),
          createdAt: ahora,
          updatedAt: ahora,
        };
      });

      await queryInterface.bulkInsert("saldos_vacaciones", saldos, {
        transaction,
      });

      const [resultadoFinal] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS total FROM saldos_vacaciones WHERE periodo = 2026",
        { transaction },
      );

      const totalFinal = Number(resultadoFinal[0].total);

      if (totalFinal !== 100) {
        throw new Error(
          `Se esperaban 100 saldos, pero la consulta obtuvo ${totalFinal}.`,
        );
      }

      await transaction.commit();
      console.log(
        "Se insertaron 100 saldos de vacaciones simulados para 2026.",
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const ids = Array.from({ length: 100 }, (_, indice) => indice + 1);

      await queryInterface.bulkDelete(
        "saldos_vacaciones",
        {
          id_saldo: {
            [Sequelize.Op.in]: ids,
          },
          periodo: 2026,
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