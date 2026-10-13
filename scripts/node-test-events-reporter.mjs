import { inspect } from 'node:util';

/** Emit node:test's structured stream as one JSON record per event. */
export default async function* nodeTestEventsReporter(source) {
  for await (const event of source) {
    const error =
      event.type === 'test:complete' ? event.data?.details?.error : undefined;

    yield (
      JSON.stringify({
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
      }) + '\n'
    );
  }
}
