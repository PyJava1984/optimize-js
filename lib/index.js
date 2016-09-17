'use strict'

var acorn = require('acorn')
var walk = require('walk-ast')
var MagicString = require('magic-string')

function optimizeJs (jsString, opts) {
  opts = opts || {}
  var ast = acorn.parse(jsString)
  var magicString = new MagicString(jsString)

  function walkIt (node) {
    if (node.type === 'FunctionExpression') {
      handleFunctionExpression(node)
    }
  }

  function handleFunctionExpression (node) {
    var prePreChar = jsString.charAt(node.start - 2)
    var preChar = jsString.charAt(node.start - 1)
    var postChar = jsString.charAt(node.end)
    var postPostChar = jsString.charAt(node.end + 1)

    // assuming this node is an argument to a function, return true if it itself
    // is already padded with parentheses
    function isPaddedArgument (node) {
      var idx = node.parentNode.arguments.indexOf(node)
      if (idx === 0) { // first arg
        if (prePreChar === '(' && preChar === '(' && postChar === ')') { // already padded
          return true
        }
      } else if (idx === node.parentNode.arguments.length - 1) { // last arg
        console.log('last1')
        if (preChar === '(' && postChar === ')' && postPostChar === ')') { // already padded
          console.log('i am padded')
          return true
        }
      } else { // middle arg
        if (preChar === '(' && postChar === ')') { // already padded
          return true
        }
      }
      return false
    }

    console.log('nother function')
    console.log(node.id && node.id.name)
    console.log('parnet node type', node.parentNode.type)

    if (preChar === '!' && postChar === '(') {
      console.log('uglify-style')
      // uglify-style !function(){}() expression
      // these are _always_ executed
      magicString.overwrite(node.start - 1, node.start, '(')
        .insertRight(node.end, ')')
    } else if (node.parentNode &&
        node.parentNode.type === 'CallExpression' &&
        node.parentNode.arguments.length &&
        node.parentNode.arguments.indexOf(node) !== -1) {
      // function passed in to another function. these are almost _always_ executed, e.g.
      // UMD bundles, Browserify bundles, Node-style errbacks, Promise then()s and catch()s, etc.
      if (!isPaddedArgument(node)) {
        console.log('not padded')
        magicString = magicString.insertLeft(node.start, '(')
          .insertRight(node.end, ')')
      }
    }
  }

  walk(ast, walkIt)
  var out = magicString.toString()
  if (opts.sourceMap) {
    out += '\n//# sourceMappingURL=' + magicString.generateMap().toUrl()
  }
  return out
}

module.exports = optimizeJs