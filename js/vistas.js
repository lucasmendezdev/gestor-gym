// vistas.js · qué se muestra en cada sección.
// Cada etapa reemplaza una "vistaPendiente" por la pantalla real.
import { crear } from './comun.js?v=6';
import { vistaInicio } from './vistas/inicio.js?v=6';
import { vistaSocios } from './vistas/socios.js?v=6';
import { vistaCaja } from './vistas/caja.js?v=6';
import { vistaConfiguracion } from './vistas/configuracion.js?v=6';

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
  cobrar: vistaPendiente(6, 'Cobro de cuotas con descuentos, recargo y recibo.'),
  asistencia: vistaPendiente(7, 'Registro de entradas y salidas, y quién está adentro.'),
  caja: vistaCaja,
  avisos: vistaPendiente(8, 'Avisos por WhatsApp de vencimiento y mora.'),
  reportes: vistaPendiente(9, 'Ingresos, gastos, morosidad, asistencia, socios y cajas.'),
  configuracion: vistaConfiguracion,
};
