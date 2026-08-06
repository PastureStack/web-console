import initializeApiStore from 'ui/utils/initialize-api-store';

export default {
  name: 'webhook-store',
  initialize: initializeApiStore('webhook-store','webhookStore')
};
