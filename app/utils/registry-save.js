import Errors from 'ui/utils/errors';

// A timeout, conflict, or server error does not prove that a POST did not commit.
export function definitelyRejected(error) {
  const status = Errors.status(error) || (error && typeof error.get === 'function' && error.get('status'));
  return [400, 401, 403, 404, 405, 422].indexOf(Number(status)) >= 0;
}

export function credentialsForRegistry(credentials, registryId) {
  return credentials.filterBy('registryId', registryId);
}
