import { A } from '@ember/array';
import EmberObject from '@ember/object';
import { defer, resolve } from 'rsvp';
import { module, test } from 'qunit';

import EditContainer from 'ui/components/edit-container/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | edit container');

function makeComponent({primarySave, portSave, linkSave}, closed) {
  let instance = EmberObject.create({
    validationErrors() { return A([]); },
    save: primarySave,
  });
  let port = EmberObject.create({
    publicPort: 80,
    save: portSave,
  });
  let link = EmberObject.create({
    targetInstanceId: '1i-old',
    save: linkSave,
  });
  let component = createOwned(EditContainer, {
    renderer: inertRenderer(),
    intl: EmberObject.create({t(key) { return key; }}),
    modalService: EmberObject.create({
      modalOpts: null,
      modalVisible: true,
      toggleModal() { closed.push(true); },
    }),
    model: EmberObject.create({instance}),
    portsArray: A([{public: '8080', obj: port}]),
    linksArray: A([{targetInstanceId: '1i-new', obj: link}]),
    loading: false,
  }, 'component');

  return {component, port, link};
}

function save(component, callback) {
  return component.get('actions').save.call(component, callback);
}

test('Save waits for the container, ports, and links and ignores a duplicate click', async function(assert) {
  let primary = defer();
  let port = defer();
  let link = defer();
  let primaryStarted = defer();
  let portStarted = defer();
  let linkStarted = defer();
  let calls = {primary: 0, port: 0, link: 0};
  let closed = [];
  let callbacks = [];
  let {component, port: portModel, link: linkModel} = makeComponent({
    primarySave() { calls.primary++; primaryStarted.resolve(); return primary.promise; },
    portSave() { calls.port++; portStarted.resolve(); return port.promise; },
    linkSave() { calls.link++; linkStarted.resolve(); return link.promise; },
  }, closed);

  let first = save(component, (success) => callbacks.push(success));
  let duplicate = await save(component, (success) => callbacks.push(success));
  assert.deepEqual(duplicate, {saved: false, reason: 'busy'}, 'duplicate submission is refused');
  await primaryStarted.promise;
  assert.deepEqual(calls, {primary: 1, port: 0, link: 0});
  assert.deepEqual(closed, [], 'the modal stays open during the primary PUT');

  primary.resolve(component.get('model.instance'));
  await Promise.all([portStarted.promise, linkStarted.promise]);
  assert.deepEqual(calls, {primary: 1, port: 1, link: 1});
  assert.deepEqual(closed, [], 'the modal stays open during dependent PUTs');
  port.resolve(portModel);
  await resolve();
  assert.deepEqual(closed, [], 'one completed dependent PUT cannot close the modal');
  link.resolve(linkModel);
  await first;

  assert.deepEqual(closed, [true], 'only complete success closes the modal');
  assert.deepEqual(callbacks, [false, true], 'both button callbacks finish with their own result');
  assert.strictEqual(portModel.get('publicPort'), 8080);
  assert.strictEqual(linkModel.get('targetInstanceId'), '1i-new');
  destroyOwned(component);
});

test('primary, port, and link failures keep the modal open and expose top-errors', async function(assert) {
  for (let failedStage of ['primary', 'port', 'link']) {
    let primary = defer();
    let port = defer();
    let link = defer();
    let primaryStarted = defer();
    let portStarted = defer();
    let linkStarted = defer();
    let calls = {primary: 0, port: 0, link: 0};
    let closed = [];
    let callbacks = [];
    let {component, port: portModel, link: linkModel} = makeComponent({
      primarySave() { calls.primary++; primaryStarted.resolve(); return primary.promise; },
      portSave() { calls.port++; portStarted.resolve(); return port.promise; },
      linkSave() { calls.link++; linkStarted.resolve(); return link.promise; },
    }, closed);
    let failure = new Error(`${failedStage} PUT denied`);
    let operation = save(component, (success) => callbacks.push(success));

    await primaryStarted.promise;
    if ( failedStage === 'primary' ) {
      primary.reject(failure);
    } else {
      primary.resolve(component.get('model.instance'));
      await Promise.all([portStarted.promise, linkStarted.promise]);
      if ( failedStage === 'port' ) {
        port.reject(failure);
        await resolve();
        assert.true(component.get('saving'), 'a still-pending link keeps the save lock');
        link.resolve(linkModel);
      } else {
        link.reject(failure);
        await resolve();
        assert.true(component.get('saving'), 'a still-pending port keeps the save lock');
        port.resolve(portModel);
      }
    }

    let outcome = await operation;
    assert.strictEqual(outcome.saved, false, `${failedStage} failure is a handled save outcome`);
    assert.strictEqual(outcome.error, failure, 'the original rejection remains observable');
    assert.deepEqual(closed, [], 'failure leaves the modal open');
    assert.deepEqual(callbacks, [false], 'the button receives failure exactly once');
    assert.true(component.get('errors.0').includes(`${failedStage} PUT denied`),
      'the error remains bound to the top-errors block');
    assert.false(component.get('saving'), 'the save lock is released only after all requests settle');
    assert.strictEqual(portModel.get('publicPort'), failedStage === 'port' || failedStage === 'primary' ? 80 : 8080,
      'only a failed or unstarted port returns to its old local value');
    assert.strictEqual(linkModel.get('targetInstanceId'), failedStage === 'link' || failedStage === 'primary' ? '1i-old' : '1i-new',
      'only a failed or unstarted link returns to its old local value');
    if ( failedStage === 'primary' ) {
      assert.deepEqual(calls, {primary: 1, port: 0, link: 0}, 'dependent PUTs never start');
    }
    destroyOwned(component);
  }
});

test('a synchronous dependent error waits for another pending PUT before releasing the save lock', async function(assert) {
  for (let failureSite of ['links collection', 'later port row']) {
    let pendingPort = defer();
    let portStarted = defer();
    let closed = [];
    let {component, port: portModel} = makeComponent({
      primarySave() { return resolve(this); },
      portSave() { portStarted.resolve(); return pendingPort.promise; },
      linkSave() { return resolve(this); },
    }, closed);

    if ( failureSite === 'links collection' ) {
      component.set('linksArray', null);
    } else {
      component.set('linksArray', A([]));
      component.get('portsArray').pushObject(null);
    }

    let operation = save(component);
    await portStarted.promise;
    await resolve();
    assert.true(component.get('saving'), `${failureSite} does not release the lock while a port PUT is pending`);
    assert.deepEqual(closed, [], 'the modal remains open');

    pendingPort.resolve(portModel);
    let outcome = await operation;
    assert.strictEqual(outcome.saved, false, 'the synchronous error remains a handled failure');
    assert.ok(outcome.error instanceof TypeError, 'the original TypeError is preserved');
    assert.true(Boolean(component.get('errors.0')), 'top-errors retains the synchronous failure');
    assert.strictEqual(portModel.get('publicPort'), 8080, 'the successfully saved port keeps its new value');
    assert.deepEqual(closed, [], 'partial success does not close the modal');
    destroyOwned(component);
  }
});

test('retry resends only the rejected dependent PUT and closes after it succeeds', async function(assert) {
  for (let failedStage of ['port', 'link']) {
    let failedRequest = defer();
    let retryRequest = defer();
    let firstStarted = defer();
    let retryStarted = defer();
    let attempts = {primary: 0, port: 0, link: 0};
    let closed = [];
    let {component, port: portModel, link: linkModel} = makeComponent({
      primarySave() { attempts.primary++; return resolve(this); },
      portSave() {
        attempts.port++;
        if ( failedStage === 'port' ) {
          (attempts.port === 1 ? firstStarted : retryStarted).resolve();
        }
        return failedStage === 'port' ?
          (attempts.port === 1 ? failedRequest.promise : retryRequest.promise) : resolve(this);
      },
      linkSave() {
        attempts.link++;
        if ( failedStage === 'link' ) {
          (attempts.link === 1 ? firstStarted : retryStarted).resolve();
        }
        return failedStage === 'link' ?
          (attempts.link === 1 ? failedRequest.promise : retryRequest.promise) : resolve(this);
      },
    }, closed);

    let first = save(component);
    await firstStarted.promise;
    failedRequest.reject(new Error(`${failedStage} failed once`));
    assert.strictEqual((await first).saved, false);
    assert.deepEqual(closed, [], 'the failed attempt stays on the form');
    assert.strictEqual(portModel.get('publicPort'), failedStage === 'port' ? 80 : 8080);
    assert.strictEqual(linkModel.get('targetInstanceId'), failedStage === 'link' ? '1i-old' : '1i-new');

    let second = save(component);
    await retryStarted.promise;
    assert.deepEqual(attempts, {
      primary: 2,
      port: failedStage === 'port' ? 2 : 1,
      link: failedStage === 'link' ? 2 : 1,
    }, 'retry sends only the failed dependent PUT, not its successful peer');
    assert.deepEqual(closed, [], 'the modal waits for the deferred retry PUT');
    retryRequest.resolve(failedStage === 'port' ? portModel : linkModel);
    await second;
    assert.deepEqual(closed, [true], 'the successful retry closes once');
    destroyOwned(component);
  }
});
