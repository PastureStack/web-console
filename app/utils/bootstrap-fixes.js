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
    left: 0,
    right: 'auto'
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

export function avoidDropdownTriggerOverlap(menu, selector = '.more-actions', gap = 4) {
  var $menu = $(menu);
  var menuElement = $menu[0];

  if ( !menuElement ) {
    return null;
  }

  var menuRect = menuElement.getBoundingClientRect();
  if ( !menuRect.width || !menuRect.height ) {
    return null;
  }

  var overlappingTriggers = Array.from(document.querySelectorAll(selector))
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width && rect.height &&
      rect.left < menuRect.right && rect.right > menuRect.left &&
      rect.top < menuRect.bottom && rect.bottom > menuRect.top);

  if ( !overlappingTriggers.length ) {
    return null;
  }

  // A shared action menu can be taller than a table row and cover the next
  // row's ellipsis button.  Keep the menu beside that button column so a
  // direct switch always reaches the intended trigger instead of executing
  // whichever action happens to be painted over it.
  var targetLeft = Math.min(...overlappingTriggers.map((rect) => rect.left)) - menuRect.width - gap;
  if ( targetLeft < gap ) {
    targetLeft = Math.max(...overlappingTriggers.map((rect) => rect.right)) + gap;
  }

  if ( targetLeft < gap || targetLeft + menuRect.width > window.innerWidth - gap ) {
    return null;
  }

  var currentLeft = parseFloat($menu.css('left'));
  if ( Number.isNaN(currentLeft) ) {
    currentLeft = menuRect.left;
  }

  $menu.css('left', `${currentLeft + targetLeft - menuRect.left}px`);
  return targetLeft;
}

export default {
  resizeDropdown: resizeDropdown,
  positionDropdown: positionDropdown,
  avoidDropdownTriggerOverlap: avoidDropdownTriggerOverlap,
};
