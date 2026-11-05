// Configuración (solo dueño). Etapa 3A: solo Planes; el resto llega en la Etapa 8.
import { crear } from '../comun.js?v=4';
import { vistaPlanes } from './planes.js?v=4';

export function vistaConfiguracion(contenedor, ctx, params) {
  if (params[0] === 'planes') return vistaPlanes(contenedor, ctx);
  const pendientes = ['Descuentos y paquetes', 'Medios de pago', 'Categorías de gasto', 'Recargos por mora', 'Plantillas de aviso', 'Equipo e invitaciones'];
  contenedor.replaceChildren(
    crear('div', { class: 'lista-config' },
      crear('a', { href: '#/configuracion/planes', class: 'tarjeta enlace-tarjeta', id: 'cfg-planes' },
        crear('strong', {}, 'Planes'), crear('span', { class: 'suave' }, 'Nombre, días por semana y precio de cada plan.')),
      ...pendientes.map((t) => crear('div', { class: 'tarjeta deshabilitada' }, crear('strong', {}, t), crear('span', { class: 'suave' }, 'Llega en la Etapa 8.')))));
}
