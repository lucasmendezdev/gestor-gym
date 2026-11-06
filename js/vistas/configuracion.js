// Configuración (solo dueño): negocio, planes, descuentos, recargos, plantillas, equipo, medios de pago y categorías.
import { crear } from '../comun.js?v=10';
import { vistaPlanes } from './planes.js?v=10';
import { vistaListaSimple, CFG_MEDIOS, CFG_CATEGORIAS } from './lista_simple.js?v=10';
import { vistaNegocio } from './config_negocio.js?v=10';
import { vistaPlantillas } from './config_plantillas.js?v=10';
import { vistaDescuentos } from './config_descuentos.js?v=10';
import { vistaRecargos } from './config_recargos.js?v=10';
import { vistaEquipo } from './config_equipo.js?v=10';

const SUBVISTAS = {
  negocio: vistaNegocio, plantillas: vistaPlantillas, descuentos: vistaDescuentos, recargos: vistaRecargos, equipo: vistaEquipo,
};

export function vistaConfiguracion(contenedor, ctx, params) {
  if (params[0] === 'planes') return vistaPlanes(contenedor, ctx);
  if (params[0] === 'medios') return vistaListaSimple(contenedor, ctx, CFG_MEDIOS);
  if (params[0] === 'categorias') return vistaListaSimple(contenedor, ctx, CFG_CATEGORIAS);
  if (SUBVISTAS[params[0]]) return SUBVISTAS[params[0]](contenedor, ctx);
  const link = (id, href, t, d) => crear('a', { href, class: 'tarjeta enlace-tarjeta', id }, crear('strong', {}, t), crear('span', { class: 'suave' }, d));
  contenedor.replaceChildren(
    crear('div', { class: 'lista-config' },
      link('cfg-negocio', '#/configuracion/negocio', 'Datos del negocio', 'Nombre, zona horaria, prefijo de WhatsApp y días de aviso.'),
      link('cfg-planes', '#/configuracion/planes', 'Planes', 'Nombre, días por semana y precio de cada plan.'),
      link('cfg-descuentos', '#/configuracion/descuentos', 'Descuentos y paquetes', 'Descuentos de membresía y pago de varios meses adelantados.'),
      link('cfg-recargos', '#/configuracion/recargos', 'Recargos por mora', 'Qué porcentaje se suma según los días de atraso.'),
      link('cfg-plantillas', '#/configuracion/plantillas', 'Plantillas de aviso', 'El texto de los mensajes de WhatsApp.'),
      link('cfg-equipo', '#/configuracion/equipo', 'Equipo e invitaciones', 'Quién tiene acceso y códigos para sumar recepción.'),
      link('cfg-medios', '#/configuracion/medios', 'Medios de pago', 'Efectivo, transferencia, tarjetas…'),
      link('cfg-categorias', '#/configuracion/categorias', 'Categorías de gasto', 'Alquiler, servicios, sueldos…')));
}
