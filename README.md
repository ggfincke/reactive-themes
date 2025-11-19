# Reactive Themes for VS Code

> **Status:** Pre-release (v0.0.1)

Reactive Themes is a VS Code extension that automatically switches your color theme based on **context** – the file type you're editing, the workspace you're in, or other rules you define.

The goal is to make your editor feel "alive" and tailored to what you're working on instead of using one static theme for everything.

---

## Installation

### From Source (Development)

This extension is currently in development and not yet published to the VS Code Marketplace.

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/reactive-themes.git
   cd reactive-themes
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Open in VS Code:
   ```bash
   code .
   ```
4. Press `F5` to launch the Extension Development Host
5. Test with the example files in the `examples/` directory

### From Marketplace (Coming Soon!)

Once published, you'll be able to install directly from the VS Code Extensions marketplace.

---

## Quick Start

Get up and running in under a minute:

1. **Install the extension** (see above)
2. **Open VS Code settings** (`Cmd/Ctrl + ,`)
3. **Search for** "Reactive Themes"
4. **Add your first rule:**
   ```json
   "reactiveThemes.rules": [
     {
       "name": "Dark for code, light for docs",
       "when": { "language": "markdown" },
       "theme": "GitHub Light Default"
     },
     {
       "name": "Dark for TypeScript",
       "when": { "language": "typescript" },
       "theme": "Dark+ (default dark)"
     }
   ]
   ```
5. **Open a Markdown file** and watch the theme change automatically!

Use the command **"Reactive Themes: Show Active Rule"** to debug which rule is active.

---

## Why?

VS Code lets you pick one global theme, maybe swap manually a few times a day, and that’s it.

This extension is meant to:

- Use **different themes for different languages** (e.g., one for TS/JS, another for Markdown).
- Use **different themes per project/workspace** (e.g., dark for backend, light for notes).
- Let you define **rules** that react to what you’re doing instead of forcing you to constantly toggle themes by hand.

---

## Features (✅ Implemented)

### Automatic Theme Switching

The extension automatically changes your VS Code color theme based on:

**File-Based Triggers:**
- **Language ID** – Different themes for TypeScript, Markdown, Python, etc.
- **File path patterns** – Glob patterns like `**/docs/**`, `**/*.test.ts`
- **Workspace name** – Different themes per project/workspace folder

**Context-Based Triggers:**
- **Debug sessions** – Switch themes when debugging starts/stops
- **Test execution** – Different themes when tests are running, passed, or failed
- **Timer intervals** – Rotate themes at regular intervals (e.g., every 30 minutes)
- **View modes** – Special themes for diff views, merge conflict resolution, or normal editing

### Rule-Based Configuration

Define declarative rules in VS Code settings:
- Simple `reactiveThemes.rules` array with "when" conditions
- Multiple conditions in a single rule (all must match)
- First-match-wins evaluation strategy
- Optional fallback theme with `reactiveThemes.defaultTheme`

### Commands

Key commands available:

| Command | Description |
|---------|-------------|
| `Reactive Themes: Toggle` | Enable/disable reactive theme switching |
| `Reactive Themes: Reload Rules` | Reload rules after editing settings (also reloads automatically) |
| `Reactive Themes: Show Active Rule` | Debug which rule matched the current file |
| `Reactive Themes: Create Rule from Current File` | Build a rule from the active editor context |
| `Reactive Themes: Manage Rules` | Edit, rename, or delete existing rules |
| `Reactive Themes: Find and Remove Duplicate Rules` | Detect and clean up duplicates |
| `Reactive Themes: Test Rule (Preview)` | Simulate rule matching against current/custom context |
| `Reactive Themes: Lint Rules` | Run linter for duplicates, unreachable, invalid languages, and missing themes |
| `Reactive Themes: Explain Current Theme` | Show why a theme is active (winning rule, context, shadowed/non-matching rules) |
| `Reactive Themes: Copy Theme Explanation to Clipboard` | Copy the full theme explanation as markdown |

### Smart Behavior

- **Debouncing** – 300ms delay prevents rapid theme switching
- **Safe fallback** – Falls back to default theme when no rules match
- **Original theme preservation** – Remembers and restores your original theme when disabled
- **Configuration validation** – Warns you about invalid rules with helpful error messages

---

## Roadmap

### 📋 Planned Features

**Short-Term**
- Named **profiles** (e.g., "Focus Mode", "Presentation Mode") that switch multiple rules at once
- Time-of-day rules (e.g., use a light theme during the day, dark theme at night)
- Quick pick UI to preview profiles / rules and apply them
- Per-workspace override file (e.g. `.reactive-themes.json`) so projects can ship their own suggestions
- Theme rotation for timer rules (cycle through multiple themes)

**Long-Term Ideas**
- Integration with Git branches (different theme per branch)
- "Session modes" (coding vs. writing vs. reviewing)
- Export/import rule sets and share them via a simple JSON format
- Optional status bar item showing the active rule/profile
- Enhanced test framework integration (direct API support vs. task monitoring)
- Custom context providers via extension API

---

## Configuration Guide

### Rule Examples

Define rules in your VS Code settings:

```jsonc
// settings.json
"reactiveThemes.rules": [
  // Language-based rules
  {
    "name": "Markdown reading",
    "when": {
      "language": "markdown"
    },
    "theme": "GitHub Light Default"
  },
  {
    "name": "TypeScript dev",
    "when": {
      "language": "typescript"
    },
    "theme": "Tokyo Night"
  },
  {
    "name": "TypeScript React (TSX)",
    "when": {
      "language": "typescriptreact"  // Note: .tsx files use "typescriptreact", not "typescript"
    },
    "theme": "Tokyo Night"
  },
  {
    "name": "JavaScript development",
    "when": {
      "language": "javascript"
    },
    "theme": "Monokai"
  },
  {
    "name": "JavaScript React (JSX)",
    "when": {
      "language": "javascriptreact"  // Note: .jsx files use "javascriptreact"
    },
    "theme": "Monokai"
  },
  {
    "name": "Python coding",
    "when": {
      "language": "python"
    },
    "theme": "One Dark Pro"
  },
  {
    "name": "Go development",
    "when": {
      "language": "go"
    },
    "theme": "Dracula"
  },
  {
    "name": "Java projects",
    "when": {
      "language": "java"
    },
    "theme": "Atom One Dark"
  },
  {
    "name": "Rust coding",
    "when": {
      "language": "rust"
    },
    "theme": "Nord"
  },
  {
    "name": "C/C++ development",
    "when": {
      "language": "cpp"
    },
    "theme": "Visual Studio Dark"
  },
  {
    "name": "JSON files",
    "when": {
      "language": "json"
    },
    "theme": "Quiet Light"
  },
  {
    "name": "JSON with Comments (VS Code configs)",
    "when": {
      "language": "jsonc"  // Note: VS Code config files (settings.json, tsconfig.json) use "jsonc"
    },
    "theme": "Quiet Light"
  },
  {
    "name": "YAML files",
    "when": {
      "language": "yaml"
    },
    "theme": "Solarized Light"
  },

  // Pattern-based rules
  {
    "name": "Test files",
    "when": {
      "pattern": "**/*.test.*"
    },
    "theme": "Monokai Dimmed"
  },
  {
    "name": "Docs folder",
    "when": {
      "pattern": "**/docs/**"
    },
    "theme": "Solarized Light"
  },
  {
    "name": "Source files",
    "when": {
      "pattern": "**/src/**"
    },
    "theme": "Dark+ (default dark)"
  },

  // Workspace-based rules
  {
    "name": "Backend workspace",
    "when": {
      "workspaceName": "hopper-backend"
    },
    "theme": "One Dark Pro"
  },

  // Context-based rules
  {
    "name": "Debug mode - high contrast",
    "when": {
      "debugSession": "active"
    },
    "theme": "Monokai"
  },
  {
    "name": "Debug Node.js specifically",
    "when": {
      "debugSession": "active",
      "debugType": "node"
    },
    "theme": "GitHub Dark High Contrast"
  },
  {
    "name": "Test failure alert",
    "when": {
      "testState": "failed"
    },
    "theme": "Red"
  },
  {
    "name": "Tests running",
    "when": {
      "testState": "running"
    },
    "theme": "Solarized Dark"
  },
  {
    "name": "Diff view - high contrast",
    "when": {
      "viewMode": "diff"
    },
    "theme": "GitHub Light High Contrast"
  },
  {
    "name": "Merge conflict resolution",
    "when": {
      "viewMode": "merge"
    },
    "theme": "Dracula"
  },
  {
    "name": "Pomodoro timer - 25 minute intervals",
    "when": {
      "timerInterval": 25
    },
    "theme": "Tokyo Night"
  },

  // Combined file + context rules
  {
    "name": "Debug TypeScript - special theme",
    "when": {
      "language": "typescript",
      "debugSession": "active"
    },
    "theme": "Dracula"
  }
]
```

### Context Trigger Reference

Beyond file-based conditions, Reactive Themes now supports context-based triggers that respond to your development environment state.

#### Debug Session Triggers

Switch themes based on debugging state:

**`debugSession`**: `"active"` | `"inactive"`
- Triggers when a debug session starts or stops
- Useful for high-contrast themes during debugging

**`debugType`**: string (e.g., `"node"`, `"python"`, `"chrome"`)
- Match specific debug configurations
- Combine with `debugSession: "active"` for fine-grained control

**Examples:**
```json
// Any debug session
{
  "name": "Debugging mode",
  "when": { "debugSession": "active" },
  "theme": "Monokai"
}

// Specific debug type
{
  "name": "Node.js debugging",
  "when": {
    "debugSession": "active",
    "debugType": "node"
  },
  "theme": "GitHub Dark High Contrast"
}
```

#### Test Execution Triggers

React to test runs and their results:

**`testState`**: `"running"` | `"failed"` | `"passed"` | `"none"`
- Detects when tests are executed via VSCode tasks
- Works with common test frameworks (Jest, Mocha, pytest, etc.)
- Automatically resets to `"none"` after a few seconds

**Examples:**
```json
// Red theme when tests fail
{
  "name": "Test failure alert",
  "when": { "testState": "failed" },
  "theme": "Red"
}

// Calm theme while tests run
{
  "name": "Tests running",
  "when": { "testState": "running" },
  "theme": "Solarized Dark"
}
```

**Note:** Test detection works by monitoring VSCode tasks. Tasks with names containing keywords like "test", "jest", "mocha", "pytest", etc. are recognized as test tasks.

#### Timer-Based Triggers

Rotate themes at regular intervals:

**`timerInterval`**: number (minutes)
- Applies theme every N minutes
- Useful for Pomodoro technique or preventing eye strain
- Multiple timer rules can coexist with different intervals

**Examples:**
```json
// Switch every 25 minutes (Pomodoro)
{
  "name": "Pomodoro dark",
  "when": { "timerInterval": 25 },
  "theme": "Tokyo Night"
}

// Switch every hour
{
  "name": "Hourly rotation",
  "when": { "timerInterval": 60 },
  "theme": "One Dark Pro"
}
```

**Note:** Timer rules trigger independently of file changes. The theme will switch even if you're still editing the same file.

#### View Mode Triggers

Adapt themes to different editing modes:

**`viewMode`**: `"diff"` | `"merge"` | `"normal"`
- `"diff"` – Detected when viewing file comparisons (git diff, side-by-side)
- `"merge"` – Detected when merge conflict markers are present in the active file
- `"normal"` – Regular editing mode

**Examples:**
```json
// High contrast for diff views
{
  "name": "Diff view",
  "when": { "viewMode": "diff" },
  "theme": "GitHub Light High Contrast"
}

// Alert theme for merge conflicts
{
  "name": "Merge conflicts",
  "when": { "viewMode": "merge" },
  "theme": "Dracula"
}
```

**Diff Detection:** The extension uses heuristics to detect diff views:
- Git diff schemes (`git://`, `vscode-scm://`)
- Side-by-side editor layouts
- Multiple editors showing similar file names

#### Combining Conditions

You can combine file-based and context-based conditions. ALL conditions must match (AND logic):

```json
// Only when debugging TypeScript files
{
  "name": "Debug TS",
  "when": {
    "language": "typescript",
    "debugSession": "active"
  },
  "theme": "Monokai Dimmed"
}

// Test failures in a specific workspace
{
  "name": "Backend test failures",
  "when": {
    "workspaceName": "backend",
    "testState": "failed"
  },
  "theme": "Red"
}

// Diff view for markdown files only
{
  "name": "Markdown diffs",
  "when": {
    "language": "markdown",
    "viewMode": "diff"
  },
  "theme": "GitHub Light"
}
```

### Important: Language IDs and Theme Names

**Common Language IDs**

VS Code uses specific language IDs that may differ from file extensions. Here are some important ones:

- `.ts` files → `typescript`
- `.tsx` files → `typescriptreact` ⚠️ (NOT `typescript`)
- `.js` files → `javascript`
- `.jsx` files → `javascriptreact` ⚠️ (NOT `javascript`)
- `.json` files → `json`
- VS Code config files (settings.json, tsconfig.json, etc.) → `jsonc` ⚠️ (NOT `json`)
- `.py` files → `python`
- `.go` files → `go`
- `.rs` files → `rust`
- `.md` files → `markdown`

**Finding the Correct Language ID**

To find the language ID for any file:
1. Open the file in VS Code
2. Look at the bottom-right corner of the window
3. Click on the language indicator (e.g., "TypeScript React")
4. The language ID is shown in parentheses in the picker

**Finding the Correct Theme Name**

Theme names must match **exactly** as they appear in VS Code:
1. Open Command Palette (Cmd/Ctrl + Shift + P)
2. Type "Preferences: Color Theme"
3. The exact names shown in the list are what you need to use

Common mistakes:
- ❌ "Monkai" → ✅ "Monokai"
- ❌ "Tokyo Night Storm" → ✅ "Tokyo Night" (verify in the theme picker)
- ❌ "Default Dark+" → ✅ "Dark+ (default dark)"

### Debugging Your Rules

If theme switching isn't working as expected, use the **"Reactive Themes: Show Active Rule"** command:

1. Open the file you want to debug
2. Open Command Palette (Cmd/Ctrl + Shift + P)
3. Run "Reactive Themes: Show Active Rule"

This will show:
- The current file's language ID (e.g., `typescriptreact`)
- The file path
- The workspace name
- **Current context state** (debug session, test state, view mode)
- Which rule matched (if any)
- What theme is being applied

**Troubleshooting:**
- If the language ID isn't what you expected, update your rules to use the correct ID
- If no rule matches, add a new rule or check your pattern syntax
- If the theme name is wrong, verify it matches exactly in the theme picker

---

## How It Works

Understanding the internals can help you write better rules:

### Rule Evaluation Strategy

**First-Match Wins**
- Rules are evaluated in the order they appear in your `reactiveThemes.rules` array
- The first rule that matches ALL its conditions wins
- Subsequent rules are ignored once a match is found
- **Tip:** Put more specific rules at the top, general rules at the bottom

**AND Logic for Conditions**
- If a rule has multiple conditions (e.g., both `language` AND `pattern`), ALL must match
- Example: A rule with `"language": "typescript"` AND `"pattern": "**/*.test.ts"` only matches TypeScript test files

**Fallback Behavior**
- If no rules match, the extension applies `reactiveThemes.defaultTheme` (if configured)
- If no default theme is set, your original theme remains active

### Debouncing

Theme switching is debounced with a 300ms delay:
- When you switch files rapidly, the extension waits 300ms before applying the theme
- This prevents visual flickering and performance issues
- The delay is reset each time you switch files
- Once you stop switching, the appropriate theme is applied after 300ms

### Original Theme Preservation

The extension remembers your theme:
- When first activated, it saves your current theme as the "original theme"
- When you disable the extension (via Toggle command), it restores this original theme
- When you close VS Code and reopen, it will reapply rules based on the active file

### Theme Application

How themes are actually applied:
1. You open or switch to a file
2. Extension reads the file's language ID, path, and workspace name
3. Rules are evaluated in order until a match is found
4. Theme change is scheduled (debounced)
5. After 300ms of no file switches, the theme is applied via VS Code's `workbench.colorTheme` setting
6. If the theme doesn't exist, you'll see a warning notification

---

## FAQ

### Why isn't the theme changing when I open a file?

**Check these common issues:**
1. **Is the extension enabled?** Run `Reactive Themes: Toggle` to check
2. **Are your rules correct?** Run `Reactive Themes: Show Active Rule` to see what's matching
3. **Language ID mismatch?** `.tsx` files use `typescriptreact`, not `typescript`
4. **Theme name typo?** Verify exact names via Command Palette → "Preferences: Color Theme"
5. **No rules matching?** The extension needs at least one rule to match, or configure `reactiveThemes.defaultTheme`

### My .tsx files aren't matching my TypeScript rule

This is expected! VS Code uses different language IDs:
- `.ts` files → `typescript`
- `.tsx` files → `typescriptreact` (React/JSX syntax)

You need separate rules for each, or use a `pattern` rule instead:
```json
{
  "name": "All TypeScript files",
  "when": { "pattern": "**/*.{ts,tsx}" },
  "theme": "Tokyo Night"
}
```

### Can I use multiple conditions in one rule?

Yes! All conditions must match (AND logic):
```json
{
  "name": "TypeScript test files only",
  "when": {
    "language": "typescript",
    "pattern": "**/*.test.ts"
  },
  "theme": "Monokai Dimmed"
}
```

This only matches files that are BOTH TypeScript AND match the test file pattern.

### What happens if multiple rules could match?

**First-match wins.** Rules are evaluated in order, and the first matching rule is used.

**Tip:** Put more specific rules at the top:
```json
"reactiveThemes.rules": [
  // Specific rule first
  { "name": "TS tests", "when": { "pattern": "**/*.test.ts" }, "theme": "Dark" },
  // General rule after
  { "name": "All TS", "when": { "language": "typescript" }, "theme": "Light" }
]
```

### Does this affect performance?

No significant impact:
- Rule evaluation is very fast (simple string/regex matching)
- Theme switching is debounced (300ms delay)
- The extension only runs when you switch files
- No background polling or watchers

### Can I disable the extension temporarily?

Yes! Use the command **`Reactive Themes: Toggle`**. This will:
- Disable reactive theme switching
- Restore your original theme
- Keep the extension loaded for quick re-enabling

### Where are the settings stored?

In your VS Code `settings.json` file:
- **User settings:** `~/Library/Application Support/Code/User/settings.json` (macOS)
- **Workspace settings:** `.vscode/settings.json` in your project

You can edit either via Command Palette → "Preferences: Open Settings (JSON)"

### Can I share my rules with my team?

Yes! Add rules to your workspace settings:
1. Create/edit `.vscode/settings.json` in your project
2. Add your `reactiveThemes.rules` configuration
3. Commit `.vscode/settings.json` to version control
4. Team members with the extension installed will use the same rules

### How do I find the correct theme name?

1. Open Command Palette (`Cmd/Ctrl + Shift + P`)
2. Type "Preferences: Color Theme"
3. The exact names in the list are what you need

Common mistakes:
- ❌ "tokyo-night" → ✅ "Tokyo Night"
- ❌ "Default Dark" → ✅ "Dark+ (default dark)"
- ❌ "Solarized Dark" → ✅ "Solarized Dark" (but verify in the picker!)

### What glob patterns are supported?

Standard glob patterns:
- `*` – Matches any characters except `/` (e.g., `*.ts` matches `file.ts`)
- `**` – Matches any characters including `/` (e.g., `**/src/**` matches any path with `src`)
- `{a,b}` – Matches either `a` or `b` (e.g., `*.{ts,tsx}` matches both `.ts` and `.tsx`)

Examples:
- `**/*.test.*` – All test files
- `**/docs/**` – Any file in a `docs` directory
- `**/src/**/*.ts` – TypeScript files in `src` directories

---

## Development

### Setup

Want to contribute or modify the extension?

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/reactive-themes.git
   cd reactive-themes
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Open in VS Code:**
   ```bash
   code .
   ```

4. **Launch Extension Development Host:**
   - Press `F5` (or Run → Start Debugging)
   - A new VS Code window will open with the extension loaded
   - Make changes to the code, then reload the extension host window (`Cmd/Ctrl + R`)

### Testing

The `examples/` directory contains multi-language files for testing:

```
examples/
├── README.md               # Testing instructions
├── bubble_sort.py         # Python
├── bubble_sort.js         # JavaScript
├── bubble_sort.ts         # TypeScript
├── bubble_sort.go         # Go
├── BubbleSort.java        # Java
├── bubble_sort.rs         # Rust
├── bubble_sort.cpp        # C++
├── bubble_sort.test.ts    # Test file
├── config.json            # JSON
└── config.yaml            # YAML
```

**Quick test workflow:**
1. Configure rules in your settings for different languages
2. Open files from `examples/` directory
3. Watch the theme change automatically as you switch files
4. Use `Reactive Themes: Show Active Rule` to debug

**Example test configuration:**
```json
"reactiveThemes.rules": [
  { "name": "Python", "when": { "language": "python" }, "theme": "One Dark Pro" },
  { "name": "TypeScript", "when": { "language": "typescript" }, "theme": "Tokyo Night" },
  { "name": "Go", "when": { "language": "go" }, "theme": "Dracula" },
  { "name": "Test files", "when": { "pattern": "**/*.test.*" }, "theme": "Monokai Dimmed" }
]
```

### Architecture

The codebase follows clean separation of concerns:

**Core:**
- **[extension.ts](src/extension.ts)** – Entry point, command registration, event listeners
- **[types.ts](src/types.ts)** – TypeScript interfaces for rules and configuration
- **[config.ts](src/config.ts)** – Configuration loading and validation
- **[themeManager.ts](src/themeManager.ts)** – Theme application with debouncing
- **[ruleEngine.ts](src/ruleEngine.ts)** – Rule matching logic and glob pattern support
- **[contextManager.ts](src/contextManager.ts)** – State management for context triggers

**Context Triggers:**
- **[triggers/debugTrigger.ts](src/triggers/debugTrigger.ts)** – Debug session monitoring
- **[triggers/testTrigger.ts](src/triggers/testTrigger.ts)** – Test execution detection
- **[triggers/timerTrigger.ts](src/triggers/timerTrigger.ts)** – Timer-based theme rotation
- **[triggers/viewTrigger.ts](src/triggers/viewTrigger.ts)** – Diff/merge view detection

**Commands:**
- **[commands/createRule.ts](src/commands/createRule.ts)** – Interactive rule creation
- **[commands/manageRules.ts](src/commands/manageRules.ts)** – Rule management UI
- **[commands/cleanupRules.ts](src/commands/cleanupRules.ts)** – Duplicate rule cleanup
- **[commands/testRule.ts](src/commands/testRule.ts)** – Rule testing utility
- **[commands/lintRules.ts](src/commands/lintRules.ts)** – Rule validation and linting

### Running Tests

```bash
npm test
```

Note: Test coverage is currently minimal and needs expansion.

### Building

To package the extension:
```bash
npm run package
```

This creates a `.vsix` file you can install manually or publish to the marketplace.

---

## Contributing

Contributions are welcome! Here's how you can help:

### Bug Reports
- Check existing issues first to avoid duplicates
- Include VS Code version, extension version, and OS
- Provide steps to reproduce
- Include your rules configuration (if relevant)
- Run `Reactive Themes: Show Active Rule` and include the output

### Feature Requests
- Explain the use case and why it's valuable
- Provide examples of how it would work
- Check the roadmap to see if it's already planned

### Pull Requests
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly with the `examples/` files
5. Update documentation if needed
6. Commit with descriptive messages
7. Push to your fork
8. Open a pull request

### Development Guidelines
- Follow existing code style (TypeScript, clean separation of concerns)
- Add tests for new features
- Update README for user-facing changes
- Keep commits focused and atomic

---

## License

MIT License - see LICENSE file for details.

---

## Credits

Created by [Your Name]

Special thanks to the VS Code extension development community.

---

**Questions or issues?** Open an issue on [GitHub](https://github.com/yourusername/reactive-themes/issues)
