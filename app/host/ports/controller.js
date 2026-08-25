import { alias } from '@ember/object/computed';
import Controller from '@ember/controller';
import Sortable from 'ui/mixins/sortable';

export default Controller.extend(Sortable, {
  sortableContent: alias('model.displayEndpoints'),
  sortBy: 'ip',
  sorts: {
    ip:       ['ipAddress','port'],
    port:     ['port','ipAddress','instanceId'],
    service:  ['service.displayName','port','ipAddress'],
    container: ['instance.displayName','port','ipAddress'],
  },
});
