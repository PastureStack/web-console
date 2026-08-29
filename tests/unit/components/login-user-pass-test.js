import { module, test } from 'qunit';
import LoginUserPass from 'ui/components/login-user-pass/component';
import inertRenderer from '../../helpers/inert-renderer';
import { createOwned, destroyOwned } from '../../helpers/owned-subject';

module('Unit | Component | login user pass');

test('reveals the password only on request and clears it after authentication', function(assert) {
  assert.expect(8);

  let forwardedCode = null;
  let component = createOwned(LoginUserPass, {
    renderer: inertRenderer(),
    username: 'operator',
    password: 'secret',
  }, 'component');

  component.sendAction = function(name, code) {
    assert.equal(name, 'action', 'uses the configured login action');
    forwardedCode = code;
  };

  assert.false(component.get('showPassword'), 'the password starts concealed');
  component.send('togglePasswordVisibility');
  assert.true(component.get('showPassword'), 'the user can inspect exactly what was entered');
  component.send('togglePasswordVisibility');
  assert.false(component.get('showPassword'), 'the user can conceal it again');
  component.send('togglePasswordVisibility');
  component.send('authenticate');

  assert.equal(forwardedCode, 'operator:secret', 'authentication receives the exact entered bytes');
  assert.equal(component.get('password'), '', 'the password is cleared after submission');
  assert.false(component.get('showPassword'), 'the cleared field returns to concealed mode');
  assert.equal(component.get('username'), 'operator', 'the username remains available for a retry');

  destroyOwned(component);
});
