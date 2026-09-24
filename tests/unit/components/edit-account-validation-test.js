import EmberObject from '@ember/object';
import { module, test } from 'qunit';
import EditAccount from 'ui/components/edit-account/component';

module('Unit | Component | edit account validation');

test('password validation and incorrect-password errors use translations', function(assert) {
  // Exercise the validation hooks without instantiating ModalBase's unrelated
  // application services in this focused unit test.
  let component = EmberObject.create({
    intl: EmberObject.create({t(key) { return key; }}),
    needOld: true,
    showConfirm: true,
  });

  component.setProperties({newPassword: 'first', newPassword2: 'second'});
  assert.false(EditAccount.proto().validate.call(component));
  assert.deepEqual(component.get('errors'), [
    'editAccount.error.currentPasswordRequired',
    'editAccount.error.newPasswordsMismatch',
  ]);

  EditAccount.proto().actions.error.call(component,
    EmberObject.create({code: 'InvalidOldPassword'}));
  assert.deepEqual(component.get('errors'), ['editAccount.error.currentPasswordIncorrect']);
  component.destroy();
});
