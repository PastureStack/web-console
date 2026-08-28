export function resizeDropdown(event) {
  // Preserve compatibility with existing signature
  var $item = $('.dropdown-menu', event.target);
  var target = event.relatedTarget;

  // Bootstrap 5 emits shown.bs.dropdown from the toggle itself, while this
  // legacy helper expects the containing dropdown. Bootstrap already positions
  // that menu with Popper, so leave it alone instead of dereferencing an empty
  // PositionCalculator result.
  if ( !$item.length || !target ) {
    return null;
  }

  var right = $item.hasClass('dropdown-menu-end');
  return positionDropdown($item, target, right);
}

export function positionDropdown(menu, trigger, right) {
  // https://github.com/twbs/bootstrap/issues/10756#issuecomment-41041800
  var direction = (right === true ? 'right' : 'left');
  var $menu = $(menu);

  // reset position
  menu.css({
    top: 0,
    left: 0
  });

  // calculate new position
  var calculator = new $.PositionCalculator({
    item: $menu,
    target: trigger,
    itemAt: 'top ' + direction,
    itemOffset: {
      y: 3,
      x: 0,
      mirror: true
    },
    targetAt: 'bottom ' + direction,
    flip: 'both'
  });
  var posResult = calculator.calculate();

  if ( !posResult || !posResult.moveBy ) {
    return null;
  }

  // set new position
  $menu.css({
    top: posResult.moveBy.y + 'px',
    left: posResult.moveBy.x + 'px'
  });
  return null;
}

export default {
  resizeDropdown: resizeDropdown,
  positionDropdown: positionDropdown
};
