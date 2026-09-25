/**
 * The contract every V2 primitive has to keep.
 *
 * These are not snapshot tests. A snapshot tells you something changed; it does
 * not tell you that a button is still reachable by a screen reader, that a
 * disabled control still says it is disabled, or that a 44pt finger can still
 * hit the thing. Those are the properties this rebuild committed to, and they
 * are the ones that rot silently -- nobody notices a missing accessibilityLabel
 * by looking at the screen.
 */
import renderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme';
import {
  Badge,
  Button,
  Choice,
  Field,
  IconButton,
  ListRow,
  OtpField,
  Progress,
  Screen,
  ScrollScreen,
  SegmentedControl,
  Stat,
  Surface,
  Toggle,
  hitTarget,
  layout,
  themes,
} from './index';

/** A style prop -- array, nested array or object -- as one object. */
function flatten(style: unknown): Record<string, number | undefined> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, number | undefined>;
}

function render(element: React.ReactNode) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(<ThemeProvider>{element}</ThemeProvider>);
  });
  return tree;
}

/**
 * Every node that assistive technology would stop on, once.
 *
 * `findAll` returns the composite component AND the host view it renders, and
 * both carry the accessibility props -- so a single button appears twice. The
 * tree is outermost-first, so keeping the first of each role+label pair keeps
 * the component and drops its shadow.
 */
function focusables(tree: renderer.ReactTestRenderer): ReactTestInstance[] {
  const seen = new Set<string>();
  return tree.root
    .findAll((node) => typeof node.props?.accessibilityRole === 'string')
    .filter((node) => {
      const key = `${node.props.accessibilityRole}|${node.props.accessibilityLabel ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function roleOf(tree: renderer.ReactTestRenderer, role: string): ReactTestInstance {
  const match = focusables(tree).find((node) => node.props.accessibilityRole === role);
  if (!match) throw new Error(`no element with accessibilityRole="${role}"`);
  return match;
}

/**
 * The rendered height a finger has to hit.
 *
 * Pressable takes `style` as a FUNCTION of the press state, so reading
 * `props.style` off it gives a function rather than an object. Resolving it at
 * rest is what the unpressed control actually renders as.
 */
function minHeightOf(node: ReactTestInstance): number | undefined {
  const raw = node.props.style;
  const resolved = typeof raw === 'function' ? raw({ pressed: false }) : raw;
  const flat = Array.isArray(resolved)
    ? Object.assign({}, ...resolved.flat(Infinity).filter(Boolean))
    : resolved;
  return flat?.minHeight ?? flat?.height;
}

describe('Button', () => {
  it('announces itself as a button, by its label', () => {
    const tree = render(<Button label="Book a donation" onPress={() => {}} />);
    const button = roleOf(tree, 'button');
    expect(button.props.accessibilityLabel).toBe('Book a donation');
  });

  it('is at least a finger tall', () => {
    const tree = render(<Button label="Continue" onPress={() => {}} />);
    expect(minHeightOf(roleOf(tree, 'button'))).toBeGreaterThanOrEqual(hitTarget.min);
  });

  it('reports disabled as a state, not just by looking faded', () => {
    const tree = render(<Button label="Continue" disabled onPress={() => {}} />);
    const button = roleOf(tree, 'button');
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    expect(button.props.disabled).toBe(true);
  });

  it('distinguishes loading from disabled', () => {
    // Both are inert, and they are different facts: "not available" versus
    // "working on it". A screen reader should be able to say which.
    const tree = render(<Button label="Saving" loading onPress={() => {}} />);
    const state = roleOf(tree, 'button').props.accessibilityState;
    expect(state).toMatchObject({ busy: true, disabled: true });
  });

  it('does not fire while loading', () => {
    const onPress = jest.fn();
    const tree = render(<Button label="Saving" loading onPress={onPress} />);
    const button = roleOf(tree, 'button');
    expect(button.props.disabled).toBe(true);
    // Pressable will not call onPress while disabled; asserting the prop is
    // what guarantees that, since a manual invoke would bypass it.
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('requires a label, because an icon alone announces nothing', () => {
    const tree = render(
      <IconButton accessibilityLabel="Close" onPress={() => {}} icon={() => null} />,
    );
    const button = roleOf(tree, 'button');
    expect(button.props.accessibilityLabel).toBe('Close');
    expect(minHeightOf(button)).toBeGreaterThanOrEqual(hitTarget.min);
  });
});

describe('Field', () => {
  it('labels the input rather than only drawing a label beside it', () => {
    const tree = render(<Field label="Email" value="" onChangeText={() => {}} />);
    const input = tree.root.findAll((n) => n.props?.accessibilityLabel === 'Email');
    expect(input.length).toBeGreaterThan(0);
  });

  it('announces the error and drops the hint, rather than reading both', () => {
    const tree = render(
      <Field label="Email" hint="We only use this for recovery" error="Enter a valid email" value="x" onChangeText={() => {}} />,
    );
    const texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children);
    expect(texts).toContain('Enter a valid email');
    expect(texts).not.toContain('We only use this for recovery');

    const alert = tree.root.findAll((n) => n.props?.accessibilityRole === 'alert');
    expect(alert.length).toBeGreaterThan(0);
  });
});

describe('OtpField', () => {
  it('is one input, so platform autofill can deliver the whole code', () => {
    const tree = render(<OtpField value="" onChange={() => {}} accessibilityLabel="Verification code" />);
    const inputs = tree.root
      .findAll((n) => n.props?.textContentType === 'oneTimeCode' || n.props?.autoComplete === 'sms-otp')
      // The composite TextInput and the host it renders both carry the props.
      .filter((n) => typeof n.type !== 'string');
    // Exactly one: six separate boxes would each be a field, and the code
    // would land in the first one only.
    expect(inputs).toHaveLength(1);
  });

  it('submits itself once the last digit lands', () => {
    const onComplete = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <OtpField value="12345" onChange={() => {}} onComplete={onComplete} accessibilityLabel="Code" />
        </ThemeProvider>,
      );
    });
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      tree.update(
        <ThemeProvider>
          <OtpField value="123456" onChange={() => {}} onComplete={onComplete} accessibilityLabel="Code" />
        </ThemeProvider>,
      );
    });
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('calls back once, not on every re-render at full length', () => {
    const onComplete = jest.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ThemeProvider>
          <OtpField value="123456" onChange={() => {}} onComplete={onComplete} accessibilityLabel="Code" />
        </ThemeProvider>,
      );
    });
    act(() => {
      tree.update(
        <ThemeProvider>
          <OtpField value="123456" onChange={() => {}} onComplete={onComplete} accessibilityLabel="Code" />
        </ThemeProvider>,
      );
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('Toggle', () => {
  it('is a switch that reports whether it is on', () => {
    const tree = render(<Toggle label="Emergency alerts" value onValueChange={() => {}} />);
    const toggle = roleOf(tree, 'switch');
    expect(toggle.props.accessibilityLabel).toBe('Emergency alerts');
    expect(toggle.props.accessibilityState).toMatchObject({ checked: true });
  });

  it('is inert and says so while a change is saving', () => {
    const tree = render(<Toggle label="Emergency alerts" value busy onValueChange={() => {}} />);
    expect(roleOf(tree, 'switch').props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });
});

describe('SegmentedControl', () => {
  it('is a radio group, so which option is chosen can be announced', () => {
    const tree = render(
      <SegmentedControl
        accessibilityLabel="Range"
        value="month"
        onChange={() => {}}
        options={[
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
      />,
    );
    expect(roleOf(tree, 'radiogroup').props.accessibilityLabel).toBe('Range');

    const radios = focusables(tree).filter((n) => n.props.accessibilityRole === 'radio');
    expect(radios).toHaveLength(2);
    expect(radios.find((r) => r.props.accessibilityLabel === 'Month')!.props.accessibilityState).toMatchObject({
      selected: true,
    });
  });
});

describe('Choice', () => {
  it('explains why an option cannot be taken instead of only greying it out', () => {
    const tree = render(
      <Choice label="09:00" selected={false} onPress={() => {}} unavailableReason="Fully booked" />,
    );
    const radio = roleOf(tree, 'radio');
    expect(radio.props.accessibilityState).toMatchObject({ disabled: true });
    expect(radio.props.accessibilityHint).toBe('Fully booked');
  });
});

describe('Progress', () => {
  it('reports its value as a number, not as a coloured rectangle', () => {
    const tree = render(<Progress label="Profile complete" value={0.6} />);
    const bar = roleOf(tree, 'progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 60 });
  });

  it('clamps a value outside 0..1 rather than overflowing', () => {
    const tree = render(<Progress label="Profile complete" value={1.4} />);
    expect(roleOf(tree, 'progressbar').props.accessibilityValue.now).toBe(100);
  });

  it('survives a non-finite value from the server', () => {
    const tree = render(<Progress label="Profile complete" value={Number.NaN} />);
    expect(roleOf(tree, 'progressbar').props.accessibilityValue.now).toBe(0);
  });
});

describe('Stat', () => {
  it('announces the label with the number, not as two separate stops', () => {
    const tree = render(<Stat label="Total donated" value="2250" unit="ml" />);
    const stat = tree.root.findAll((n) => n.props?.accessibilityLabel === 'Total donated: 2250 ml');
    expect(stat.length).toBeGreaterThan(0);
  });
});

describe('Badge', () => {
  it('always carries words, so status is never colour alone', () => {
    const tree = render(<Badge label="Verified" tone="success" />);
    const texts = tree.root.findAll((n) => typeof n.props?.children === 'string').map((n) => n.props.children);
    expect(texts).toContain('Verified');
  });
});

describe('ListRow', () => {
  it('is a button only when it does something', () => {
    const inert = render(<ListRow title="Blood type" value="O+" />);
    expect(focusables(inert).filter((n) => n.props.accessibilityRole === 'button')).toHaveLength(0);

    const actionable = render(<ListRow title="Privacy" onPress={() => {}} />);
    expect(roleOf(actionable, 'button').props.accessibilityLabel).toBe('Privacy');
  });

  it('announces the subtitle with the title, since they are read together', () => {
    const tree = render(<ListRow title="Security" subtitle="Password and sessions" onPress={() => {}} />);
    expect(roleOf(tree, 'button').props.accessibilityLabel).toBe('Security. Password and sessions');
  });

  it('is at least a finger tall', () => {
    const tree = render(<ListRow title="Privacy" onPress={() => {}} />);
    expect(minHeightOf(roleOf(tree, 'button'))).toBeGreaterThanOrEqual(hitTarget.min);
  });
});

/**
 * Two rules inherited from the components V2 replaced, kept as tests because
 * both were shipped defects before they were rules.
 */
describe('ScrollScreen content sizing', () => {
  it('lets scrolling content grow past the viewport', () => {
    const tree = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        <ScrollScreen>
          <Text>content</Text>
        </ScrollScreen>
      </SafeAreaProvider>,
    );

    const scroller = tree.root.findAllByType(ScrollView)[0]!;
    const style = flatten(scroller.props.contentContainerStyle);

    // `flex: 1` sets `flexBasis: 0`, which inside a scroll container resolves
    // the child's height against the viewport instead of its content -- so a
    // screen longer than one viewport was clamped to one, scrolling stopped
    // early, and the last card was cut in half.
    expect(style.flexGrow).toBe(1);
    expect(style.flex).toBeUndefined();
  });

  it('leaves room for the floating tab bar', () => {
    const tree = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}
      >
        <ScrollScreen>
          <Text>content</Text>
        </ScrollScreen>
      </SafeAreaProvider>,
    );

    const scroller = tree.root.findAllByType(ScrollView)[0]!;
    const style = flatten(scroller.props.contentContainerStyle);

    expect(style.paddingBottom).toBeGreaterThanOrEqual(layout.tabBarClearance);
  });
});

describe('a screen is a column, not a canvas', () => {
  it('stops growing past a readable width and centres what is left', () => {
    const tree = render(
      <SafeAreaProvider
        initialMetrics={{
          // A tablet, or an unfolded foldable. A phone layout stretched this
          // wide is a 700pt line of body text.
          frame: { x: 0, y: 0, width: 834, height: 1194 },
          insets: { top: 24, left: 0, right: 0, bottom: 20 },
        }}
      >
        <Screen>
          <Text>content</Text>
        </Screen>
      </SafeAreaProvider>,
    );

    const frame = flatten(tree.root.findAllByType(View)[0]!.props.style);
    expect(frame.maxWidth).toBe(layout.maxContentWidth);
    expect(frame.alignSelf).toBe('center');
  });
});

describe('Surface', () => {
  it('draws a border rather than a shadow where the shadow cannot work', () => {
    // Android derives a shadow from the view's outline, and on a surface whose
    // fill lives in a child that degrades into a hard grey rectangle drawn
    // inside the card. It was reported four times across separate V1 builds.
    const tree = render(<Surface level="flat">{null}</Surface>);
    const view = tree.root.findAllByType(View)[0]!;
    const style = flatten(view.props.style);

    expect(style.borderWidth).toBe(1);
    expect(style.shadowOpacity).toBeUndefined();
  });

  it('is announced as one button when the whole card is the target', () => {
    const tree = render(
      <Surface onPress={() => undefined} accessibilityLabel="Open donor profile">
        <Text>anything</Text>
      </Surface>,
    );

    const button = roleOf(tree, 'button');
    expect(button.props.accessibilityLabel).toBe('Open donor profile');
  });
});

describe('a control on an accent fill', () => {
  it('draws its label in the one colour checked against every fill', () => {
    const tree = render(<Button label="View requests" onAccent onPress={() => undefined} />);
    const label = tree.root
      .findAll((node) => node.props?.children === 'View requests')
      .map((node) => flatten(node.props.style))
      .find((style) => style.color !== undefined);

    expect(label?.color).toBe(themes.dark.textOnAccent);
  });
});
