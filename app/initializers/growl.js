export function initialize() {
  // Consumers inject service:growl explicitly.  The former global initializer
  // accidentally overwrote `session` with the growl service.
}

export default {
  name: 'growl',
  initialize: initialize
};
