/**
 * The guard on the other half of "the suite exits".
 *
 * `jest.teardown-render.js` wraps `react-test-renderer`'s `create` so every
 * tree a test mounts is unmounted when that test ends, whether or not the spec
 * remembered to. It matters because of what React 19 changed: `act()` flushes
 * pending work for **every mounted root in scope**, so a tree left behind is
 * not inert. It re-renders inside later tests, against mocks a `beforeEach` has
 * since reset, and then after the file ends it renders into a torn-down jest
 * environment -- which reports as "You are trying to `import` a file after the
 * Jest environment has been torn down", passes every test, and exits 1.
 *
 * Like the React Query teardown, this hooks a third-party function, so it is
 * exactly the kind of thing that breaks quietly on the next upgrade. The
 * symptom of it breaking is not a failing test, it is a CI job that runs every
 * test successfully and then sits there. So the mechanism is asserted here,
 * where a break is a red test instead.
 */
import { useEffect } from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, View } from 'react-native';

const { live } = require('../../jest.teardown-render');

/** Written by the probe's effect cleanup, which only runs on unmount. */
const cleanupLog: string[] = [];

function Probe({ name = 'probe' }: { name?: string }) {
  useEffect(() => () => void cleanupLog.push(name), [name]);
  return (
    <View>
      <Text>{name}</Text>
    </View>
  );
}

function mount(element: React.ReactNode) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<>{element}</>);
  });
  return tree;
}

describe('the harness unmounts what a test mounts', () => {
  it('tracks a tree the moment it is created', () => {
    const before = live.size;
    mount(<Probe />);
    expect(live.size).toBe(before + 1);
  });

  it("has unmounted the previous test's tree before this one runs", () => {
    // The previous test never unmounted anything itself, so if the teardown
    // were gone the set would still hold that tree.
    expect(live.size).toBe(0);
  });

  it('runs effect cleanup, not merely detaching the tree', () => {
    cleanupLog.length = 0;
    const tree = mount(<Probe name="cleanup-probe" />);
    expect(tree.toJSON()).not.toBeNull();

    act(() => tree.unmount());

    expect(cleanupLog).toEqual(['cleanup-probe']);
    expect(tree.toJSON()).toBeNull();
  });

  it('tolerates a spec that already unmounted its own tree', () => {
    const tree = mount(<Probe />);
    act(() => tree.unmount());
    // The teardown unmounts it a second time in afterEach. That has to stay a
    // no-op, or every spec that cleans up after itself would start failing.
    expect(() => act(() => tree.unmount())).not.toThrow();
  });
});
