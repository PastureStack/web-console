import Ember from 'ember';
import { clampWorkspaceGeometry } from 'ui/utils/console-workspace';

export default Ember.Component.extend({
  classNames: ['console-workspace-window'],
  attributeBindings: ['style', 'role', 'ariaLabel:aria-label'],
  role: 'dialog',
  workspace: Ember.inject.service('console-workspace'),
  intl: Ember.inject.service(),
  entry: null,
  instanceLoaded: false,
  loadError: null,

  ariaLabel: Ember.computed.alias('entry.resourceTitle'),

  style: function() {
    let entry = this.get('entry');
    let value = [
      'position:fixed',
      `left:${Math.round(entry.get('x') || 0)}px`,
      `top:${Math.round(entry.get('y') || 46)}px`,
      `width:${Math.round(entry.get('width') || 720)}px`,
      `height:${Math.round(entry.get('height') || 480)}px`,
      `z-index:${entry.get('z') || 1000}`,
    ].join(';');
    return Ember.String.htmlSafe(value);
  }.property('entry.{x,y,width,height,z}'),

  didInsertElement() {
    this._super(...arguments);
    this.get('workspace').focusWindow(this.get('entry'));
    this.get('workspace').loadInstance(this.get('entry')).then(() => {
      if (!this.isDestroyed && !this.isDestroying) {
        this.set('instanceLoaded', true);
      }
    }).catch((err) => {
      if (!this.isDestroyed && !this.isDestroying) {
        this.setProperties({
          instanceLoaded: false,
          loadError: err,
        });
      }
    });
  },

  willDestroyElement() {
    this.stopPointerTracking();
    this._super(...arguments);
  },

  mouseDown() {
    this.get('workspace').focusWindow(this.get('entry'));
  },

  actions: {
    minimize() {
      this.get('workspace').minimizeWindow(this.get('entry'));
    },

    close() {
      this.get('workspace').closeWindow(this.get('entry'));
    },

    toggleMaximize() {
      this.get('workspace').toggleMaximize(this.get('entry'));
    },

    titlebarDoubleClick(event) {
      if (!Ember.$(event.target).closest('button').length) {
        this.get('workspace').toggleMaximize(this.get('entry'));
      }
    },

    terminate() {
      let message = this.get('intl').t('consoleWorkspace.session.confirmTerminate');
      if (window.confirm(message)) {
        this.get('workspace').terminateSession(this.get('entry'));
      }
    },

    vmStateChanged(state) {
      let status = 'connecting';
      if (state === 'normal') {
        status = 'connected';
      } else if (state === 'disconnected') {
        status = 'disconnected';
      } else if (state === 'failed' || state === 'fatal') {
        status = 'error';
      }
      this.get('workspace').updateSession(this.get('entry'), {status});
    },

    startDrag(event) {
      if (Ember.$(event.target).closest('button').length) {
        return;
      }
      event.preventDefault();
      let entry = this.get('entry');
      if (entry.get('maximized')) {
        return;
      }
      this.startPointerTracking('drag', event);
    },

    startResize(event) {
      event.preventDefault();
      event.stopPropagation();
      let entry = this.get('entry');
      if (entry.get('maximized')) {
        return;
      }
      this.startPointerTracking('resize', event);
    },
  },

  startPointerTracking(mode, event) {
    this.stopPointerTracking();
    let entry = this.get('entry');
    this._pointerState = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      x: entry.get('x'),
      y: entry.get('y'),
      width: entry.get('width'),
      height: entry.get('height'),
    };

    let namespace = `.consoleWorkspaceWindow-${entry.get('sessionId')}`;
    this._pointerNamespace = namespace;
    Ember.$(document)
      .on(`mousemove${namespace}`, (moveEvent) => this.trackPointer(moveEvent))
      .on(`mouseup${namespace}`, () => this.finishPointerTracking());
    Ember.$('body').addClass('console-workspace-pointer-active');
  },

  trackPointer(event) {
    let state = this._pointerState;
    if (!state) {
      return;
    }
    let dx = event.clientX - state.startX;
    let dy = event.clientY - state.startY;
    let geometry;

    if (state.mode === 'drag') {
      geometry = {
        x: state.x + dx,
        y: state.y + dy,
        width: state.width,
        height: state.height,
      };
    } else {
      geometry = {
        x: state.x,
        y: state.y,
        width: state.width + dx,
        height: state.height + dy,
      };
    }

    geometry = clampWorkspaceGeometry(geometry, window.innerWidth, window.innerHeight);
    this.get('entry').setProperties(geometry);
    if (state.mode === 'resize') {
      Ember.$(window).trigger('resize');
    }
  },

  finishPointerTracking() {
    if (this._pointerState) {
      this.get('workspace').saveLayouts();
      Ember.$(window).trigger('resize');
    }
    this.stopPointerTracking();
  },

  stopPointerTracking() {
    if (this._pointerNamespace) {
      Ember.$(document).off(this._pointerNamespace);
    }
    Ember.$('body').removeClass('console-workspace-pointer-active');
    this._pointerNamespace = null;
    this._pointerState = null;
  },
});
