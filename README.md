# TODO

publish to github

# Description

you need a text editor that supports code folding

`location: start` keeps the ratings aligned for easy up/down navigation

`location: end` plays well with the mouse in VSCode

`location: inside` with `placeholder: XXX` allows navigating with a `Find next` shortcut

# Install (requires [Node.js](https://nodejs.org/en/download))

`npm install -g msrs`

# Editor config

| Feature     | VSCode  | Zed     | Sublime     | Vim  |
| ----------- | ------- | ------- | ----------- | ---- |
| Toggle fold | `^K ^L` | `^K ^L` | `^⇧[` `^⇧]` | `za` |
| Fold all    | `^K ^0` | `^K ^0` | `^K ^1`     | `zM` |
| Unfold all  | `^K ^J` | `^K ^J` | `^K ^J`     | `zR` |

## Run as task?

## Vim

`:set foldmethod=indent`  
`:set foldtext=`: hide the content of the fold

# Hack

Install local dependencies with `npm install`  
Run using `node src/cli.js <file>`  
Or use `npm link` to install the global command `msrs <file>`
