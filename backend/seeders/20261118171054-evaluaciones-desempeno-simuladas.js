"use strict";

function obtenerDiasHabiles() {
  const dias = [];
  const fecha = new Date(Date.UTC(2027, 2, 1));
  const fin = new Date(Date.UTC(2027, 3, 1));

  while (fecha < fin) {
    const diaSemana = fecha.getUTCDay();

    if (diaSemana !== 0 && diaSemana !== 6) {
      dias.push(fecha.toISOString().slice(0, 10));
    }

    fecha.setUTCDate(fecha.getUTCDate() + 1);
  }

  return dias;
}

module.exports = {
  async up(queryInterface) {
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

      const [existentes] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS total FROM evaluaciones_desempeno",
        { transaction },
      );

      if (Number(existentes[0].total) > 0) {
        throw new Error(
          "evaluaciones_desempeno ya contiene registros. No se insertaron duplicados.",
        );
      }

      const diasHabiles = obtenerDiasHabiles();

      const evaluaciones = colaboradores.map((colaborador, indice) => ({
        id_evaluacion: indice + 1,
        id_colaborador: colaborador.id_colaborador,
        fecha_programada:
          diasHabiles[
            Math.floor((indice * diasHabiles.length) / colaboradores.length)
          ],
        estado: "pendiente",
      }));

      await queryInterface.bulkInsert(
        "evaluaciones_desempeno",
        evaluaciones,
        { transaction },
      );

      const [resultado] = await queryInterface.sequelize.query(
        `SELECT
          COUNT(*) AS total,
          SUM(estado = 'pendiente') AS pendientes
         FROM evaluaciones_desempeno`,
        { transaction },
      );

      if (
        Number(resultado[0].total) !== 100 ||
        Number(resultado[0].pendientes) !== 100
      ) {
        throw new Error(
          `Se esperaban 100 evaluaciones pendientes; se encontraron ${resultado[0].total}.`,
        );
      }

      await transaction.commit();
      console.log(
        "Se insertaron 100 evaluaciones simuladas, programadas en días hábiles de marzo de 2027.",
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.bulkDelete(
        "evaluaciones_desempeno",
        {
          id_evaluacion: {
            [Sequelize.Op.between]: [1, 100],
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