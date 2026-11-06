// vistas.js · qué se muestra en cada sección.
// Cada etapa reemplaza una "vistaPendiente" por la pantalla real.
import { crear } from './comun.js?v=7';
import { vistaInicio } from './vistas/inicio.js?v=7';
import { vistaSocios } from './vistas/socios.js?v=7';
import { vistaCobrar } from './vistas/cobrar.js?v=7';
import { vistaCaja } from './vistas/caja.js?v=7';
import { vistaConfiguracion } from './vistas/configuracion.js?v=7';

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
  asistencia: vistaPendiente(7, 'Registro de entradas y salidas, y quién está adentro.'),
  caja: vistaCaja,
  avisos: vistaPendiente(8, 'Avisos por WhatsApp de vencimiento y mora.'),
  reportes: vistaPendiente(9, 'Ingresos, gastos, morosidad, asistencia, socios y cajas.'),
  configuracion: vistaConfiguracion,
};
