![Reactive Highlights](images/github-header-banner.png)

![Angular](https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![Vue](https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D)
![Version](https://img.shields.io/vscode-marketplace/v/noahkohrs.reactive-highlights?style=for-the-badge)

![Demo](images/demo.gif)


**Make your reactive state pop!**

Reactive Highlights is a VS Code extension designed to instantly identify "Reactive" variables in your code. Whether you are using **Angular Signals** or **Vue.js Refs**, this extension "digs" into the type definitions of your variables and highlights them, ensuring you never miss a reactive dependency again.

It goes beyond simple regex matching—it understands your code structure to highlight variables passed as arguments, class properties, or imported signals.

## Features
*   **Framework Support**:
    *   **Angular**
    *   **Vue.js**

## Configuration

Customize the look and feel of your reactive variables in VS Code settings (`Ctrl+,` -> search "Reactive Highlights"):

| Setting | Default | Description |
| :--- | :--- | :--- |
| `reactiveHighlights.color` | `#A020F0` (Purple) | Text color of the reactive variable. |
| `reactiveHighlights.enableBackground` | `false` | Enable a background color for the highlight. |
| `reactiveHighlights.backgroundColor` | `rgba(160, 32, 240, 0.2)` | The background color (if enabled). |
| `reactiveHighlights.enableBold` | `false` | Make reactive variables **bold**. |
| `reactiveHighlights.enableItalic` | `false` | Make reactive variables *italic*. |
| `reactiveHighlights.enableUnderline` | `false` | Add an underline to reactive variables. |
| `reactiveHighlights.debounceTime` | `75` | Delay in ms before updating highlights. |

## How it works

The extension analyzes variable identifiers in your active document. It basically asks the language server: *"Hey, what is the type of this variable?"*. If the type matches a known reactive pattern (like `WritableSignal<number>`), it gets highlighted.

This means it works in complex scenarios:

```typescript
// Angular Example
class MyComponent {
  count = signal(0); // Highlighted
  
  double = computed(() => this.count() * 2); // Highlighted

  update(val: WritableSignal<number>) { // Highlighted (Argument)
     val.set(10); 
  }
}
```

```typescript
// Vue Example
const count = ref(0); // Highlighted
const derived = computed(() => count.value * 2); // Highlighted

function useFeature(param: Ref<string>) { // Highlighted
    console.log(param.value);
}
```

## Performance

To maintain editor responsiveness, the extension implements:
*   **Incremental Updates**: Only modified lines are re-scanned during editing.
*   **Caching**: Highlights are cached to allow instant switching between active tabs.
*   **Batching**: Requests to the language server are batched to prevent blocking the UI thread.

## Release Notes

### 1.0.0
*   Initial release supporting Angular Signals and Vue Refs.
*   Configurable colors and styles.
*   Smart type-based detection.
