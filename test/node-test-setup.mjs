import {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  it
} from 'node:test';

const callbackContext = {
  timeout() {}
};

const supportDoneCallback = fn => {
  if (fn == null || fn.length === 0) {
    return fn;
  }

  return (_testContext, done) => {
    fn.call(callbackContext, done);
  };
};

const wrap = testFunction => {
  const wrapped = (name, options, fn) => {
    if (typeof options === 'function') {
      return testFunction(name, supportDoneCallback(options));
    }

    return testFunction(name, options, supportDoneCallback(fn));
  };

  wrapped.only = (name, options, fn) => {
    if (typeof options === 'function') {
      return testFunction.only(name, supportDoneCallback(options));
    }

    return testFunction.only(name, options, supportDoneCallback(fn));
  };

  wrapped.skip = testFunction.skip.bind(testFunction);

  return wrapped;
};

Object.assign(globalThis, {
  after: fn => after(supportDoneCallback(fn)),
  afterEach: fn => afterEach(supportDoneCallback(fn)),
  before: fn => before(supportDoneCallback(fn)),
  beforeEach: fn => beforeEach(supportDoneCallback(fn)),
  describe,
  it: wrap(it)
});
