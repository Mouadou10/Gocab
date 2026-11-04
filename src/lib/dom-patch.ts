/**
 * GoCab CRM — DOM Compatibility Polyfill for Google Translate & Browser Extensions
 *
 * Solves React Issue #11538 & #17256:
 * "Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node."
 * "Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node."
 *
 * When translation engines (Google Chrome Translate) or browser extensions wrap or replace text nodes
 * in the DOM with <font> or wrapper tags, React's reconciler encounters detached or re-parented nodes
 * during unmounts, transitions, or state updates. This patch intercepts removeChild and insertBefore
 * to gracefully handle DOM mismatches without throwing fatal DOMExceptions.
 */

export function installDomPatch() {
  if (typeof window === "undefined" || typeof Node === "undefined" || !Node.prototype) {
    return;
  }

  // Prevent multiple installations
  if ((Node.prototype as any).__gocab_dom_patch_installed) {
    return;
  }

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(
          "[GoCab DOM Patch] Handled removeChild mismatch (Google Translate / extension mutation):",
          { parent: this, child, actualParent: child.parentNode }
        );
      }
      // If the child actually has a parent (e.g. Google Translate <font> tag), remove it from its actual parent
      if (child.parentNode) {
        try {
          return child.parentNode.removeChild(child);
        } catch {
          // Suppress error
        }
      }
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn(
          "[GoCab DOM Patch] Handled insertBefore mismatch (Google Translate / extension mutation):",
          { parent: this, referenceNode, actualParent: referenceNode.parentNode }
        );
      }
      // If referenceNode has an actual parent, insert before it in that parent
      if (referenceNode.parentNode) {
        try {
          return referenceNode.parentNode.insertBefore(newNode, referenceNode);
        } catch {
          // Fall through to appendChild
        }
      }
      return this.appendChild(newNode);
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };

  (Node.prototype as any).__gocab_dom_patch_installed = true;
}

// Auto-run if imported on client
if (typeof window !== "undefined") {
  installDomPatch();
}
