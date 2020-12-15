# WATI: WebAssembly Text Format Improved!
WATI is a language extension to WebAssembly Text Format. See all its features [here](https://github.com/UltimatePro-Grammer/wati#readme).

This extension adds WATI language support and
intellisense for WATI and WAT.

## Features
### Quality of Life
 - Auto completion and type information for variables and functions
 - Auto completion for most instructions
 - Docs and type information on hover
 - See type information on a function when calling it (signatures)
### Documentation
 - JSDoc Tags
 - Rich color for @param tags
 - Rich color for function-related tags (e.g. @function)
 - Highlighting of @todo
### Features of WATI
 - Inline function arguments: `call $fn(1i32, 2i32)`
 - Get variables without `.get`: `$a`
 - Set variables without `.set`: `$a = $b`
 - Make constants without `.const`: `10i32`, `1.5f32`
 - Make parameters without `(param`: `($a i32)`
 - Make locals without `(local`: `(l$a i32)`

## Extension Settings
- `wati.useIntellisenseInWatFiles`: If true, WATI 
intellisense (hover, completion, signatures) will be used 
in WAT files. (Defaults to false)

## Release Notes
### 1.0.0
Initial release.

## Requirements
No other extensions are required, though for 
the WAT intellisense you will need to have the 
[WebAssembly extension](https://marketplace.visualstudio.com/items?itemName=dtsvet.vscode-wasm).
