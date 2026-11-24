"use strict";

module.exports = (sequelize, DataTypes) => {
  const Colaborador = sequelize.define(
    "Colaborador",
    {
      id_colaborador: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      codigo: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
      nombre: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      correo: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      departamento: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      puesto: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      fecha_ingreso: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      jefe_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      rol: {
        type: DataTypes.ENUM("colaborador", "rrhh"),
        allowNull: false,
        defaultValue: "colaborador",
      },
      estado: {
        type: DataTypes.ENUM("activo", "inactivo", "licencia"),
        allowNull: false,
        defaultValue: "activo",
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "colaboradores",
      timestamps: false,
    },
  );

  Colaborador.associate = (models) => {
    Colaborador.belongsTo(models.Colaborador, {
      foreignKey: "jefe_id",
      as: "jefe",
    });

    Colaborador.hasMany(models.Colaborador, {
      foreignKey: "jefe_id",
      as: "subordinados",
    });
  };

  return Colaborador;
};
