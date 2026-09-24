'use strict';

// Security-sensitive authentication surfaces are maintained first in the
// English base locale and Traditional Chinese. Other bundled locales inherit
// complete English copy instead of rendering missing-key markers.
module.exports = Object.freeze([
  'authPage.mfa.',
  'authPage.oidc.',
  'authPage.localAuth.',
  'authPage.root.providers.oidc',
  'loginOidc.',
  'loginPage.oidcMessage',
  'loginPage.localRecovery.',
  'loginPage.mfa.',
  // Permission and account-validation errors must never render a missing-key
  // marker. Keep reviewed English copy as the fallback outside zh-tw.
  'resourceLoadError.',
  'accountsPage.new.error.',
  'editAccount.error.',
  'viewEditProject.error.'
]);
