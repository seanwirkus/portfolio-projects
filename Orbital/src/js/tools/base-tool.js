// Base Tool Interface - All tools implement this

class BaseTool {
    constructor(name) {
        this.name = name;
        this.active = false;
    }

    // Called when tool is activated
    activate() {
        this.active = true;
    }

    // Called when tool is deactivated
    deactivate() {
        this.active = false;
    }

    // Handle mouse down
    onMouseDown(x, y, molecule, renderer) {
        // Override in subclasses
    }

    // Handle mouse move
    onMouseMove(x, y, molecule, renderer) {
        // Override in subclasses
    }

    // Handle mouse up
    onMouseUp(x, y, molecule, renderer) {
        // Override in subclasses
    }

    // Handle click
    onClick(x, y, molecule, renderer) {
        // Override in subclasses
    }
}

window.BaseTool = BaseTool;

