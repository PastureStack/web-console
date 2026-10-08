import Component from '@ember/component';
import { service } from '@ember/service';

export default Component.extend({
  store: service(),
  userStore: service('user-store'),
  candidates: null,
  loadError: false,
  loading: false,

  didReceiveAttrs() {
    this._super(...arguments);
    let type = this.get('scope.kind') === 'resource' ? this.get('scope.resourceType') : this.get('scope.kind');
    if ( type === this._loadedType ) { return; }
    this._loadedType = type;
    let generation = this._loadGeneration = (this._loadGeneration || 0) + 1;
    this.setProperties({candidates: [], loadError: false, loading: false});
    if ( !type || type === 'global' || !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(type) ) { return; }
    let store = type === 'project' || !this.get('store').getById('schema', type) ? this.get('userStore') : this.get('store');
    if ( !store.getById('schema', type) ) { this.set('loadError', true); return; }
    this.set('loading', true);
    store.findAll(type, null, {forceReload: true, removeMissing: true}).then((items) => {
      if ( generation !== this._loadGeneration || this.isDestroyed || this.isDestroying ) { return; }
      this.set('candidates', items.map((item) => ({id: item.get('id'), name: item.get('displayName') || item.get('name') || item.get('id')})));
    }).catch(() => {
      if ( generation === this._loadGeneration && !this.isDestroyed && !this.isDestroying ) {
        this.setProperties({candidates: [], loadError: true});
      }
    }).finally(() => {
      if ( generation === this._loadGeneration && !this.isDestroyed && !this.isDestroying ) { this.set('loading', false); }
    });
  },

  actions: {
    select(event) { this.get('onSelect')(event); },
  },
});
