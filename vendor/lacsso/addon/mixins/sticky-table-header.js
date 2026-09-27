import $ from 'jquery';
import Mixin from '@ember/object/mixin';
import ThrottledResize from './throttled-resize';

const tableProps = {
  actionsHeight: '60px',
  fixedHeaderHeight: '40px',
};

export default Mixin.create(ThrottledResize, {
  didInsertElement() {
    this._super(...arguments);

    let $offset = $(this.element).find('thead tr').offset().top;

    this.buildTableWidths();

    this._boundStickyWindowScroll = () => {
      this.updateHeaders($offset);
      this.syncHorizontalPosition();
    };
    this._boundStickyHostScroll = () => {
      this.syncHorizontalPosition();
    };

    $(window).on('scroll', this._boundStickyWindowScroll);
    let host = $(this.element).find('table').parent()[0];
    $(host).on('scroll', this._boundStickyHostScroll);
    let ResizeObserver = host && host.ownerDocument.defaultView.ResizeObserver;
    if ( ResizeObserver ) {
      this._stickyHostObserver = new ResizeObserver(() => this.onResize());
      this._stickyHostObserver.observe(host);
    }
  },

  willDestroyElement() {
    $(window).off('scroll', this._boundStickyWindowScroll);
    $(this.element).find('table').parent().off('scroll', this._boundStickyHostScroll);
    if ( this._stickyHostObserver ) {
      this._stickyHostObserver.disconnect();
      this._stickyHostObserver = null;
    }
    this._boundStickyWindowScroll = null;
    this._boundStickyHostScroll = null;
    this._super(...arguments);
  },

  onResize() {
    let view = this.element && this.element.ownerDocument.defaultView;
    if ( view && view.matchMedia('(max-width: 694px)').matches ) {
      this.tearDownTableWidths();
      this.removePositions();
      return;
    }
    this.buildTableWidths();
    let $fixedHeader = $(this.element).find('table thead tr.fixed-header');

    if ( $fixedHeader[0] && $fixedHeader[0].style.position === 'fixed' ) {
      this.positionHeaders();
    } else {
      this.syncHorizontalPosition();
    }
  },

  buildTableWidths() {
    let $table = $(this.element).find('table').first();
    let ths = $table.find('thead tr.fixed-header th');

    $table.find('thead tr.fixed-header-placeholder th').each((idx, th) => {
      $(ths[idx]).attr('width', $(th).outerWidth());
    });

    $table.find('thead tr.fixed-header').css({
      'width': $table.width(),
    });

    if ( this.get('showHeader') ) {
      let $actionRow = $table.find('thead .fixed-header-actions');
      let host = $table.parent()[0];
      // Controls belong to the visible scroll host, not the wider table.
      let width = host ? host.clientWidth : $table.width();

      $actionRow.css({'width': width});
    }
  },

  tearDownTableWidths() {
    $(this.element).find('thead tr.fixed-header th').each((idx, td) => {
      $(td).removeAttr('width');
    });
  },

  positionHeaders() {
    let $table = $(this.element).find('table').first();
    let $actionRow = $table.find('thead .fixed-header-actions');
    let $fixedHeader = $table.find('thead tr.fixed-header');
    let showHeader = this.get('showHeader');
    let actionHeight = 0;

    if ( showHeader ) {
      let host = $table.parent()[0];
      $actionRow.css({
        'position': 'fixed',
        'top': 0,
        // Override any logical inset while fixed, including RTL.
        'right': 'auto',
        'height': 'auto',
        'width': host ? host.clientWidth : $table.width(),
      });
      actionHeight = Math.max(parseInt(tableProps.actionsHeight, 10),
        Math.ceil($actionRow.outerHeight()));
      $actionRow.css('height', `${actionHeight}px`);
    }
    $fixedHeader.css({
      'position': 'fixed',
      'top': actionHeight,
      'height': tableProps.fixedHeaderHeight,
    });

    $table.css({
      'margin-top': (actionHeight + parseInt(tableProps.fixedHeaderHeight, 10)) + 'px'
    });
    this.syncHorizontalPosition();
  },

  removePositions() {
    let $table = $(this.element).find('table').first();
    let $actionRow = $table.find('thead .fixed-header-actions');
    let $fixedHeader = $table.find('thead tr.fixed-header');

    if ( this.get('showHeader') ) {
      $actionRow.css({
        'position': 'relative',
        'top': '',
        'height': '',
        'left': '',
        'right': '',
      });
    }

    $fixedHeader.css({
      'position': '',
      'top': '',
      'left': '',
      'transform': '',
    });
    $table.css({
      'margin-top': ''
    });
    this.buildTableWidths();
  },

  syncHorizontalPosition() {
    let $table = $(this.element).find('table').first();
    let $host = $table.parent();
    let host = $host[0];
    let $actionRow = $table.find('thead .fixed-header-actions');
    let $fixedHeader = $table.find('thead tr.fixed-header');

    if ( !host ) {
      return;
    }

    if ( $fixedHeader.css('position') !== 'fixed' ) {
      // The action row is inside THEAD; CSS sticky does not keep it visible
      // when the whole wide table scrolls. Counter-scroll with a physical
      // offset, preserving dropdown positioning (no transform containing block).
      if ( this.get('showHeader') ) {
        $actionRow.css({
          'left': `${host.scrollLeft}px`,
          'width': `${host.clientWidth}px`,
        });
      }
      return;
    }

    let hostRect = host.getBoundingClientRect();
    let tableRect = $table[0].getBoundingClientRect();

    $fixedHeader.css({
      // The table's physical left edge includes RTL's initial overflow
      // offset as well as scrollLeft. Following that edge keeps TH aligned
      // with TD in both writing directions.
      'left': `${tableRect.left}px`,
      'transform': '',
      'width': `${$table.outerWidth()}px`,
    });

    if ( this.get('showHeader') ) {
      $actionRow.css({
        'left': `${hostRect.left}px`,
        'right': 'auto',
        'width': `${host.clientWidth}px`,
      });
    }
  },

  updateHeaders(offset) {
    let $windowScroll = $(window).scrollTop();
    let $table = $(this.element).find('table').first();
    let $floatingHeader = $table.find('thead tr.fixed-header');
    let $scrollTop = $(window).scrollTop();
    let containerBottom = $table.height() + $table.offset().top;

    if ( $windowScroll < containerBottom ) {
      if ( $scrollTop > offset ) {
        this.buildTableWidths();
        this.positionHeaders();
      } else if ( $scrollTop <= offset ) {
        this.tearDownTableWidths();
        this.removePositions();
      }
    } else if ( $floatingHeader.css('position') === 'fixed' ) {
      this.tearDownTableWidths();
      this.removePositions();
    }
  }
});
