class TreeNode {
  constructor(data) {
    this.dt = data;
    this.cld = [];
  }

  // Add a child node
  addChild(childNode) {
    if (childNode instanceof TreeNode) {
      this.cld.push(childNode);
      return childNode;
    }
    throw new Error('Child must be an instance of TreeNode');
  }

  // Remove a child node
  removeChild(childNode) {
    const index = this.cld.indexOf(childNode);
    if (index !== -1) {
      this.cld.splice(index, 1);
      return childNode;
    }
    throw new Error('Child node not found');
  }

  // Serialize the tree to a JSON object
  toJSON() {
    return {
      dt: this.dt,
      cld: this.cld.map((child) => child.toJSON()),
    };
  }

  // Deserialize a JSON object into a TreeNode
  static fromJSON(json) {
    const node = new TreeNode(json.dt);
    if (json.cld && Array.isArray(json.cld)) {
      json.cld.forEach((childJson) => {
        node.addChild(TreeNode.fromJSON(childJson));
      });
    }
    return node;
  }
}

module.exports = {
  TreeNode,
};
