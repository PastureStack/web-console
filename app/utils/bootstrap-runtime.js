import * as Bootstrap from 'bootstrap';

export default function installBootstrapRuntime() {
  // app.import() placed Bootstrap's UMD bundle in the vendor output without
  // executing it. Import the maintained ESM runtime and publish the namespace
  // used by the existing header compatibility code.
  window.bootstrap = Bootstrap;

  return Bootstrap;
}
