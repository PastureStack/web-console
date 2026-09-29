import Service from '@ember/service';
import { service } from '@ember/service';
import Errors from 'ui/utils/errors';
import Util from 'ui/utils/util';

export default Service.extend({
  intl: service(),
  init: function() {
    this._super(...arguments);
    $.jGrowl.defaults.pool = 6;
    $.jGrowl.defaults.closeTemplate = '<i class="icon icon-x"></i>';
    $.jGrowl.defaults.closerTemplate = '<div><button type="button" class="btn btn-info btn-xs btn-block">Dismiss All Notifications</button></div>';
  },

  placeContainer(target) {
    let destination = target || document.getElementById('growl-mount') || document.body;
    let container = document.getElementById('jGrowl');

    if (container && container.parentNode !== destination) {
      destination.appendChild(container);
    }

    return destination;
  },

  raw: function(title, body, opt) {
    opt = opt || {};
    opt.appendTo = this.placeContainer();

    if ( title )
    {
      opt.header = title;
    }

    return $.jGrowl(Util.escapeHtml(body), opt);
  },

  success: function(title, body) {
    this.raw(title, body, {
      theme: 'success'
    });
  },

  message: function(title, body) {
    this.raw(title, body, {
      theme: 'message'
    });
  },

  error: function(title, body) {
    this.raw(title, body, {
      sticky: true,
      theme: 'error'
    });
  },

  fromError: function(title, err) {
    var status = Errors.status(err);
    // Growls also report deletes and resource actions, not just saves.
    // Keep denied/missing-resource details private without calling them saves.
    var body = status === 403 || status === 404 || status === 405 ?
      this.get('intl').t('resourceSaveError.actionUnavailable') :
      Errors.stringify(err, this.get('intl'));
    this.error(title,body);
  },
});
