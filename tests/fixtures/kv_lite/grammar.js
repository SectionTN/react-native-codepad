/**
 * @file A tiny key = value language that tests the custom language command.
 * @license MIT
 */

module.exports = grammar({
  name: 'kv_lite',

  extras: ($) => [/\s/, $.comment],

  rules: {
    document: ($) => repeat($.pair),

    pair: ($) =>
      seq(field('key', $.key), '=', field('value', choice($.string, $.number, $.boolean))),

    key: (_) => /[A-Za-z_][A-Za-z0-9_.-]*/,

    string: (_) => /"[^"\n]*"/,

    number: (_) => /-?\d+(\.\d+)?/,

    boolean: (_) => choice('true', 'false'),

    comment: (_) => /#[^\n]*/,
  },
});
