"use strict";

const departamentos = [
  {
    nombre: "Recursos Humanos",
    puesto: "Gerente de Recursos Humanos",
  },
  {
    nombre: "Estrategia",
    puesto: "Director de Estrategia",
  },
  {
    nombre: "Cuentas",
    puesto: "Coordinador de Cuentas",
  },
  {
    nombre: "Contenido",
    puesto: "Líder de Contenido",
  },
  {
    nombre: "Diseño",
    puesto: "Director de Diseño",
  },
  {
    nombre: "Publicidad Digital",
    puesto: "Líder de Publicidad Digital",
  },
  {
    nombre: "Redes Sociales",
    puesto: "Coordinador de Redes Sociales",
  },
  {
    nombre: "Producción Audiovisual",
    puesto: "Líder de Producción Audiovisual",
  },
  {
    nombre: "Investigación de Mercado",
    puesto: "Analista de Investigación",
  },
  {
    nombre: "Administración",
    puesto: "Coordinador Administrativo",
  },
];

function obtenerFechaIngreso(idColaborador) {
  if (idColaborador <= 10) {
    return "2026-09-01";
  }

  const inicio = Date.UTC(2026, 8, 1);
  const fin = Date.UTC(2026, 10, 17);
  const indice = idColaborador - 11;
  const totalIntervalos = 89;
  const fecha = new Date(
    inicio + Math.floor((indice * (fin - inicio)) / totalIntervalos),
  );

  return fecha.toISOString().slice(0, 10);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const [resultadoConteo] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS total FROM colaboradores",
        { transaction },
      );

      const totalExistente = Number(resultadoConteo[0].total);

      if (totalExistente > 0) {
        throw new Error(
          `La tabla colaboradores ya contiene ${totalExistente} registros. No se insertaron datos para evitar duplicados.`,
        );
      }

      const ahora = new Date();
      const colaboradores = [];

      for (let id = 1; id <= 100; id += 1) {
        const idJefe = id <= 10 ? null : ((id - 11) % 10) + 1;
        const departamento = departamentos[idJefe ? idJefe - 1 : id - 1];
        const codigo = `IC${String(id).padStart(3, "0")}`;

        colaboradores.push({
          id_colaborador: id,
          codigo,
          nombre: `Colaborador ${String(id).padStart(3, "0")}`,
          correo: `colaborador${String(id).padStart(3, "0")}@impulso.test`,
          departamento: departamento.nombre,
          puesto:
            id <= 10
              ? departamento.puesto
              : `Especialista ${departamento.nombre}`,
          fecha_ingreso: obtenerFechaIngreso(id),
          jefe_id: idJefe,
          rol: id === 1 || id === 11 ? "rrhh" : "colaborador",
          estado: "activo",
          createdAt: ahora,
          updatedAt: ahora,
        });
      }

      await queryInterface.bulkInsert("colaboradores", colaboradores, {
        transaction,
      });

      const [resultadoFinal] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS total FROM colaboradores",
        { transaction },
      );

      const totalFinal = Number(resultadoFinal[0].total);

      if (totalFinal !== 100) {
        throw new Error(
          `Se esperaban 100 colaboradores, pero la consulta obtuvo ${totalFinal}.`,
        );
      }

      await transaction.commit();
      console.log("Se insertaron 100 colaboradores simulados correctamente.");
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const codigos = Array.from({ length: 100 }, (_, indice) => {
        return `IC${String(indice + 1).padStart(3, "0")}`;
      });

      await queryInterface.bulkDelete(
        "colaboradores",
        {
          codigo: {
            [Sequelize.Op.in]: codigos,
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