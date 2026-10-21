---
title: AI coding agents
description: How to give a coding agent the CodePad API through the agent skill and the plain text docs.
sidebar_position: 8
---

CodePad ships an agent skill and a plain text copy of these docs, so a coding agent can add an editor to your app without guessing the API.

## Agent skill

The skill shows an agent how to install CodePad and set up `CodeEditor`, and lists the mistakes that come from treating the editor as a `TextInput`. Install it in your project with the `skills` command-line tool:

```sh
npx skills add SectionTN/react-native-codepad
```

The command prompts for the agents to set it up for. Agents that read the Agent Skills format, such as Claude Code, Codex and Cursor, load it when a task mentions a code editor, `CodeEditor` or a language package.

The skill covers installation, the props, ref methods and events, themes, search, the keyboard toolbar and an editor nested in a `ScrollView`. For anything else it sends the agent to `node_modules/react-native-codepad/src/types.ts`, which ships with the package and always matches the installed version.

Run `npx skills update` to get the latest version of the skill.

## Plain text docs

The site publishes the docs as plain text for agents and chat tools that read a URL:

- [`llms.txt`](https://reactnativecodepad.pages.dev/llms.txt) lists every page with a one-line description.
- [`llms-full.txt`](https://reactnativecodepad.pages.dev/llms-full.txt) contains every page in one file.

Give an agent the second URL when you want it to answer from the whole documentation.
