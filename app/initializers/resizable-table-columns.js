import { startResizableTableColumns } from 'ui/utils/resizable-table-columns';

export function initialize() {
  startResizableTableColumns();
}

export default {
  name: 'resizable-table-columns',
  after: 'viewport',
  initialize
};
