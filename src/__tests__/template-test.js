
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

const getParser = require('../getParser');

describe.skip('Templates', () => {
  let statements;
  let statement;
  let expression;
  let jscodeshift;

  beforeEach(() => {
    jest.resetModules();

    jscodeshift = require('../core');
    const template = jscodeshift.template;
    expression = template.expression;
    statement = template.statement;
    statements = template.statements;
  });

  it('interpolates expression nodes with source code', () => {

    let input =
`var foo = bar;
if(bar) {
  console.log(42);
}`;

    let expected =
`var foo = alert(bar);
if(alert(bar)) {
  console.log(42);
}`;

    expect(
      jscodeshift(input)
        .find('Identifier', {name: 'bar'})
        .replaceWith(path => expression`alert(${path.node})`)
        .toSource()
    ).toEqual(expected);
  });

  it('interpolates statement nodes with source code', () => {
    let input =
`for (var i = 0; i < 10; i++) {
  console.log(i);
  console.log(i / 2);
}`;

    let expected =
`var i = 0;
while (i < 10) {
  console.log(i);
  console.log(i / 2);
  i++;
}`;

    expect(
      jscodeshift(input)
        .find('ForStatement')
        .replaceWith(
          p => statements`
            ${p.node.init};
            while (${p.node.test}) {
              ${p.node.body.body}
              ${p.node.update};
            }`
        )
        .toSource()
    ).toEqual(expected);
  });

  it('handles out-of-order traversal', () => {
    const input = 'var x';
    const expected = 'class X extends a {f(b) {}}';

    const a = jscodeshift.identifier('a');
    const b = jscodeshift.identifier('b');

    const classDecl = statement`
      class X extends ${a} {f(${b}) {}}
    `;

    expect(
      jscodeshift(input)
        .find('VariableDeclaration')
        .replaceWith(classDecl)
        .toSource()
    )
    .toEqual(expected);
  });
  it('correctly parses expressions without any interpolation', () => {
    const expected = 'function() {}';

    expect(
      jscodeshift(
        expression`function() {}`
      )
      .toSource()
    )
    .toEqual(expected);
  });

  for (const parser of ['babel', 'babylon', 'ts', 'tsx']) {
    it(`asyncExpression correctly parses expressions with await -- ${parser}`, () => {
      const expected = '{\n  bar: await baz\n}'
      const j = jscodeshift.withParser(getParser(parser))

      expect(j(j.template.asyncExpression`{\n  bar: await baz\n}`).toSource()).toEqual(expected)
    })
  }

  describe('explode arrays', () => {

    it('explodes arrays in function definitions', () => {
      let input = 'var foo = [a, b];';
      let expected = 'var foo = function foo(a, b, c) {};';

      expect(
        jscodeshift(input)
          .find('ArrayExpression')
          .replaceWith(
            p => expression`function foo(${p.node.elements}, c) {}`
          )
          .toSource()
      )
      .toEqual(expected);

      expected = 'var foo = function(a, b, c) {};';

      expect(
        jscodeshift(input)
          .find('ArrayExpression')
          .replaceWith(
            p => expression`function(${p.node.elements}, c) {}`
          )
          .toSource()
      )
      .toEqual(expected);

      expected = 'var foo = (a, b) => {};';

      expect(
        jscodeshift(input)
          .find('ArrayExpression')
          .replaceWith(
            p => expression`${p.node.elements} => {}`
          )
          .toSource()
      )
      .toEqual(expected);

      expected = 'var foo = (a, b, c) => {};';

      expect(
        jscodeshift(input)
          .find('ArrayExpression')
          .replaceWith(
            p => expression`(${p.node.elements}, c) => {}`
          )
          .toSource()
      )
      .toEqual(expected);
    });

    it('explodes arrays in variable declarations', () => {
      let input = 'var foo = [a, b];';
      let expected = 'var foo, a, b;';
      expect(
        jscodeshift(input)
          .find('VariableDeclaration')
          // Need to use a block here because the arrow doesn't seem to be
          // compiled with a line break after the return statement. Can't repro
          // outside here though
          .replaceWith(p => {
            const node = p.node.declarations[0];
            return statement`var ${node.id}, ${node.init.elements};`;
          })
          .toSource()
      )
      .toEqual(expected);
    });

    it('explodes arrays in array expressions', () => {
      let input = 'var foo = [a, b];';
      let expected = 'var foo = [a, b, c];';
      expect(
        jscodeshift(input)
          .find('ArrayExpression')
          .replaceWith(p => expression`[${p.node.elements}, c]`)
          .toSource()
      )
      .toEqual(expected);
    });

    it('explodes arrays in object expressions', () => {
      let input = 'var foo = {a, b};';
      let expected = /var foo = \{\s*a,\s*b,\s*c: 42\s*};/;
      expect(
        jscodeshift(input)
          .find('ObjectExpression')
          .replaceWith(p => expression`{${p.node.properties}, c: 42}`)
          .toSource()
      )
      .toMatch(expected);
    });

    it('explodes arrays in call expressions', () => {
      let input = 'var foo = [a, b];';
      let expected = 'var foo = bar(a, b, c);';

      expect(
        jscodeshift(input)
          .find('ArrayExpression')
          .replaceWith(
            p => expression`bar(${p.node.elements}, c)`
          )
          .toSource()
      )
      .toEqual(expected);
    });

  });

});
