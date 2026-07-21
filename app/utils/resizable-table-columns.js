const TABLE_SELECTOR = 'table.grid:not([data-column-resize="off"])';
const HANDLE_CLASS = 'table-column-resize-handle';
const HOST_CLASS = 'table-column-scroll-host';
const MEASURING_CLASS = 'table-column-measuring';
const MANAGED_ATTRIBUTE = 'data-resizable-columns';
const MIN_COLUMN_WIDTH = 48;
const COMPACT_COLUMN_WIDTH = 96;
const MAX_INITIAL_COLUMN_WIDTH = 720;
const NATURAL_WIDTH_PADDING = 8;
const DESKTOP_BREAKPOINT = 694;
const KEYBOARD_STEP = 16;
const KEYBOARD_LARGE_STEP = 48;

let activeManager = null;

function sum(widths) {
  return widths.reduce((total, width) => total + width, 0);
}

function clampInitialWidth(width) {
  return Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_INITIAL_COLUMN_WIDTH, Math.ceil(width)));
}

/**
 * Preserve compact utility columns while sharing unused space between columns
 * that contain ordinary data. This keeps a table full-width without allowing a
 * single unspecified column to consume all remaining space.
 */
export function distributeWidths(widths, availableWidth) {
  let output = widths.map((width) => clampInitialWidth(width));
  let remaining = Math.floor(availableWidth - sum(output));

  if ( remaining <= 0 ) {
    return output;
  }

  let flexible = output.map((width, index) => width > COMPACT_COLUMN_WIDTH ? index : -1)
    .filter((index) => index >= 0);

  if ( !flexible.length ) {
    flexible = output.map((width, index) => index);
  }

  let shared = Math.floor(remaining / flexible.length);
  let remainder = remaining % flexible.length;

  flexible.forEach((index) => {
    output[index] += shared + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
  });

  return output;
}

/**
 * Resize a column against its neighbour so the table remains full-width. Once
 * the neighbouring column reaches its minimum, the table grows horizontally.
 */
export function resizeWidths(widths, index, requestedWidth) {
  let output = widths.slice();
  let target = Math.max(MIN_COLUMN_WIDTH, Math.round(requestedWidth));
  let delta = target - output[index];

  output[index] = target;

  if ( index < output.length - 1 ) {
    output[index + 1] = Math.max(MIN_COLUMN_WIDTH, output[index + 1] - delta);
  }

  return output;
}

function directChildWithClass(element, className) {
  let children = element.children || [];

  for ( let i = 0 ; i < children.length ; i++ ) {
    if ( children[i].classList.contains(className) ) {
      return children[i];
    }
  }

  return null;
}

function closestManagedTable(node) {
  let current = node && (node.nodeType === 1 ? node : node.parentElement);

  while ( current && current !== document.body ) {
    if ( current.matches && current.matches(TABLE_SELECTOR) ) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function directHeaderCells(tHead) {
  let cells = [];
  let children = tHead ? tHead.children : [];

  for ( let i = 0 ; i < children.length ; i++ ) {
    if ( children[i].tagName === 'TH' ) {
      cells.push(children[i]);
    }
  }

  return cells;
}

function visibleHeaderRow(table) {
  if ( !table.tHead ) {
    return null;
  }

  let fixed = table.tHead.querySelector('tr.fixed-header');

  if ( fixed && fixed.cells.length > 1 ) {
    return fixed;
  }

  let rows = table.tHead.rows;

  for ( let i = rows.length - 1 ; i >= 0 ; i-- ) {
    let row = rows[i];

    if ( row.cells.length > 1 && !row.classList.contains('fixed-header-placeholder') ) {
      return row;
    }
  }

  // A few legacy templates contain TH elements directly under THEAD. Browsers
  // render that structure, but do not expose it through HTMLTableSection.rows.
  let directCells = directHeaderCells(table.tHead);

  if ( directCells.length > 1 ) {
    return {cells: directCells};
  }

  return null;
}

function isResizableDataTable(table) {
  let header = visibleHeaderRow(table);

  if ( !header || header.cells.length < 2 ) {
    return false;
  }

  for ( let i = 0 ; i < header.cells.length ; i++ ) {
    if ( header.cells[i].colSpan !== 1 ) {
      return false;
    }
  }

  return true;
}

function columnLabel(header, index) {
  let text = (header.innerText || header.textContent || '').replace(/\s+/g, ' ').trim();

  return text || `Column ${index + 1}`;
}

function resizeHandleLabel(header, index) {
  let name = columnLabel(header, index);
  let language = (document.documentElement.getAttribute('lang') || navigator.language || '').toLowerCase();

  if ( language.indexOf('zh') === 0 || /[\u3400-\u9fff]/.test(name) ) {
    return `調整「${name}」欄寬；使用左右方向鍵調整，按 Enter 自動調整`;
  }

  return `Resize ${name}; use the left and right arrow keys, or press Enter to auto-fit`;
}

function hostAvailableWidth(table) {
  let host = table.parentElement;

  if ( !host ) {
    return table.getBoundingClientRect().width;
  }

  let style = window.getComputedStyle(host);
  let padding = parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0);

  return Math.max(0, host.clientWidth - padding);
}

function widthRecords(table) {
  let elements = table.querySelectorAll('col, thead th, tbody td[width], tfoot td[width]');

  return Array.prototype.map.call(elements, (element) => ({
    element,
    style: element.getAttribute('style'),
    width: element.getAttribute('width')
  }));
}

function clearRecordedWidths(records) {
  records.forEach((record) => {
    record.element.removeAttribute('width');
    record.element.style.removeProperty('width');
    record.element.style.removeProperty('min-width');
    record.element.style.removeProperty('max-width');
  });
}

function restoreRecordedWidths(records) {
  records.forEach((record) => {
    if ( record.width === null ) {
      record.element.removeAttribute('width');
    } else {
      record.element.setAttribute('width', record.width);
    }

    if ( record.style === null ) {
      record.element.removeAttribute('style');
    } else {
      record.element.setAttribute('style', record.style);
    }
  });
}

function headerWidthHints(table, headerRow) {
  let hints = Array.prototype.map.call(headerRow.cells, () => 0);
  let candidates = [headerRow.cells];
  let rows = table.tHead ? table.tHead.rows : [];

  for ( let rowIndex = 0 ; rowIndex < rows.length ; rowIndex++ ) {
    if ( rows[rowIndex].cells.length === hints.length ) {
      candidates.push(rows[rowIndex].cells);
    }
  }

  candidates.forEach((cells) => {
    for ( let index = 0 ; index < cells.length ; index++ ) {
      let width = parseFloat(cells[index].getAttribute('width') || cells[index].style.width || 0);

      if ( Number.isFinite(width) ) {
        hints[index] = Math.max(hints[index], width);
      }
    }
  });

  return hints;
}

function measureNaturalWidths(table, headerRow, widthHints) {
  let records = widthRecords(table);
  let tableStyle = table.getAttribute('style');
  let hints = widthHints || [];

  clearRecordedWidths(records);
  table.classList.add(MEASURING_CLASS);
  table.style.setProperty('table-layout', 'auto', 'important');
  table.style.setProperty('width', '1px', 'important');
  table.style.setProperty('min-width', '0', 'important');
  table.style.setProperty('max-width', 'none', 'important');

  // Reading the cell rectangles forces one synchronous layout while the table
  // is in intrinsic, non-wrapping measurement mode.
  let widths = Array.prototype.map.call(headerRow.cells, (cell, index) => {
    return clampInitialWidth(Math.max(cell.getBoundingClientRect().width + NATURAL_WIDTH_PADDING, hints[index] || 0));
  });

  table.classList.remove(MEASURING_CLASS);

  if ( tableStyle === null ) {
    table.removeAttribute('style');
  } else {
    table.setAttribute('style', tableStyle);
  }

  restoreRecordedWidths(records);

  return widths;
}

function managerNode(node) {
  if ( !node || node.nodeType !== 1 ) {
    return false;
  }

  return node.classList.contains(HANDLE_CLASS) || node.getAttribute('data-table-column-sizer') === 'true' || node.tagName === 'COL';
}

function TableColumnManager(targetWindow, targetDocument) {
  this.window = targetWindow;
  this.document = targetDocument;
  this.states = new WeakMap();
  this.pending = [];
  this.frame = null;
  this.resizeTimer = null;
  this.drag = null;
  this.observer = null;

  this.onMutations = this.onMutations.bind(this);
  this.onPointerDown = this.onPointerDown.bind(this);
  this.onPointerMove = this.onPointerMove.bind(this);
  this.onPointerUp = this.onPointerUp.bind(this);
  this.onHandleClick = this.onHandleClick.bind(this);
  this.onHandleDoubleClick = this.onHandleDoubleClick.bind(this);
  this.onHandleKeyDown = this.onHandleKeyDown.bind(this);
  this.onWindowResize = this.onWindowResize.bind(this);
  this.scan = this.scan.bind(this);
  this.flush = this.flush.bind(this);
}

TableColumnManager.prototype.start = function() {
  if ( !this.document.body || !this.window.MutationObserver ) {
    return this;
  }

  this.observer = new this.window.MutationObserver(this.onMutations);
  this.observer.observe(this.document.body, {
    childList: true,
    subtree: true
  });

  this.document.addEventListener('pointerdown', this.onPointerDown, true);
  this.document.addEventListener('pointermove', this.onPointerMove, true);
  this.document.addEventListener('pointerup', this.onPointerUp, true);
  this.document.addEventListener('pointercancel', this.onPointerUp, true);
  this.document.addEventListener('click', this.onHandleClick, true);
  this.document.addEventListener('dblclick', this.onHandleDoubleClick, true);
  this.document.addEventListener('keydown', this.onHandleKeyDown, true);
  this.window.addEventListener('resize', this.onWindowResize);

  this.scan();

  return this;
};

TableColumnManager.prototype.scan = function() {
  if ( this.window.innerWidth <= DESKTOP_BREAKPOINT ) {
    return;
  }

  let tables = this.document.querySelectorAll(TABLE_SELECTOR);

  Array.prototype.forEach.call(tables, (table) => this.schedule(table, false));
};

TableColumnManager.prototype.schedule = function(table, contentChanged) {
  if ( !table || !table.isConnected ) {
    return;
  }

  let pending = this.pending.find((item) => item.table === table);

  if ( pending ) {
    pending.contentChanged = pending.contentChanged || contentChanged;
  } else {
    this.pending.push({table, contentChanged});
  }

  if ( !this.frame ) {
    this.frame = this.window.requestAnimationFrame(this.flush);
  }
};

TableColumnManager.prototype.flush = function() {
  let pending = this.pending.slice();

  this.pending.length = 0;
  this.frame = null;

  if ( this.window.innerWidth <= DESKTOP_BREAKPOINT ) {
    return;
  }

  pending.forEach((item) => this.decorate(item.table, item.contentChanged));
};

TableColumnManager.prototype.stateFor = function(table) {
  let state = this.states.get(table);

  if ( !state ) {
    state = {
      table,
      headerRow: null,
      colgroup: null,
      headerCells: [],
      widthHints: [],
      widths: [],
      manual: false,
      ready: false
    };
    this.states.set(table, state);
  }

  return state;
};

TableColumnManager.prototype.ensureColgroup = function(state, count) {
  let colgroup = state.colgroup;

  if ( !colgroup || !colgroup.isConnected ) {
    colgroup = this.document.createElement('colgroup');
    colgroup.setAttribute('data-table-column-sizer', 'true');
    state.table.insertBefore(colgroup, state.table.firstChild);
    state.colgroup = colgroup;
  }

  while ( colgroup.children.length < count ) {
    colgroup.appendChild(this.document.createElement('col'));
  }

  while ( colgroup.children.length > count ) {
    colgroup.removeChild(colgroup.lastElementChild);
  }
};

TableColumnManager.prototype.ensureHandles = function(state) {
  let cells = state.headerRow.cells;

  for ( let index = 0 ; index < cells.length ; index++ ) {
    let header = cells[index];
    let handle = directChildWithClass(header, HANDLE_CLASS);

    if ( !handle ) {
      handle = this.document.createElement('span');
      handle.className = HANDLE_CLASS;
      handle.setAttribute('role', 'separator');
      handle.setAttribute('aria-orientation', 'vertical');
      handle.setAttribute('tabindex', '0');
      header.appendChild(handle);
    }

    handle.setAttribute('data-column-index', index);
    handle.setAttribute('aria-valuemin', MIN_COLUMN_WIDTH);
    handle.setAttribute('aria-label', resizeHandleLabel(header, index));
    handle.setAttribute('title', resizeHandleLabel(header, index));
  }
};

TableColumnManager.prototype.decorate = function(table, contentChanged) {
  if ( !table.isConnected || !isResizableDataTable(table) ) {
    return;
  }

  let state = this.stateFor(table);
  let headerRow = visibleHeaderRow(table);
  let columnCount = headerRow.cells.length;
  let columnsChanged = state.widths.length !== columnCount;
  let headerChanged = state.headerCells.length !== columnCount;

  if ( !headerChanged ) {
    for ( let index = 0 ; index < columnCount ; index++ ) {
      if ( state.headerCells[index] !== headerRow.cells[index] ) {
        headerChanged = true;
        break;
      }
    }
  }

  if ( headerChanged ) {
    state.headerCells = Array.prototype.slice.call(headerRow.cells);
    state.widthHints = headerWidthHints(table, headerRow);
  }

  state.headerRow = headerRow;
  table.setAttribute(MANAGED_ATTRIBUTE, 'true');
  table.parentElement.classList.add(HOST_CLASS);
  this.ensureColgroup(state, columnCount);
  this.ensureHandles(state);

  if ( columnsChanged ) {
    state.manual = false;
    state.ready = false;
  }

  if ( !state.ready || (contentChanged && !state.manual) ) {
    this.autoFit(state);
  } else {
    this.applyWidths(state);
  }
};

TableColumnManager.prototype.autoFit = function(state) {
  if ( !state.table.offsetParent || hostAvailableWidth(state.table) <= 0 ) {
    state.ready = false;
    return;
  }

  let natural = measureNaturalWidths(state.table, state.headerRow, state.widthHints);

  state.widths = distributeWidths(natural, hostAvailableWidth(state.table));
  state.manual = false;
  state.ready = true;
  this.applyWidths(state);
};

TableColumnManager.prototype.applyWidths = function(state) {
  let tableWidth = sum(state.widths);
  let cols = state.colgroup.children;

  for ( let index = 0 ; index < state.widths.length ; index++ ) {
    let width = `${state.widths[index]}px`;

    cols[index].style.width = width;
  }

  let headerRows = state.table.tHead ? state.table.tHead.rows : [];

  for ( let rowIndex = 0 ; rowIndex < headerRows.length ; rowIndex++ ) {
    let row = headerRows[rowIndex];

    if ( row.cells.length === state.widths.length ) {
      for ( let cellIndex = 0 ; cellIndex < row.cells.length ; cellIndex++ ) {
        row.cells[cellIndex].style.width = `${state.widths[cellIndex]}px`;
      }
    }
  }

  for ( let headerIndex = 0 ; headerIndex < state.headerRow.cells.length ; headerIndex++ ) {
    state.headerRow.cells[headerIndex].style.width = `${state.widths[headerIndex]}px`;
  }

  state.table.style.tableLayout = 'fixed';
  state.table.style.width = `${tableWidth}px`;
  state.table.style.minWidth = `${tableWidth}px`;
  state.table.style.maxWidth = 'none';

  this.updateHandles(state);
  this.window.requestAnimationFrame(() => this.updateOverflowTitles(state));
};

TableColumnManager.prototype.updateHandles = function(state) {
  let cells = state.headerRow.cells;

  for ( let index = 0 ; index < cells.length ; index++ ) {
    let handle = directChildWithClass(cells[index], HANDLE_CLASS);

    if ( handle ) {
      handle.setAttribute('aria-valuenow', state.widths[index]);
    }
  }
};

TableColumnManager.prototype.updateOverflowTitles = function(state) {
  if ( !state.table.isConnected ) {
    return;
  }

  let cells = state.table.querySelectorAll('tbody td:not([colspan]):not(.actions):not(.subtable)');

  Array.prototype.forEach.call(cells, (cell) => {
    let automatic = cell.getAttribute('data-column-overflow-title') === 'true';
    let interactive = cell.querySelector('input, select, textarea, button');
    let text = (cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim();
    let clipped = cell.scrollWidth > cell.clientWidth + 1;

    if ( clipped && text && !interactive && (!cell.hasAttribute('title') || automatic) ) {
      cell.setAttribute('title', text);
      cell.setAttribute('data-column-overflow-title', 'true');
    } else if ( automatic && !clipped ) {
      cell.removeAttribute('title');
      cell.removeAttribute('data-column-overflow-title');
    }
  });
};

TableColumnManager.prototype.handleForEvent = function(event) {
  let target = event.target;

  return target && target.classList && target.classList.contains(HANDLE_CLASS) ? target : null;
};

TableColumnManager.prototype.stateForHandle = function(handle) {
  let table = closestManagedTable(handle);

  return table ? this.states.get(table) : null;
};

TableColumnManager.prototype.onPointerDown = function(event) {
  let handle = this.handleForEvent(event);

  if ( !handle || event.button !== 0 ) {
    return;
  }

  let state = this.stateForHandle(handle);

  if ( !state ) {
    return;
  }

  let index = parseInt(handle.getAttribute('data-column-index'), 10);

  this.drag = {
    state,
    index,
    startX: event.clientX,
    startWidth: state.widths[index]
  };

  state.manual = true;
  this.document.body.classList.add('table-column-resizing');
  handle.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopImmediatePropagation();
};

TableColumnManager.prototype.onPointerMove = function(event) {
  if ( !this.drag ) {
    return;
  }

  let requested = this.drag.startWidth + event.clientX - this.drag.startX;

  this.drag.state.widths = resizeWidths(this.drag.state.widths, this.drag.index, requested);
  this.applyWidths(this.drag.state);
  event.preventDefault();
  event.stopImmediatePropagation();
};

TableColumnManager.prototype.onPointerUp = function(event) {
  if ( !this.drag ) {
    return;
  }

  this.drag = null;
  this.document.body.classList.remove('table-column-resizing');
  event.preventDefault();
  event.stopImmediatePropagation();
};

TableColumnManager.prototype.onHandleClick = function(event) {
  if ( !this.handleForEvent(event) ) {
    // A tab can contain a pre-rendered table that was hidden during the first
    // scan. Wait until the click handlers reveal it, then try once more.
    this.window.setTimeout(this.scan, 0);
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
};

TableColumnManager.prototype.onHandleDoubleClick = function(event) {
  let handle = this.handleForEvent(event);

  if ( !handle ) {
    return;
  }

  let state = this.stateForHandle(handle);
  let index = parseInt(handle.getAttribute('data-column-index'), 10);

  if ( state ) {
    let natural = measureNaturalWidths(state.table, state.headerRow, state.widthHints);

    state.widths = resizeWidths(state.widths, index, natural[index]);
    state.manual = true;
    this.applyWidths(state);
  }

  event.preventDefault();
  event.stopImmediatePropagation();
};

TableColumnManager.prototype.onHandleKeyDown = function(event) {
  let handle = this.handleForEvent(event);

  if ( !handle || ['ArrowLeft', 'ArrowRight', 'Enter'].indexOf(event.key) === -1 ) {
    return;
  }

  let state = this.stateForHandle(handle);
  let index = parseInt(handle.getAttribute('data-column-index'), 10);

  if ( !state ) {
    return;
  }

  if ( event.key === 'Enter' ) {
    let natural = measureNaturalWidths(state.table, state.headerRow, state.widthHints);

    state.widths = resizeWidths(state.widths, index, natural[index]);
  } else {
    let direction = event.key === 'ArrowRight' ? 1 : -1;
    let step = event.shiftKey ? KEYBOARD_LARGE_STEP : KEYBOARD_STEP;

    state.widths = resizeWidths(state.widths, index, state.widths[index] + direction * step);
  }

  state.manual = true;
  this.applyWidths(state);
  event.preventDefault();
  event.stopImmediatePropagation();
};

TableColumnManager.prototype.onMutations = function(mutations) {
  mutations.forEach((mutation) => {
    let added = Array.prototype.slice.call(mutation.addedNodes || []);
    let managerOnly = added.length && added.every((node) => managerNode(node));

    added.forEach((node) => {
      if ( node.nodeType !== 1 || managerNode(node) ) {
        return;
      }

      if ( node.matches && node.matches(TABLE_SELECTOR) ) {
        this.schedule(node, true);
      }

      if ( node.querySelectorAll ) {
        let tables = node.querySelectorAll(TABLE_SELECTOR);

        Array.prototype.forEach.call(tables, (table) => this.schedule(table, true));
      }
    });

    if ( !managerOnly ) {
      let table = closestManagedTable(mutation.target);

      if ( table ) {
        this.schedule(table, true);
      }
    }
  });
};

TableColumnManager.prototype.onWindowResize = function() {
  this.window.clearTimeout(this.resizeTimer);
  this.resizeTimer = this.window.setTimeout(() => {
    this.scan();

    let tables = this.document.querySelectorAll(`${TABLE_SELECTOR}[${MANAGED_ATTRIBUTE}="true"]`);

    Array.prototype.forEach.call(tables, (table) => {
      let state = this.states.get(table);

      if ( state ) {
        this.schedule(table, !state.manual);
      }
    });
  }, 150);
};

export function startResizableTableColumns(targetWindow = window, targetDocument = document) {
  if ( activeManager ) {
    return activeManager;
  }

  activeManager = new TableColumnManager(targetWindow, targetDocument).start();

  return activeManager;
}
