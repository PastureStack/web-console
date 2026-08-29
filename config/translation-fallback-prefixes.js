'use strict';

// Security-sensitive authentication surfaces are maintained first in the
// English base locale and Traditional Chinese. Other bundled locales inherit
// complete English copy instead of rendering missing-key markers.
module.exports = Object.freeze([
  'auditLogsPage.filterBuilder.',
  'auditLogsPage.table.unnamedEnvironment',
  'auditLogsPage.table.unknownUser',
  'authPage.mfa.',
  'authPage.oidc.',
  'authPage.localAuth.',
  'authPage.root.providers.oidc',
  'loginOidc.',
  'loginPage.oidcMessage',
  'loginPage.localRecovery.',
  'loginPage.mfa.'
]);
