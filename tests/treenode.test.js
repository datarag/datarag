const { TreeNode } = require('../src/helpers/treenode');

describe('TreeNode', () => {
  it('should create a TreeNode with data', () => {
    const node = new TreeNode({ name: 'Root' });
    expect(node.dt).toEqual({ name: 'Root' });
    expect(node.cld).toEqual([]);
  });

  it('should add a child node', () => {
    const root = new TreeNode({ name: 'Root' });
    const child = new TreeNode({ name: 'Child 1' });

    root.addChild(child);

    expect(root.cld.length).toBe(1);
    expect(root.cld[0].dt).toEqual({ name: 'Child 1' });
  });

  it('should throw an error when adding a non-TreeNode as a child', () => {
    const root = new TreeNode({ name: 'Root' });

    expect(() => root.addChild({ name: 'Not a TreeNode' })).toThrow('Child must be an instance of TreeNode');
  });

  it('should remove a child node', () => {
    const root = new TreeNode({ name: 'Root' });
    const child = new TreeNode({ name: 'Child 1' });

    root.addChild(child);
    root.removeChild(child);

    expect(root.cld.length).toBe(0);
  });

  it('should throw an error when removing a non-existing child', () => {
    const root = new TreeNode({ name: 'Root' });
    const child = new TreeNode({ name: 'Child 1' });

    expect(() => root.removeChild(child)).toThrow('Child node not found');
  });

  it('should serialize a TreeNode to JSON', () => {
    const root = new TreeNode({ name: 'Root' });
    const child = new TreeNode({ name: 'Child 1' });

    root.addChild(child);

    const json = root.toJSON();

    expect(json).toEqual({
      dt: { name: 'Root' },
      cld: [
        {
          dt: { name: 'Child 1' },
          cld: [],
        },
      ],
    });
  });

  it('should deserialize a JSON object into a TreeNode', () => {
    const json = {
      dt: { name: 'Root' },
      cld: [
        {
          dt: { name: 'Child 1' },
          cld: [],
        },
      ],
    };

    const root = TreeNode.fromJSON(json);

    expect(root.dt).toEqual({ name: 'Root' });
    expect(root.cld.length).toBe(1);
    expect(root.cld[0].dt).toEqual({ name: 'Child 1' });
  });
});
