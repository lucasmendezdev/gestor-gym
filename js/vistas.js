// vistas.js · qué se muestra en cada sección.
// Cada etapa reemplaza una "vistaPendiente" por la pantalla real.
import { crear } from './comun.js?v=13';
import { vistaInicio } from './vistas/inicio.js?v=13';
import { vistaSocios } from './vistas/socios.js?v=13';
import { vistaAsistencia } from './vistas/asistencia.js?v=13';
import { vistaCobrar } from './vistas/cobrar.js?v=13';
import { vistaCaja } from './vistas/caja.js?v=13';
import { vistaReportes } from './vistas/reportes.js?v=13';
import { vistaAvisos } from './vistas/avisos.js?v=13';
import { vistaConfiguracion } from './vistas/configuracion.js?v=13';

export function vistaPendiente(etapa, descripcion) {
  return (contenedor) => {
    contenedor.replaceChildren(
      crear('div', { class: 'tarjeta vacia' },
        crear('h2', {}, 'Esta pantalla se construye en la Etapa ' + etapa),
        crear('p', {}, descripcion)),
    );
  };
}

export const VISTAS = {
  inicio: vistaInicio,
  socios: vistaSocios,
  cobrar: vistaCobrar,
  asistencia: vistaAsistencia,
  caja: vistaCaja,
  avisos: vistaAvisos,
  reportes: vistaReportes,
  configuracion: vistaConfiguracion,
};
