# Change Log

## [1.1.0] - 2026-02-09

### Added
- **Configuration**: Added `reactiveHighlights.debounceTime` setting to control the delay before highlights are updated. Default is 75ms.

### Changed
- **Refactoring**: Major refactor of the extension architecture. Logic moved from `extension.ts` to a dedicated `HighlightManager`.
- **Performance**: Improved handling of rapid edits. Fixed a race condition where some changes could be missed during debouncing.

## [1.0.0] - 2026-02-05

### Added
- **Smart Type Detection**: Now identifies reactive variables using VS Code's Hover/Type system instead of simple regex.
- **Framework Support**:
    - **Angular**: `Signal`, `WritableSignal`, `InputSignal`, `ModelSignal`, `Computed`.
    - **Vue.js**: `Ref`, `ComputedRef`, `ShallowRef`.
- **Configuration**:
    - Customizable text color (Purple default).
    - Optional background highlight.
    - Font styles: Bold, Italic, Underline.
- **Performance**:
    - implemented incremental scanning to only analyzing changed lines.
    - Caching mechanism for instant tab switching.