import initializeApiStore from 'ui/utils/initialize-api-store';

export default {
  name: 'auth-store',
  initialize: initializeApiStore('auth-store','authStore')
};
