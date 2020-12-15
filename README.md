<p align="center">
<img src="logo.png" align="center" height="110px" width="110px">
</p>
<h2 align="center">
<strong>Web Assembly Text Improved!</strong>
</h2>

WATI is an improved syntax for hand writing WebAssembly text format.

## Supported Features
### Instructions
 - Inline function arguments: `call $fn(1i32, 2i32)`
 - Get variables without `.get`: `$a`
 - Set variables without `.set`: `$a = $b`
 - Make constants without `.const`: `10i32`, `1.5f32`
 - Make parameters without `(param`: `($a i32)`
 - Make locals without `(local`: `(l$a i32)`
### Quality of Life
 - Auto completion and type information for variables and functions
 - Auto completion for most instructions
 - Docs and type information on hover
 - See type information on a function when calling it
### Documentation
 - JSDoc Tags
 - Rich color for @param tags
 - Rich color for function-related tags (e.g. @function)
 - Highlighting of @todo