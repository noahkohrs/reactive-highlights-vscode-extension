# Change Log

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