# Plugin Images

This directory contains the visual assets for the Nixbit Jenkins plugin.

## Required Images

- `nixbit-icon.png` (16x16, 24x24, 32x32, 48x48) - Plugin icon displayed in Jenkins UI
- Used in build actions, configuration pages, and plugin manager

## Image Guidelines

- Use PNG format with transparency
- Maintain consistent branding with Nixbit colors (#667eea, #764ba2)
- Ensure readability at small sizes (16x16)
- Follow Jenkins UI design patterns

## Usage

Images are referenced in Jelly templates using the path:
```
/plugin/nixbit-flaky-test-detector/images/nixbit-icon.png
```

## Placeholder

Currently using placeholder path. Production plugin should include:
- Professional Nixbit logo
- High-quality PNG files
- Multiple sizes for different UI contexts