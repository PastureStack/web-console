import { module, test } from 'qunit';
import { setupContext, setupRenderingContext, teardownContext, render, fillIn, click, select, find, findAll, settled } from '@ember/test-helpers';
import { precompileTemplate } from '@ember/template-compilation';
import Service from '@ember/service';
import EmberObject from '@ember/object';
import resolver from '../../helpers/resolver';
import { initialize as initializePodLayouts } from 'ui/initializers/pod-component-layouts';
import { initialize as initializeIntl } from 'ui/instance-initializers/intl';
import { hardwareIssues } from 'ui/utils/hardware-options';

module('Integration | Component | hardware resources', function(hooks) {
  hooks.beforeEach(async function() {
    this.testRoot = document.createElement('div');
    this.testRoot.id = 'ember-testing';
    this.testRoot.style.width = '1120px';
    document.body.appendChild(this.testRoot);
    await setupContext(this, {resolver});
    initializePodLayouts();
    this.owner.register('service:projects', Service.extend({current: {isWindows: false}}));
    initializeIntl(this.owner);
    this.intl = this.owner.lookup('service:intl');
    this.english = await (await fetch('/translations/en-us.json')).json();
    this.intl.addTranslations('en-us', this.english);
    this.intl.setLocale(['en-us']);
    await setupRenderingContext(this);
    this.instance = EmberObject.create({shmSize: 2147483648, pidsLimit: -1,
      ulimits: [{name: 'memlock', soft: -1, hard: -1}], restartPolicy: {name: 'unless-stopped'}});
    this.hosts = [EmberObject.create({id: 'test-host', name: 'GPU workstation', state: 'active', info: {hardwareInfo: {
      status: 'available', collectedAt: new Date().toISOString(), runtimes: ['runc', 'nvidia'], deviceRequestsSupported: true,
      devices: [{kind: 'nvidia', id: 'GPU-one', name: 'NVIDIA test GPU'},
        {kind: 'drm', name: 'Intel test render node', path: '/dev/dri/renderD128', groupId: 993}],
    }}})];
  });
  hooks.afterEach(async function() { await teardownContext(this); this.testRoot.remove(); });

  test('actual form renders, edits exact bytes, selects hardware and retains signed limits', async function(assert) {
    await render(precompileTemplate('{{form-resources instance=this.instance allHosts=this.hosts}}'));
    assert.equal(find('input[id$="-shm"]').value, '2');
    assert.equal(this.instance.get('pidsLimit'), -1, 'render does not strip unlimited');
    await fillIn('input[id$="-shm"]', '4');
    assert.equal(this.instance.get('shmSize'), 4294967296);
    await fillIn('input[id$="-shm"]', '512m');
    assert.equal(this.instance.get('shmSize'), 536870912);
    await select('select[id$="-host"]', 'test-host');
    await select('select[id$="-gpu-mode"]', 'selected');
    let nvidia = findAll('.form-resources fieldset input[type="checkbox"]')[0];
    await click(nvidia);
    assert.deepEqual(this.instance.get('deviceRequests'), [{driver: 'nvidia', deviceIds: ['GPU-one'], capabilities: [['gpu']]}]);
    await click(findAll('.form-resources fieldset input[type="checkbox"]')[1]);
    assert.deepEqual(this.instance.get('devices'), ['/dev/dri/renderD128:/dev/dri/renderD128:rw']);
    assert.deepEqual(this.instance.get('groupAdd'), ['993']);
    await click('.form-resources button[aria-expanded]');
    await fillIn('[data-hardware="pids"]', '-1');
    await fillIn('[data-hardware="soft"]', '-1');
    await fillIn('[data-hardware="hard"]', '-1');
    assert.strictEqual(this.instance.get('pidsLimit'), -1);
    assert.strictEqual(this.instance.get('ulimits')[0].soft, -1);
    assert.deepEqual(this.instance.get('restartPolicy'), {name: 'unless-stopped'});
    assert.strictEqual(this.instance.get('privileged'), undefined);
    assert.strictEqual(this.instance.get('ipcMode'), undefined);
  });

  test('resource controls are grouped and the shared-memory value and unit stay together', async function(assert) {
    await render(precompileTemplate('{{form-resources instance=this.instance allHosts=this.hosts}}'));
    assert.deepEqual(findAll('.form-resources [data-resource-section]').map((element) => element.dataset.resourceSection),
      ['essentials', 'hardware', 'limits', 'advanced'], 'only the four purposeful sections are rendered');
    let control = find('.resource-size-control');
    let input = control.querySelector('input');
    let unit = control.querySelector('select');
    assert.strictEqual(input.nextElementSibling.tagName, 'DATALIST', 'capacity suggestions stay bound next to the input');
    assert.strictEqual(unit.parentElement, control, 'capacity unit stays in the same control');
    assert.equal(getComputedStyle(control).display, 'flex', 'capacity and unit use one horizontal control');
    assert.equal(Math.round(input.getBoundingClientRect().top), Math.round(unit.getBoundingClientRect().top), 'capacity and unit align vertically');
    assert.ok(unit.getBoundingClientRect().width < input.getBoundingClientRect().width, 'the unit is compact and the value gets useful space');
    assert.ok(find('.resource-field-host select[id$="-host"]'), 'host inventory is prominent in the hardware section');
    assert.ok(find('.resource-advanced-toggle[aria-expanded="false"]'), 'rare settings remain discoverable without overwhelming the common path');
  });

  test('switching primary and sidekick resets drafts and advanced maps without rewriting either config', async function(assert) {
    this.instance.set('tmpfs', {'/first': 'size=64m'});
    let first = this.instance;
    await render(precompileTemplate('{{form-resources instance=this.instance allHosts=this.hosts}}'));
    await click('.form-resources button[aria-expanded]');
    let next = EmberObject.create({shmSize: 536870912, cpuQuota: -1, memory: 1073741824,
      memorySwap: -1, tmpfs: {'/second': 'size=128m'}, sysctls: {'net.core.somaxconn': '1024'}});
    this.set('instance', next);
    await settled();
    assert.equal(find('input[id$="-shm"]').value, '512');
    assert.ok(findAll('input.key').some((input) => input.value === '/second'), 'new map is rendered');
    assert.notOk(findAll('input.key').some((input) => input.value === '/first'), 'old map does not leak');
    await fillIn('input[id$="-shm"]', '1024');
    assert.equal(next.get('shmSize'), 1073741824);
    assert.equal(first.get('shmSize'), 2147483648, 'primary value was not changed while editing sidekick');
    assert.deepEqual(first.get('tmpfs'), {'/first': 'size=64m'});
    assert.equal(next.get('memorySwap'), -1);
    assert.equal(next.get('cpuQuota'), -1);
    this.set('instance', first);
    await settled();
    assert.equal(find('input[id$="-shm"]').value, '2', 'original primary draft restored');
  });

  test('readonly details preserve custom requests, and all shipped locales render resource guidance', async function(assert) {
    const custom = [{driver: 'custom', deviceIds: ['device-one'], capabilities: [['gpu'], ['compute']], options: {mode: 'keep'}}];
    this.instance.setProperties({deviceRequests: custom, devices: ['/dev/null:rw'], groupAdd: ['1000'], memorySwap: -1});
    await render(precompileTemplate('{{form-resources instance=this.instance allHosts=this.hosts editing=false}}'));
    await click('.form-resources button[aria-expanded]');
    assert.equal(findAll('input:not([disabled]), select:not([disabled])').length, 0, 'details contain no editable configuration inputs');
    assert.deepEqual(this.instance.get('deviceRequests'), custom);
    assert.deepEqual(this.instance.get('devices'), ['/dev/null:rw']);
    for (const locale of ['en-us','zh-tw','zh-hans','ja-jp','ko-kr','de-de','fr-fr','fa-ir','fil-ph','hu-hu','pt-br','ru-ru','uk-ua']) {
      let messages = locale === 'en-us' ? this.english : await (await fetch(`/translations/${locale}.json`)).json();
      this.intl.addTranslations(locale, messages);
      this.intl.setLocale([locale]);
      await settled();
      assert.equal(find('.form-resources h3').textContent.trim(), messages['formResources.title'], locale);
      assert.ok(find('.form-resources').textContent.includes(messages['formResources.shmHelp']), `${locale} guidance`);
      assert.notOk(find('.form-resources').textContent.includes('Missing translation'), `${locale} has no missing message`);
    }
    assert.equal(this.instance.get('memorySwap'), -1);
    this.intl.setLocale(['en-us']);
    this.instance.setProperties({requestedHostId: 'test-host', deviceRequests: [{driver: 'nvidia', count: -1, capabilities: [['gpu']]}]});
    await settled();
    assert.notOk(find('.form-resources pre'), 'ordinary GPU requests use human-readable details, not raw JSON');
    assert.ok(find('.form-resources').textContent.includes(this.english['formResources.all']));
    assert.ok(findAll('.form-resources fieldset input[type="checkbox"]')[0].checked, 'all GPUs are shown selected in readonly details');
  });

  test('a sidekick displays inherited host hardware without writing an override', async function(assert) {
    this.set('primaryHostId', 'test-host');
    await render(precompileTemplate('{{form-resources instance=this.instance allHosts=this.hosts primaryRequestedHostId=this.primaryHostId}}'));
    assert.equal(find('select[id$="-host"]').value, '', 'no sidekick host override');
    assert.ok(find('select[id$="-host"] option').textContent.includes(this.english['formResources.inheritHost']));
    assert.ok(find('.form-resources').textContent.includes('Intel test render node'));
    await click(findAll('.form-resources fieldset input[type="checkbox"]')[0]);
    assert.deepEqual(this.instance.get('devices'), ['/dev/dri/renderD128:/dev/dri/renderD128:rw']);
    assert.strictEqual(this.instance.get('requestedHostId'), undefined);
    this.set('primaryHostId', 'missing-host');
    await settled();
    assert.notOk(find('.form-resources').textContent.includes('Intel test render node'), 'old inventory disappears when the primary host changes');
    assert.ok(find('.form-resources').textContent.includes(this.english['formResources.errors.hostRequired']));
  });

  test('hardware choices follow real capabilities without silently changing existing requests', async function(assert) {
    this.preflight = (state) => { this.preflightState = state; };
    await render(precompileTemplate('{{form-resources instance=this.instance allHosts=this.hosts preflightChanged=this.preflight}}'));
    assert.notOk(find('select[id$="-gpu-mode"]'), 'host-specific controls stay out of the way until a host is chosen');
    assert.ok(find('.resource-hardware-empty'), 'the form explains the single next step instead of showing disabled hardware controls');
    await select('select[id$="-host"]', 'test-host');
    assert.notOk(find('.resource-hardware-empty'));
    assert.notOk(find('select[id$="-gpu-mode"] option[value="all"]').disabled);
    assert.strictEqual(this.instance.get('deviceRequests'), undefined, 'selecting a host does not allocate GPUs');
    await select('select[id$="-gpu-mode"]', 'count');
    assert.equal(find('input[id$="-count"]').max, '1');
    await fillIn('input[id$="-count"]', '2');
    assert.true(this.preflightState.blocked, 'over-allocation is blocked');
    await fillIn('input[id$="-count"]', '1');
    assert.false(this.preflightState.blocked);
    const requests = JSON.stringify(this.instance.get('deviceRequests'));
    this.hosts[0].set('info', {hardwareInfo: {status: 'available', collectedAt: new Date().toISOString(), runtimes: ['runc'], devices: []}});
    await settled();
    assert.true(this.preflightState.blocked, 'disappearing hardware is not considered available');
    assert.equal(JSON.stringify(this.instance.get('deviceRequests')), requests, 'the request is preserved for correction rather than silently dropped');
    assert.ok(find('select[id$="-gpu-mode"] option[value="count"]').disabled);
    await select('select[id$="-gpu-mode"]', 'none');
    assert.false(this.preflightState.blocked, 'user can explicitly remove the invalid request');
  });

  test('suggestions are wired to actual inputs and advanced draft errors block saving', async function(assert) {
    this.preflight = (state) => { this.preflightState = state; };
    await render(precompileTemplate('{{form-resources instance=this.instance allHosts=this.hosts preflightChanged=this.preflight}}'));
    let shm = find('input[id$="-shm"]');
    assert.ok(Array.from(shm.list.options).some((option) => option.value === '2g'), 'native keyboard autocomplete is associated with capacity input');
    await fillIn(shm, '3g');
    assert.equal(this.instance.get('shmSize'), 3221225472, 'custom capacity remains supported');
    await click('.form-resources button[aria-expanded]');
    await click('[data-hardware="sysctls"] button');
    assert.true(this.preflightState.blocked, 'new unfinished row is not silently omitted');
    let key = find('[data-hardware="sysctls"] input.key');
    assert.ok(Array.from(key.list.options).some((option) => option.value === 'net.core.somaxconn'));
    await fillIn(key, 'net.core.somaxconn');
    assert.true(this.preflightState.blocked, 'key without value remains invalid');
    await fillIn('[data-hardware="sysctls"] input.value', '1024');
    assert.false(this.preflightState.blocked);
    assert.deepEqual(this.instance.get('sysctls'), {'net.core.somaxconn': '1024'});
    await click('[data-hardware="sysctls"] button');
    await fillIn(findAll('[data-hardware="sysctls"] input.key')[1], 'net.core.somaxconn');
    await fillIn(findAll('[data-hardware="sysctls"] input.value')[1], '2048');
    assert.true(this.preflightState.blocked, 'duplicate keys are not silently treated as a valid map');
    await click(findAll('[data-hardware="sysctls"] tr button')[1]);
    assert.false(this.preflightState.blocked);
    await click('[data-hardware="add-ulimit"]');
    assert.true(this.preflightState.blocked, 'limits must be deliberately entered, not invented');
    let name = find('input[list$="-ulimit-suggestions"]');
    assert.ok(Array.from(name.list.options).some((option) => option.value === 'memlock'));
    assert.strictEqual(this.instance.get('privileged'), undefined);
  });

  test('unfinished primary inputs survive sidekick switching and still block the whole service', async function(assert) {
    const primary = this.instance;
    this.preflight = (state) => { this.preflightState = state; };
    await render(precompileTemplate('{{form-resources instance=this.instance allHosts=this.hosts preflightChanged=this.preflight}}'));
    await fillIn('input[id$="-shm"]', 'wrong');
    await click('.form-resources button[aria-expanded]');
    await click('[data-hardware="sysctls"] button');
    await fillIn('[data-hardware="sysctls"] input.key', 'net.core.somaxconn');
    this.set('instance', EmberObject.create({}));
    await settled();
    assert.deepEqual(hardwareIssues(this.instance, null), [], 'sidekick has its own clean draft');
    assert.ok(hardwareIssues(primary, null).includes('shm'), 'parent save still catches invalid hidden primary capacity');
    assert.ok(hardwareIssues(primary, null).includes('map'), 'hidden incomplete map cannot bypass save validation');
    this.set('instance', primary);
    await settled();
    assert.equal(find('input[id$="-shm"]').value, 'wrong', 'invalid user input remains available for correction');
    assert.equal(find('[data-hardware="sysctls"] input.key').value, 'net.core.somaxconn', 'incomplete row is restored, not discarded');
    assert.true(this.preflightState.blocked);
    await fillIn('input[id$="-shm"]', '2g');
    await fillIn('[data-hardware="sysctls"] input.value', '1024');
    assert.deepEqual(hardwareIssues(primary, null), []);
    assert.false(this.preflightState.blocked);
    assert.notOk(JSON.stringify(primary).includes('Rows'), 'editor drafts are never sent to the API');
  });
});
