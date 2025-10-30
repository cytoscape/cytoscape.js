const { expect } = require('chai');
const { createRendererErrorsAPI, safeNormalizeError, RENDER_ERROR_EVENT } = require('../src/renderer-errors-api.js');

describe('renderer-errors-api', () => {
  it('emitting an error triggers event handlers and callbacks', () => {
    const api = createRendererErrorsAPI();
    const eventCalls = [];
    const cbCalls = [];

    const eventSpy = (p) => eventCalls.push(p);
    const cbSpy = (p) => cbCalls.push(p);

    api.on(RENDER_ERROR_EVENT, eventSpy);
    api.onRenderError(cbSpy);

    const inputErr = new Error('boom');
    const normalized = api.emitRenderError(inputErr);

    expect(eventCalls.length).to.equal(1);
    expect(cbCalls.length).to.equal(1);
    expect(eventCalls[0]).to.equal(normalized);
    expect(cbCalls[0]).to.equal(normalized);

    expect(normalized.message).to.equal('boom');
    expect(normalized.original).to.equal(inputErr);
  });

  it('getLastRenderError returns the last error emitted', () => {
    const api = createRendererErrorsAPI();
    expect(api.getLastRenderError()).to.equal(null);

    api.emitRenderError('first');
    const first = api.getLastRenderError();
    expect(first).to.not.equal(null);
    expect(first.message).to.equal('first');

    const err = new Error('second');
    api.emitRenderError(err);
    const second = api.getLastRenderError();
    expect(second).to.not.equal(null);
    expect(second.message).to.equal('second');
    expect(second.original).to.equal(err);
  });

  it('removing callback and event handler stops receiving errors', () => {
    const api = createRendererErrorsAPI();
    const eventCalls = [];
    const cbCalls = [];

    const eventSpy = (p) => eventCalls.push(p);
    const cbSpy = (p) => cbCalls.push(p);

    api.on(RENDER_ERROR_EVENT, eventSpy);
    api.onRenderError(cbSpy);

    api.emitRenderError('once');
    expect(eventCalls.length).to.equal(1);
    expect(cbCalls.length).to.equal(1);

    api.off(RENDER_ERROR_EVENT, eventSpy);
    api.offRenderError(cbSpy);

    api.emitRenderError('twice');
    expect(eventCalls.length).to.equal(1);
    expect(cbCalls.length).to.equal(1);
  });

  it('normalization: Error instance', () => {
    const e = new Error('oh no');
    e.code = 'E_RENDER';
    e.meta = { stage: 'draw' };
    const n = safeNormalizeError(e);
    expect(n.message).to.equal('oh no');
    expect(typeof n.stack === 'string' || n.stack === undefined).to.equal(true);
    expect(n.code).to.equal('E_RENDER');
    expect(n.meta).to.deep.equal({ stage: 'draw' });
    expect(n.original).to.equal(e);
  });

  it('normalization: string', () => {
    const n = safeNormalizeError('kaput');
    expect(n.message).to.equal('kaput');
    expect(n.stack).to.equal(undefined);
    expect(n.original).to.equal('kaput');
  });

  it('normalization: plain object', () => {
    const input = { message: 'bad', code: 500, stack: 's', extra: 1, meta: { a: 2 } };
    const n = safeNormalizeError(input);
    expect(n.message).to.equal('bad');
    expect(n.stack).to.equal('s');
    expect(n.code).to.equal(500);
    expect(n.meta).to.deep.equal({ a: 2 });
    expect(n.original).to.deep.equal(input);
  });

  it('handlers throwing do not affect others or crash emit', () => {
    const api = createRendererErrorsAPI();
    const calls = [];
    api.on(RENDER_ERROR_EVENT, () => {
      calls.push('first:event');
      throw new Error('handler fail');
    });
    api.on(RENDER_ERROR_EVENT, () => {
      calls.push('second:event');
    });
    api.onRenderError(() => {
      calls.push('cb');
      throw new Error('cb fail');
    });

    expect(() => api.emitRenderError('x')).to.not.throw();
    expect(calls).to.deep.equal(['first:event', 'second:event', 'cb']);
  });
});


