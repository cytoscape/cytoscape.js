import { inspect } from 'node:util';

/**
 * A JSON.stringify replacer that writes a repeated object as '[Circular]'.
 * A hook's spawn error can reference itself (round 151: `npm` failing to
 * start on Windows), and one throw here lost the whole file's results.
 */
const acyclic = () => {
  const seen = new WeakSet();

  return (key, value) => {
    if (typeof value !== 'object' || value === null) return value;
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    return value;
  };
};

/** Emit node:test's structured stream as one JSON record per event. */
export default async function* nodeTestEventsReporter(source) {
  for await (const event of source) {
    const error =
      event.type === 'test:complete' ? event.data?.details?.error : undefined;

    yield (
      JSON.stringify(
        {
          ...event,
          ...(error == null
            ? {}
            : {
                data: {
                  ...event.data,
                  formattedError: inspect(error, {
                    depth: 5,
                    breakLength: Infinity,
                  }),
                },
              }),
        },
        acyclic(),
      ) + '\n'
    );
  }
}
