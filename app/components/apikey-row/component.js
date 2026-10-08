import Component from '@ember/component';

export default Component.extend({
  model: null,
  auditSupported: false,
  tagName: 'TR',
  actions: {
    audit() { this.get('onAudit')(this.get('model')); },
  },
});
