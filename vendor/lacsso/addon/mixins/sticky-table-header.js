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
    $(this.element).find('table').parent().on('scroll', this._boundStickyHostScroll);
  },

  willDestroyElement() {
    $(window).off('scroll', this._boundStickyWindowScroll);
    $(this.element).find('table').parent().off('scroll', this._boundStickyHostScroll);
    this._boundStickyWindowScroll = null;
    this._boundStickyHostScroll = null;
    this._super(...arguments);
  },

  onResize() {
    this.buildTableWidths();
    this.syncHorizontalPosition();
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
      let width = $actionRow.css('position') === 'fixed' && host ? host.clientWidth : $table.width();

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

    if ( showHeader ) {
      $actionRow.css({
        'position': 'fixed',
        'top': 0,
        'height': tableProps.actionsHeight,
      });
    }
    $fixedHeader.css({
      'position': 'fixed',
      'top': showHeader ? tableProps.actionsHeight : 0,
      'height': tableProps.fixedHeaderHeight,
    });

    $table.css({
      'margin-top': (parseInt(tableProps.actionsHeight, 10) + parseInt(tableProps.fixedHeaderHeight, 10)) + 'px'
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
        'left': '',
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

    if ( !host || $fixedHeader.css('position') !== 'fixed' ) {
      return;
    }

    let hostRect = host.getBoundingClientRect();

    $fixedHeader.css({
      'left': `${hostRect.left}px`,
      'transform': `translateX(${-host.scrollLeft}px)`,
      'width': `${$table.outerWidth()}px`,
    });

    if ( this.get('showHeader') ) {
      $actionRow.css({
        'left': `${hostRect.left}px`,
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
