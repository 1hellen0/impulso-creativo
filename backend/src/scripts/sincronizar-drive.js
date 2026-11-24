"use strict";

require("dotenv").config();

const { sincronizarDrive } = require("../rag/sincronizacion");

sincronizarDrive()
  .then((resultado) => {
    console.log(`Sincronización ${resultado.modo} completada: ${resultado.archivosIndexados} archivos indexados, ${resultado.fragmentosIndexados} fragmentos y ${resultado.archivosEliminados} archivos retirados.`);
    if (resultado.protegidosSinPropiedad) {
      console.log(`Se conservaron ${resultado.protegidosSinPropiedad} archivos sin propiedad verificada.`);
    }
  })
  .catch((error) => {
    console.error("La sincronización de Google Drive no pudo completarse.");
    console.error(error.message);
    process.exitCode = 1;
  });
