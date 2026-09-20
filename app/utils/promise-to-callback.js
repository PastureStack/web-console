import { resolve } from 'rsvp';

// Adapt one deferred unit of work to the error-first callback contract used by
// async.auto/eachLimit. Keeping the factory inside an RSVP turn converts a
// synchronous throw into an ordinary rejection and also adopts plain values,
// thenables, and Promises through one path.
export default function promiseToCallback(taskFactory, callback) {
  return resolve().then(taskFactory).then(
    (result) => callback(null, result),
    (error) => callback(error, null)
  );
}
