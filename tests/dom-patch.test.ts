import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("DOM Compatibility Patch Unit Tests", () => {
  it("should safely intercept removeChild when child parent is mismatch (e.g. Google Translate / extensions)", () => {
    // Mock minimal DOM Node environment
    class MockNode {
      parentNode: MockNode | null = null;
      children: MockNode[] = [];

      appendChild<T extends MockNode>(child: T): T {
        child.parentNode = this;
        this.children.push(child);
        return child;
      }

      removeChild<T extends MockNode>(child: T): T {
        const index = this.children.indexOf(child);
        if (index === -1) {
          throw new Error("Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.");
        }
        this.children.splice(index, 1);
        child.parentNode = null;
        return child;
      }
    }

    const parentA = new MockNode();
    const parentB = new MockNode(); // Simulates Google Translate <font> wrapper
    const child = new MockNode();

    parentB.appendChild(child);

    // Without patch: parentA.removeChild(child) throws error
    assert.throws(() => {
      parentA.removeChild(child);
    }, /Failed to execute 'removeChild'/);

    // Apply patch logic
    const origRemoveChild = MockNode.prototype.removeChild;
    MockNode.prototype.removeChild = function <T extends MockNode>(c: T): T {
      if (c.parentNode !== this) {
        if (c.parentNode) {
          try {
            return (c.parentNode as MockNode).removeChild(c) as T;
          } catch {
            // Suppress
          }
        }
        return c;
      }
      return origRemoveChild.call(this, c) as T;
    };

    // With patch: calling parentA.removeChild(child) succeeds gracefully without throwing!
    assert.doesNotThrow(() => {
      const removed = parentA.removeChild(child);
      assert.strictEqual(removed, child);
    });

    // The child was safely removed from its actual wrapper parent (parentB)
    assert.strictEqual(child.parentNode, null);
    assert.strictEqual(parentB.children.length, 0);
  });
});
