import Errors from 'ui/utils/errors';

// A timeout, conflict, or server error does not prove that a POST did not commit.
export function definitelyRejected(error) {
  const status = Errors.status(error) || (error && typeof error.get === 'function' && error.get('status'));
  return [400, 401, 403, 404, 405, 422].indexOf(Number(status)) >= 0;
}

export function credentialsForRegistry(credentials, registryId) {
  return credentials.filterBy('registryId', registryId);
}

export function credentialUpdateData(credential) {
  const data = {publicValue: credential.get('publicValue')};
  const secretValue = credential.get('secretValue');

  if ( typeof secretValue === 'string' && secretValue.length > 0 ) {
    data.secretValue = secretValue;
  }

  return data;
}
