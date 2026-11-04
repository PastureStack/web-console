import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import Modal from 'ui/components/modal-auditlog-info/component';
import auditObjectDisplay from 'ui/utils/audit-object-display';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';
import inertRenderer from '../../helpers/inert-renderer';

module('Unit | Component | audit payload modal', function() {
  test('metadata-only and already decoded values do not prevent modal creation or updates', function(assert) {
    let service = EmberObject.create({modalVisible: true, modalOpts: {requestObject: undefined, responseObject: {status: 200}}});
    let component = createOwned(Modal, {renderer: inertRenderer(), modalService: service}, 'component');
    assert.strictEqual(component.get('requestDisplay.state'), 'empty');
    assert.strictEqual(component.get('responseJSON'), '{\n  "status": 200\n}');
    service.set('modalOpts', {requestObject: '[unavailable]', responseObject: null});
    assert.strictEqual(component.get('requestDisplay.text'), '[unavailable]');
    assert.false(component.get('requestDisplay.isJson'));
    assert.strictEqual(component.get('responseDisplay.state'), 'empty');
    destroyOwned(component);
  });

  test('serialized JSON, scalars and native objects retain their actual values', function(assert) {
    for ( let value of ['{"ok":true}', '[1,"two"]', '"text"', 'false', false, '0', 0, 'null', null] ) {
      let output = auditObjectDisplay(value);
      if ( value === null ) {
        assert.strictEqual(output.state, 'empty');
      } else {
        assert.deepEqual(JSON.parse(output.text), typeof value === 'string' ? JSON.parse(value) : value);
      }
    }
    assert.deepEqual(JSON.parse(auditObjectDisplay({ok: true}).text), {ok: true});
  });

  test('non-JSON text is kept as text and unsupported values have an explicit unavailable state', function(assert) {
    let value = '</pre><script>window.auditPayloadExecuted=true</script>';
    assert.deepEqual(auditObjectDisplay(value), {state: 'content', text: value, isJson: false});
    let circular = {}; circular.self = circular;
    assert.strictEqual(auditObjectDisplay(circular).state, 'unavailable');
    assert.strictEqual(auditObjectDisplay(() => {}).state, 'unavailable');
    for ( let missing of [undefined, null, ''] ) {
      assert.strictEqual(auditObjectDisplay(missing).state, 'empty');
    }
  });
});
