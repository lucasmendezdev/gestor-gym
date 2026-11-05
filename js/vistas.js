// vistas.js · qué se muestra en cada sección.
// Cada etapa reemplaza una "vistaPendiente" por la pantalla real.
import { crear } from './comun.js?v=3';
import { vistaInicio } from './vistas/inicio.js?v=3';
import { vistaSocios } from './vistas/socios.js?v=3';

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
  cobrar: vistaPendiente(4, 'Cobro de cuotas con descuentos, recargo y recibo.'),
  asistencia: vistaPendiente(6, 'Registro de entradas y salidas, y quién está adentro.'),
  caja: vistaPendiente(5, 'Apertura y cierre de caja, ingresos, retiros y gastos.'),
  avisos: vistaPendiente(7, 'Avisos por WhatsApp de vencimiento y mora.'),
  reportes: vistaPendiente(8, 'Ingresos, gastos, morosidad, asistencia, socios y cajas.'),
  configuracion: vistaPendiente(8, 'Negocio, planes, descuentos, medios de pago, recargos, plantillas y equipo.'),
};
