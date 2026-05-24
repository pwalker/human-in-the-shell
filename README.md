# human-in-the-shell

A thin CLI wrapper around [Pi](https://pi.dev) for Human-in-the-Shell coding workflows.  A key difference between this agent and any others you might be used to is that this one doesn't have tools to allow it to write or edit files.

## Why?

I built this experiment because I wanted to different way of working with AI tools when I'm developing.  There are plenty of nice things about AI agents whether it's help when planning, researching a codebase, or summarizing what's going on.  However, I often myself want to be closer to the code.  This tool helps me do just that, it _won't_ write anything for me!

So far, my personal results have been encouraging.  I find that a cycle develops where I don't need to specify as much in the prompts (since I'm getting specific when I write the code), and then the agent can keep me on track towards my goals from whatever tangent I go down.  This back and forth goes one step further than "human-in-the-loop" and I'm calling it "human-in-the-shell".

## Installing

Install this like a global node package:

```bash
npm install -g @peterw-xyz/human-in-the-shell
```

## Usage

```bash
hits
```

This starts a regular `pi` instance in interactive mode (the TUI).

### Mode

`hits` provides a pretty regular Plan / Build mode split.  Some tools are only available in "build" mode, like `request_edit`

```
/mode plan   # a regular planning mode to discuss, inspect, and chat with the model
/mode build  # a normal build mode, but only humans are allowed to edit files
```

### Depth

When the agent wants to make some changes to files, it can't do that.  What it can do however is call the `request_edit` tool.  This tool-call will describe to _you_, via the terminal, what changes to make.  How verbose the agent is when describing what to change is controlled by the "depth".

```
/depth sentence   # a single sentence describe what edits to make
/depth paragraph  # a full paragraph telling you what to change
/depth outline    # a bulleted outline of what to implement
/depth skeleton   # text, with code snippets with blocks of code omitted (i.e. a function signature but the body is comments)
/depth full       # complete desired code to be written from the agent
```

## Related works

- [Slow Mode](https://blog.val.town/slow-mode)
