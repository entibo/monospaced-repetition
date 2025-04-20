# Prerequisites

- a text editor that supports code folding
- [Node.js](https://nodejs.org/en/download)

`location: start` keeps the ratings aligned for easy up/down navigation

`location: end` plays well with the mouse in VSCode

`location: inside` with `placeholder: XXX` allows navigating with a `Find next` shortcut

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
