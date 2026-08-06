export default function inertRenderer() {
  return {
    _destinedForDOM: false,
    getElement() {
      return null;
    },
    register() {},
    remove() {},
    rerender() {},
    unregister() {},
  };
}
