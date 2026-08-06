import initializeApiStore from 'ui/utils/initialize-api-store';

export default {
  name: 'user-store',
  initialize: initializeApiStore('user-store','userStore')
};
