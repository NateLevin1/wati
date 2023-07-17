# WATI: WebAssembly Text Format Improved!

[![Version](https://img.shields.io/visual-studio-marketplace/v/natelevin.wati?label=Version%3A)](https://marketplace.visualstudio.com/items?itemName=natelevin.wati)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/natelevin.wati?label=Installs%3A)](https://marketplace.visualstudio.com/items?itemName=natelevin.wati)

WATI provides code completion, intellisense, and hover information for the WebAssembly Text Format (`.wat` files).

![Demo of hover and code completion provided by WATI](https://raw.githubusercontent.com/NateLevin1/wati/main/extension/demo.gif)

## Features

### Quality of Life

-   Auto completion and type information for variables and functions
-   Auto completion for most instructions
-   Docs and type information on hover
-   See type information on a function when calling it (signatures)
-   Magical emmet-like completions:
    -   Easily create constants: `5i32` -> `(i32.const 5)`, `30.12f64` -> `(f64.const 30.12)`, `100_000i64` -> `(i64.const 100000)`
    -   Access local and global variables easily, with autocompletion: `l$someLocal` -> `(local.get $someLocal)`, `g$someGlobal` -> `(global.get $someGlobal)`
    -   Set local and global variables with autocompletion: `l=$someLocal` -> `(local.set $someLocal |)`, `g=$someGlobal` -> `(global.set $someGlobal |)`

### Documentation

-   JSDoc Tags
-   Rich color for @param tags
-   Rich color for function-related tags (e.g. @function)
-   Highlighting of @todo

## Extension Settings

-   `wati.useIntellisenseInWatFiles`: If true, WATI
    intellisense (hover, completion, signatures) will be used
    in WAT files. (Defaults to true)

> **Note**
> This extension also adds support for the .wati language. The .wati language is deprecated and is not recommended for use.

## Release Notes

### 1.1.4

New emmet-like WAT completions are now available. These new completions allow you to quickly write WAT code with fewer keystrokes!

### 1.0.3

**Greatly improved code comprehension**: Much more accurate variable recognition, display global initial values, completion and hover information for block labels.

Also adds more documentation and deprecate .wati support.

## 1.0.2

Fix issues regarding hover and signature information with newlines in function definitions

### 1.0.1

Default intellisense use in WAT files to true.

### 1.0.0

Initial release.

## Requirements

No other extensions are required, though for the WAT intellisense you will need to have the
[WebAssembly extension](https://marketplace.visualstudio.com/items?itemName=dtsvet.vscode-wasm).
