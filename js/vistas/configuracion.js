// Configuración (solo dueño). Hasta ahora: Planes, Medios de pago y Categorías de gasto.
import { crear } from '../comun.js?v=9';
import { vistaPlanes } from './planes.js?v=9';
import { vistaListaSimple, CFG_MEDIOS, CFG_CATEGORIAS } from './lista_simple.js?v=9';

export function vistaConfiguracion(contenedor, ctx, params) {
  if (params[0] === 'planes') return vistaPlanes(contenedor, ctx);
  if (params[0] === 'medios') return vistaListaSimple(contenedor, ctx, CFG_MEDIOS);
  if (params[0] === 'categorias') return vistaListaSimple(contenedor, ctx, CFG_CATEGORIAS);
  const pendientes = ['Descuentos y paquetes', 'Recargos por mora', 'Plantillas de aviso', 'Equipo e invitaciones'];
  const link = (id, href, t, d) => crear('a', { href, class: 'tarjeta enlace-tarjeta', id }, crear('strong', {}, t), crear('span', { class: 'suave' }, d));
  contenedor.replaceChildren(
    crear('div', { class: 'lista-config' },
      link('cfg-planes', '#/configuracion/planes', 'Planes', 'Nombre, días por semana y precio de cada plan.'),
      link('cfg-medios', '#/configuracion/medios', 'Medios de pago', 'Efectivo, transferencia, tarjetas…'),
      link('cfg-categorias', '#/configuracion/categorias', 'Categorías de gasto', 'Alquiler, servicios, sueldos…'),
      ...pendientes.map((t) => crear('div', { class: 'tarjeta deshabilitada' }, crear('strong', {}, t), crear('span', { class: 'suave' }, 'Llega en la Etapa 9.')))));
}
