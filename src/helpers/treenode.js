class TreeNode {
  constructor(data) {
    this.dt = data || {};
    this.cld = [];
  }

  // Start measuring timings for this node
  startMeasure() {
    this.msec = Date.now();
  }

  // End measuring timings for this node
  endMeasure() {
    this.msec = Date.now() - this.msec;
  }

  // Append data to node
  appendData(data) {
    this.dt = {
      ...(this.dt),
      ...(data || {}),
    };
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
    const data = {
      dt: this.dt,
      cld: this.cld.map((child) => child.toJSON()),
    };
    if (this.msec > 0) {
      data.msec = this.msec;
    }
    return data;
  }

  // Deserialize a JSON object into a TreeNode
  static fromJSON(json) {
    const node = new TreeNode(json.dt);
    if (json.msec) {
      node.msec = json.msec;
    }
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
