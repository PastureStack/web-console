import EmberObject from '@ember/object';
import Route from '@ember/routing/route';
import { service } from '@ember/service';
import { refreshUnallocatedVolumeRelations } from 'ui/utils/unallocated-volumes';

export default Route.extend({
  projects: service(),
  intl: service(),

  model: function() {
    let store = this.get('store');
    let volumes = store.all('volume');
    return refreshUnallocatedVolumeRelations(volumes, this.get('projects.current.id'),
      this.get('intl').t('storagePoolsPage.unallocated.relationIncomplete')).then(() => {
      return EmberObject.create({
        all: this.modelFor('storagepools'),
        volumes,
        mounts: store.all('mount'),
      });
    });
  },
});
