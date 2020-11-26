# wati
**Web Assembly Text Improved!**
<br>
An improved syntax for hand writing WebAssembly text format.


## Supported Features
### Instructions
 - Inline function arguments: `call $fn(1i32, 2i32)`
 - Get variables without `.get`: `$a`
 - Set variables without `.set`: `$a = $b`
 - Make constants without `.const`: `10i32`, `1.5f32`
 - Make parameters without `(param`: `($a i32)`
### Quality of Life
 - Auto completion and type information for variables and functions
 - Auto completion for most instructions
### Documentation
 - JSDoc Tags
 - Rich color for @param tags
 - Rich color for function-related tags (e.g. @function)
 - Highlighting of @todo