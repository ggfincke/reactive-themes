# Example Files for Testing Reactive Themes

This directory contains bubble sort implementations in various programming languages to help you test the Reactive Themes extension.

## Files

- `bubble_sort.py` - Python implementation
- `bubble_sort.js` - JavaScript implementation
- `bubble_sort.ts` - TypeScript implementation
- `bubble_sort.go` - Go implementation
- `BubbleSort.java` - Java implementation
- `bubble_sort.rs` - Rust implementation
- `bubble_sort.cpp` - C++ implementation
- `config.json` - JSON configuration file
- `config.yaml` - YAML configuration file

## How to Test

1. **Press F5** to launch the extension in a new VS Code window
2. **Configure rules** in your settings (Cmd/Ctrl+,) for different languages
3. **Open different files** from this directory and watch the theme change automatically

## Example Configuration

```json
"reactiveThemes.rules": [
  {
    "name": "Python files",
    "when": { "language": "python" },
    "theme": "One Dark Pro"
  },
  {
    "name": "JavaScript files",
    "when": { "language": "javascript" },
    "theme": "Monokai"
  },
  {
    "name": "TypeScript files",
    "when": { "language": "typescript" },
    "theme": "Tokyo Night"
  }
]
```

Switch between files to see the theme change based on the language!
