import Errors from 'ui/utils/errors';

export default function resourceLoadError(err, intl, unavailableKey, failedKey) {
  let status = Errors.status(err);

  if ( status === 403 || status === 404 ) {
    // Denied and missing resources must look the same to the viewer.
    return {status: 404, message: intl.t(unavailableKey)};
  }
  if ( status >= 500 && status <= 599 ) {
    return {status, message: intl.t(failedKey)};
  }

  // Keep 401 intact so the application route can recover the session.
  return err;
}
