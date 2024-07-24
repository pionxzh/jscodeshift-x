
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

const testUtils = require('../../utils/testUtils');

const createTransformWith = testUtils.createTransformWith;
const createTempFileWith = testUtils.createTempFileWith;
const getFileContent = testUtils.getFileContent;

describe('Worker API', () => {
  it('transforms files', done => {
    const worker = require('../Worker');
    const transformPath =
      createTransformWith('return fileInfo.source + " changed";');
    const sourcePath = createTempFileWith('foo');
    const emitter = worker([transformPath]);

    emitter.send({files: [sourcePath]});
    emitter.once('message', (data) => {
      expect(data.status).toBe('ok');
      expect(data.msg).toBe(sourcePath);
      expect(getFileContent(sourcePath)).toBe('foo changed');
      done();
    });
  });

  it('passes j as argument', done => {
    const worker = require('../Worker');
    const transformPath = createTempFileWith(
      `module.exports = function (file, api) {
        return api.j(file.source).toSource() + ' changed';
       }`
    );
    const sourcePath = createTempFileWith('const x = 10;');

    const emitter = worker([transformPath]);
    emitter.send({files: [sourcePath]});
    emitter.once('message', (data) => {
      expect(data.status).toBe('ok');
      expect(getFileContent(sourcePath)).toBe(
        'const x = 10;' + ' changed'
      );
      done();
    });
  });

  describe('custom parser', () => {
    function getTransformForParser(parser) {
      return createTempFileWith(
        `function transform(fileInfo, api) {
          api.jscodeshift(fileInfo.source);
          return "changed";
         }
         ${parser ? `transform.parser = '${parser}';` : ''}
         module.exports = transform;
        `
      );
    }
    function getSourceFile() {
      // This code cannot be parsed by Babel v5
      return createTempFileWith(
         'const x = (a: Object, b: string): void => {}'
      );
    }

    it('errors if new flow type code is parsed with babel v5', done => {
      const worker = require('../Worker');
      const transformPath = createTransformWith(
        'api.jscodeshift(fileInfo.source); return "changed";'
      );
      const sourcePath = getSourceFile();
      const emitter = worker([transformPath]);

      emitter.send({files: [sourcePath]});
      emitter.once('message', (data) => {
        expect(data.status).toBe('error');
        expect(data.msg).toMatch('SyntaxError');
        done();
      });
    });

    ['babylon'].forEach(parser => {
      it(`uses ${parser} if configured as such`, done => {
        const worker = require('../Worker');
        const transformPath = getTransformForParser(parser);
        const sourcePath = getSourceFile();
        const emitter = worker([transformPath]);

        emitter.send({files: [sourcePath]});
        emitter.once('message', (data) => {
          expect(data.status).toBe('ok');
          expect(getFileContent(sourcePath)).toBe('changed');
          done();
        });
      });
    });

    ['babylon', 'tsx'].forEach(parser => {
      it(`can parse JSX with ${parser}`, done => {
        const worker = require('../Worker');
        const transformPath = getTransformForParser(parser);
        const sourcePath = createTempFileWith(
          'var component = <div>{foobar}</div>;'
        );
        const emitter = worker([transformPath]);

        emitter.send({files: [sourcePath]});
        emitter.once('message', (data) => {
          expect(data.status).toBe('ok');
          expect(getFileContent(sourcePath)).toBe('changed');
          done();
        });
      });
    });
  });
});
