Write "question: answer" flashcards in a YAML file, and grade yourself when you review them by inserting a comment.
This tool keeps track of reviews and re-organizes the cards using a [spaced repetition](https://en.wikipedia.org/wiki/Spaced_repetition) scheduling algorithm.

```yaml
# New cards

YAML stands for ___: Your Adaptive Memory Library

Pronounce "Laufey": # answer is optional

Shuffle a list in Python: |
  import random
  random.shuffle(my_list)

# Thursday, 6 May 2025

Spaced Repetion = ___ + ___: #
  - answer: testing + time
    source: https://ncase.me/remember/
  - 2025-04-27 16:42:59+2: good
    2025-04-25 14:17:33+2: hard
```

In your editor, use **Fold All** to hide everything but the questions!

# Install (requires [Node.js](https://nodejs.org/en/download))

`npm install -g msrs`

# Find a workflow that works for you

Inserting grades

- `location: start` using up/down and **Toggle Fold**

- `location: end` using the mouse to unfold and position the cursor

- `location: inside` with `placeholder: GRD` using **Find next**

Running the tool

- In a terminal, run `msrs file.yaml`

- Configure a task (see [.vscode/tasks.json](.vscode/tasks.json))
  - Use **Run Task** dialog
  - Set as default build task and use **Run Build Task**
  - Set a custom shortcut
    ```json
    // keybindings.json
    {
      "key": "F9",
      "command": "workbench.action.tasks.runTask",
      "args": { "task": "Monospaced Repetition" }
    }
    ```

# Editor config

| Feature     | VSCode  | Zed     | Sublime     | Vim  |
| ----------- | ------- | ------- | ----------- | ---- |
| Toggle fold | `^K ^L` | `^K ^L` | `^⇧[` `^⇧]` | `za` |
| Fold all    | `^K ^0` | `^K ^0` | `^K ^1`     | `zM` |
| Unfold all  | `^K ^J` | `^K ^J` | `^K ^J`     | `zR` |

## Vim

`:set foldmethod=indent`  
`:set foldtext=`: hide the content of the fold

# Hack

1. Install local dependencies with `npm install`
2. Run using
   - `node src/cli.js <file>`
   - `npm link` to install the `msrs` command
     - `msrs <file>`
