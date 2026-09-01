import { get } from '@ember/object';
import { cancel, next } from '@ember/runloop';
import Service from '@ember/service';
import BootstrapFixes from 'ui/utils/bootstrap-fixes';

const ACTION_EVENT_NAMESPACE = '.resource-actions';

export default Service.extend({
  model          : null,
  open           : false,
  tooltipActions : null,
  actionToggle   : null,
  actionMenu     : null,
  actionParent   : null,
  actionTrigger  : null,
  showRequest    : 0,
  showTimer      : null,
  positionTimer  : null,

  show: function(model,trigger,toggle) {
    let $trigger = $(trigger);
    let currentTrigger = this.get('actionTrigger');
    let isCurrentTrigger = currentTrigger && currentTrigger[0] === $trigger[0];

    if (this.get('open') && model === this.get('model') && isCurrentTrigger) {
      this.hide();
      return;
    }

    this.hide();

    let request = this.incrementProperty('showRequest');
    let $parent = this.set('actionParent', $('#resource-actions-parent'));
    let $menu = this.set('actionMenu', $('#resource-actions'));
    let $toggle = this.set('actionToggle', $(toggle||trigger));
    this.set('actionTrigger', $trigger);
    this.set('model', model);

    let showTimer = next(() => {
      this.set('showTimer', null);
      if (!this.isCurrentRequest(request, model, $trigger[0])) {
        return;
      }

      // Bind the outside-click listener after the opening click has finished
      // bubbling.  Binding it synchronously makes the same click close the
      // global menu on some trigger/route render timings, which leaves the
      // shared menu with a null model until the user clicks repeatedly.
      $('BODY')
        .off(`click${ACTION_EVENT_NAMESPACE}`)
        .on(`click${ACTION_EVENT_NAMESPACE}`, (event) => {
          if (request !== this.get('showRequest')) {
            return;
          }

          let target = event.target;
          let insideCurrentMenu = $trigger.is(target) || $trigger.has(target).length ||
            $toggle.is(target) || $toggle.has(target).length ||
            $menu.is(target) || $menu.has(target).length;

          // Ember can flush `next()` before the native click finishes
          // bubbling to BODY.  Ignore that opening/switching click and clicks
          // inside the current menu; only a real outside click may close it.
          if (!insideCurrentMenu) {
            this.hide();
          }
        });

      $(window)
        .off(ACTION_EVENT_NAMESPACE)
        .one(`scroll${ACTION_EVENT_NAMESPACE} resize${ACTION_EVENT_NAMESPACE}`, () => {
          if (request === this.get('showRequest')) {
            this.hide();
          }
        });

      if (this.get('tooltipActions')) {
        $menu.addClass('tooltip-actions');
      } else if ($menu.hasClass('tooltip-actions')) {
        $menu.removeClass('tooltip-actions');
      }

      $menu.css('visibility','hidden');
      $menu.removeClass('hide');
      $toggle.addClass('open');
      $trigger.attr('aria-expanded', 'true');
      $parent.addClass('open');
      this.set('open',true);

      // Delay ensure it works in firefox
      let positionTimer = next(() => {
        this.set('positionTimer', null);
        if (!this.isCurrentRequest(request, model, $trigger[0])) {
          return;
        }

        BootstrapFixes.positionDropdown($menu, $trigger[0], true);
        let firstAction = $('#resource-actions-first')[0];
        if (firstAction) {
          firstAction.focus();
        }
        $menu.css('visibility','visible');
      });

      this.set('positionTimer', positionTimer);
    });

    this.set('showTimer', showTimer);
  },

  isCurrentRequest(request, model, trigger) {
    let currentTrigger = this.get('actionTrigger');

    return request === this.get('showRequest') &&
      model === this.get('model') &&
      currentTrigger &&
      currentTrigger[0] === trigger &&
      trigger &&
      trigger.isConnected;
  },

  hide() {
    this.incrementProperty('showRequest');

    let showTimer = this.get('showTimer');
    let positionTimer = this.get('positionTimer');
    if (showTimer) {
      cancel(showTimer);
    }
    if (positionTimer) {
      cancel(positionTimer);
    }

    $('BODY').off(`click${ACTION_EVENT_NAMESPACE}`);
    $(window).off(ACTION_EVENT_NAMESPACE);

    let $toggle = this.get('actionToggle');
    let $trigger = this.get('actionTrigger');
    let $parent = this.get('actionParent');
    let $menu = this.get('actionMenu');

    if ($toggle) {
      $toggle.removeClass('open');
    }
    if ($trigger) {
      $trigger.attr('aria-expanded', 'false');
    }
    if ($parent) {
      $parent.removeClass('open');
    }
    if ($menu) {
      $menu.addClass('hide').css('visibility','');
    }

    this.setProperties({
      actionToggle : null,
      actionTrigger: null,
      actionParent : null,
      actionMenu   : null,
      showTimer    : null,
      positionTimer: null,
      open         : false,
      model        : null,
    });
  },

  triggerAction: function(actionName) {
    this.get('model').send(actionName);
  },

  activeActions: function() {
    let list = (this.get('model.availableActions')||[]).filter(function(act) {
      return get(act,'enabled') !== false || get(act,'divider');
    });

    // Remove dividers at the beginning
    while ( list.get('firstObject.divider') === true )
    {
      list.shiftObject();
    }

    // Remove dividers at the end
    while ( list.get('lastObject.divider') === true )
    {
      list.popObject();
    }

    // Remove consecutive dividers
    let last = null;
    list = list.filter(function(act) {
      let cur = (act.divider === true);
      let ok = !cur || (cur && !last);
      last = cur;
      return ok;
    });

    return list;
  }.property('model.availableActions.[]','model.availableActions.@each.enabled', 'model'),
});
