"use strict";

function agregarDias(fecha, cantidad) {
  const resultado = new Date(`${fecha}T00:00:00Z`);
  resultado.setUTCDate(resultado.getUTCDate() + cantidad);
  return resultado.toISOString().slice(0, 10);
}

function fechaDistribuida(inicio, fin, indice, total) {
  const inicioMs = Date.parse(`${inicio}T00:00:00Z`);
  const finMs = Date.parse(`${fin}T00:00:00Z`);
  const proporcion = total <= 1 ? 0 : indice / (total - 1);
  const resultado = new Date(inicioMs + (finMs - inicioMs) * proporcion);

  return resultado.toISOString().slice(0, 10);
}

function crearSolicitud({
  idColaborador,
  tipo,
  estado,
  idAprobador,
  fechaCreacion,
  fechaInicio,
  duracion,
}) {
  return {
    id_colaborador: idColaborador,
    tipo,
    fecha_inicio: fechaInicio,
    fecha_fin: agregarDias(fechaInicio, duracion - 1),
    estado,
    id_aprobador: idAprobador,
    creada_en: `${fechaCreacion} 09:00:00`,
  };
}

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [colaboradores] = await queryInterface.sequelize.query(
        `SELECT id_colaborador
         FROM colaboradores
         WHERE id_colaborador BETWEEN 11 AND 50
         ORDER BY id_colaborador`,
        { transaction },
      );

      if (colaboradores.length !== 40) {
        throw new Error(
          `Se esperaban 40 colaboradores para las solicitudes; se encontraron ${colaboradores.length}.`,
        );
      }

      const [conteoExistente] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS total FROM solicitudes",
        { transaction },
      );

      if (Number(conteoExistente[0].total) > 0) {
        throw new Error(
          "La tabla solicitudes ya contiene registros. No se insertaron duplicados.",
        );
      }

      const solicitudes = [];
      const tipos = ["vacaciones", "permiso", "licencia"];

      // 24 aprobadas; tres cubren fechas cercanas al 18 de noviembre.
      for (let i = 0; i < 24; i += 1) {
        const fechaCreacion = fechaDistribuida(
          "2026-09-01",
          "2026-10-30",
          i,
          24,
        );

        const fechaInicio =
          i === 0
            ? "2026-11-17"
            : i <= 2
              ? "2026-11-18"
              : agregarDias(fechaCreacion, 7 + (i % 7));

        const tipo = tipos[i % tipos.length];
        const duracion = tipo === "vacaciones" ? 3 : tipo === "permiso" ? 1 : 2;

        solicitudes.push(
          crearSolicitud({
            idColaborador: colaboradores[i].id_colaborador,
            tipo,
            estado: "aprobada",
            idAprobador: 1,
            fechaCreacion,
            fechaInicio,
            duracion,
          }),
        );
      }

      // 8 pendientes: seis con más de tres días y dos recientes.
      for (let i = 0; i < 8; i += 1) {
        const fechaCreacion =
          i < 6
            ? agregarDias("2026-11-03", i)
            : i === 6
              ? "2026-11-16"
              : "2026-11-17";

        solicitudes.push(
          crearSolicitud({
            idColaborador: colaboradores[24 + i].id_colaborador,
            tipo: tipos[i % tipos.length],
            estado: "pendiente",
            idAprobador: null,
            fechaCreacion,
            fechaInicio: agregarDias("2026-11-20", i),
            duracion: 1 + (i % 2),
          }),
        );
      }

      // 5 rechazadas y 3 canceladas para completar los estados de prueba.
      for (let i = 0; i < 8; i += 1) {
        const esRechazada = i < 5;
        const indiceTipo = i % tipos.length;
        const fechaCreacion = esRechazada
          ? fechaDistribuida("2026-10-01", "2026-11-12", i, 5)
          : fechaDistribuida("2026-09-15", "2026-11-10", i - 5, 3);

        solicitudes.push(
          crearSolicitud({
            idColaborador: colaboradores[32 + i].id_colaborador,
            tipo: tipos[indiceTipo],
            estado: esRechazada ? "rechazada" : "cancelada",
            idAprobador: 1,
            fechaCreacion,
            fechaInicio: agregarDias(fechaCreacion, 7),
            duracion: 1 + (i % 2),
          }),
        );
      }

      const filas = solicitudes.map((solicitud, indice) => ({
        id_solicitud: indice + 1,
        ...solicitud,
      }));

      await queryInterface.bulkInsert("solicitudes", filas, { transaction });

      const [resultado] = await queryInterface.sequelize.query(
        `SELECT
          COUNT(*) AS total,
          SUM(estado = 'pendiente') AS pendientes,
          COUNT(DISTINCT DATE_FORMAT(creada_en, '%Y-%m')) AS meses
         FROM solicitudes`,
        { transaction },
      );

      const resumen = resultado[0];

      if (
        Number(resumen.total) !== 40 ||
        Number(resumen.pendientes) !== 8 ||
        Number(resumen.meses) !== 3
      ) {
        throw new Error(
          `Verificación inesperada: ${resumen.total} solicitudes, ${resumen.pendientes} pendientes y ${resumen.meses} meses.`,
        );
      }

      await transaction.commit();

      console.log(
        "Se insertaron 40 solicitudes simuladas: 24 aprobadas, 8 pendientes, 5 rechazadas y 3 canceladas.",
      );
      console.log(
        "Las solicitudes abarcan septiembre, octubre y noviembre de 2026.",
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
        "solicitudes",
        {
          id_solicitud: {
            [Sequelize.Op.between]: [1, 40],
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