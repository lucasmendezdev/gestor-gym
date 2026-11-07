// Configuración (solo dueño): negocio, planes, descuentos, recargos, plantillas, equipo, medios de pago y categorías.
import { crear } from '../comun.js?v=17';
import { vistaPlanes } from './planes.js?v=17';
import { vistaListaSimple, CFG_MEDIOS, CFG_CATEGORIAS } from './lista_simple.js?v=17';
import { vistaNegocio } from './config_negocio.js?v=17';
import { vistaPlantillas } from './config_plantillas.js?v=17';
import { vistaDescuentos } from './config_descuentos.js?v=17';
import { vistaRecargos } from './config_recargos.js?v=17';
import { vistaEquipo } from './config_equipo.js?v=17';

const SUBVISTAS = {
  negocio: vistaNegocio, plantillas: vistaPlantillas, descuentos: vistaDescuentos, recargos: vistaRecargos, equipo: vistaEquipo,
};

const SOLO_FULL = ['descuentos', 'recargos', 'plantillas'];

export function vistaConfiguracion(contenedor, ctx, params) {
  const base = ctx.edicion === 'base';
  if (base && SOLO_FULL.includes(params[0])) {
    contenedor.replaceChildren(crear('div', { class: 'tarjeta vacia', id: 'solo-full' },
      crear('h2', {}, 'Función del Plan Full'),
      crear('p', {}, 'Esta pantalla no está incluida en el Plan Base.'),
      crear('a', { href: '#/configuracion', class: 'boton secundario' }, 'Volver a Configuración')));
    return;
  }
  if (params[0] === 'planes') return vistaPlanes(contenedor, ctx);
  if (params[0] === 'medios') return vistaListaSimple(contenedor, ctx, CFG_MEDIOS);
  if (params[0] === 'categorias') return vistaListaSimple(contenedor, ctx, CFG_CATEGORIAS);
  if (SUBVISTAS[params[0]]) return SUBVISTAS[params[0]](contenedor, ctx);
  const link = (id, href, t, d) => crear('a', { href, class: 'tarjeta enlace-tarjeta', id }, crear('strong', {}, t), crear('span', { class: 'suave' }, d));
  contenedor.replaceChildren(...[
    base ? crear('p', { class: 'suave', id: 'nota-base' }, 'Plan Base: descuentos, recargos, plantillas editables, reportes, avisos de vencimiento y mora, y más de un usuario de recepción son del Plan Full.') : null,
    crear('div', { class: 'lista-config' },
      link('cfg-negocio', '#/configuracion/negocio', 'Datos del negocio', 'Nombre, zona horaria, prefijo de WhatsApp y días de aviso.'),
      link('cfg-planes', '#/configuracion/planes', 'Planes', 'Nombre, días por semana y precio de cada plan.'),
      base ? null : link('cfg-descuentos', '#/configuracion/descuentos', 'Descuentos y paquetes', 'Descuentos de membresía y pago de varios meses adelantados.'),
      base ? null : link('cfg-recargos', '#/configuracion/recargos', 'Recargos por mora', 'Qué porcentaje se suma según los días de atraso.'),
      base ? null : link('cfg-plantillas', '#/configuracion/plantillas', 'Plantillas de aviso', 'El texto de los mensajes de WhatsApp.'),
      link('cfg-equipo', '#/configuracion/equipo', base ? 'Usuario de recepción' : 'Equipo e invitaciones', base ? 'La persona de recepción: código de acceso, desactivar o reactivar.' : 'Quién tiene acceso y códigos para sumar recepción.'),
      link('cfg-medios', '#/configuracion/medios', 'Medios de pago', 'Efectivo, transferencia, tarjetas…'),
      link('cfg-categorias', '#/configuracion/categorias', 'Categorías de gasto', 'Alquiler, servicios, sueldos…'))].filter(Boolean));
}
