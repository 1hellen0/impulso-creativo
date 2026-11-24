"use strict";

const incapacidadesSimuladas = [
  { id_colaborador: 51, tipo: "enfermedad_comun", fecha_inicio: "2026-09-05", dias: 2, entidad: "CCSS" },
  { id_colaborador: 52, tipo: "enfermedad_comun", fecha_inicio: "2026-09-19", dias: 1, entidad: "CCSS" },
  { id_colaborador: 53, tipo: "otro", fecha_inicio: "2026-09-30", dias: 1, entidad: "CCSS" },
  { id_colaborador: 54, tipo: "enfermedad_comun", fecha_inicio: "2026-10-03", dias: 3, entidad: "CCSS" },
  { id_colaborador: 55, tipo: "riesgo_trabajo", fecha_inicio: "2026-10-15", dias: 2, entidad: "INS" },
  { id_colaborador: 56, tipo: "enfermedad_comun", fecha_inicio: "2026-10-26", dias: 4, entidad: "CCSS" },
  { id_colaborador: 57, tipo: "enfermedad_comun", fecha_inicio: "2026-11-04", dias: 2, entidad: "CCSS" },
  { id_colaborador: 58, tipo: "otro", fecha_inicio: "2026-11-09", dias: 1, entidad: "CCSS" },
  { id_colaborador: 59, tipo: "enfermedad_comun", fecha_inicio: "2026-11-12", dias: 3, entidad: "CCSS" },
  { id_colaborador: 60, tipo: "enfermedad_comun", fecha_inicio: "2026-11-15", dias: 5, entidad: "CCSS" },
  { id_colaborador: 61, tipo: "enfermedad_comun", fecha_inicio: "2026-11-17", dias: 3, entidad: "CCSS" },
  { id_colaborador: 62, tipo: "riesgo_trabajo", fecha_inicio: "2026-11-18", dias: 2, entidad: "INS" },
].map((registro, indice) => ({
  id_incapacidad: indice + 1,
  ...registro,
  observacion_administrativa:
    "Registro académico simulado; no contiene información clínica.",
}));

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [existentes] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS total FROM incapacidades",
        { transaction },
      );

      if (Number(existentes[0].total) > 0) {
        throw new Error(
          "La tabla incapacidades ya contiene registros. No se insertaron duplicados.",
        );
      }

      const [colaboradores] = await queryInterface.sequelize.query(
        "SELECT id_colaborador FROM colaboradores WHERE id_colaborador BETWEEN 51 AND 62",
        { transaction },
      );

      if (colaboradores.length !== 12) {
        throw new Error(
          `Se esperaban los colaboradores 51 a 62; se encontraron ${colaboradores.length}.`,
        );
      }

      await queryInterface.bulkInsert(
        "incapacidades",
        incapacidadesSimuladas,
        { transaction },
      );

      const [resultado] = await queryInterface.sequelize.query(
        `SELECT
          COUNT(*) AS total,
          COUNT(DISTINCT DATE_FORMAT(fecha_inicio, '%Y-%m')) AS meses
         FROM incapacidades`,
        { transaction },
      );

      if (
        Number(resultado[0].total) !== 12 ||
        Number(resultado[0].meses) !== 3
      ) {
        throw new Error(
          `La verificación esperaba 12 registros en 3 meses; obtuvo ${resultado[0].total} en ${resultado[0].meses} meses.`,
        );
      }

      await transaction.commit();
      console.log(
        "Se insertaron 12 incapacidades simuladas, distribuidas en tres meses.",
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
        "incapacidades",
        {
          id_incapacidad: {
            [Sequelize.Op.between]: [1, 12],
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