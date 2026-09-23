import EmberObject from '@ember/object';
import { A } from '@ember/array';
import { reject } from 'rsvp';
import { run } from '@ember/runloop';
import { module, test } from 'qunit';
import ProjectsService from 'ui/services/projects';
import C from 'ui/utils/constants';

module('Unit | Service | projects');

test('no active environment is a valid empty selection', async function(assert) {
  let tabSession = EmberObject.create({[C.TABSESSION.PROJECT]: 'stale-tab-project'});
  let prefs = EmberObject.create({[C.PREFS.PROJECT_DEFAULT]: 'stale-preference-project'});
  let store = EmberObject.create({baseUrl: '/v2-beta/projects/stale'});
  let service = ProjectsService.create({
    access: EmberObject.create({admin: false}),
    all: A([]),
    app: EmberObject.create({apiEndpoint: '/v2-beta'}),
    prefs,
    store,
    'tab-session': tabSession,
  });

  service._activeProjectFromId = () => reject({status: 404});

  let selected = await service.selectDefault('missing-direct-project');

  assert.strictEqual(selected, null, 'selection resolves to the intentional empty state');
  assert.strictEqual(service.get('current'), null, 'there is no current environment');
  assert.strictEqual(tabSession.get(C.TABSESSION.PROJECT), undefined, 'the stale tab selection is cleared');
  assert.strictEqual(store.get('baseUrl'), '/v2-beta', 'the resource store returns to the global API root');
  assert.strictEqual(prefs.get(C.PREFS.PROJECT_DEFAULT), 'stale-preference-project',
    'the preference is not rewritten without a replacement environment');

  run(() => service.destroy());
});

test('refreshAll waits for reselection and clears a revoked current environment', async function(assert) {
  let tabSession = EmberObject.create({[C.TABSESSION.PROJECT]: 'revoked-project'});
  let store = EmberObject.create({baseUrl: '/v2-beta/projects/revoked-project'});
  let service = ProjectsService.create({
    access: EmberObject.create({admin: false}),
    app: EmberObject.create({apiEndpoint: '/v2-beta'}),
    prefs: EmberObject.create(),
    store,
    'tab-session': tabSession,
  });

  service.getAll = () => Promise.resolve(A([]));
  service._activeProjectFromId = () => reject({status: 404});

  let selected = await service.refreshAll();

  assert.strictEqual(selected, null, 'refresh resolves only after the empty selection is committed');
  assert.strictEqual(service.get('current'), null, 'the revoked environment is no longer current');
  assert.strictEqual(tabSession.get(C.TABSESSION.PROJECT), undefined, 'the revoked tab selection is cleared');
  assert.strictEqual(store.get('baseUrl'), '/v2-beta', 'project-scoped requests cannot reuse the revoked API root');

  run(() => service.destroy());
});
