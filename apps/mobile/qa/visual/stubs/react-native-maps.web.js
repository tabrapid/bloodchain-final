/**
 * react-native-maps, for the visual-QA web harness only.
 *
 * The real module needs a native view, so in a browser the map area would
 * render as nothing and the screenshot would show a hole where the map is. A
 * hole is indistinguishable from a layout bug, and the point of the capture is
 * to be able to tell those apart.
 *
 * So this draws a labelled placeholder at exactly the size the real map
 * occupies. It is NOT a map, does not claim to be one, and the report says
 * every map surface is unverified until it is seen on a device -- the same
 * position the readiness document has taken since Sprint 11.
 *
 * Substituted only when BLOODCHAIN_VISUAL_QA=1 and the platform is web.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const PROVIDER_DEFAULT = undefined;
export const PROVIDER_GOOGLE = 'google';

export function Marker() {
  return null;
}

export function Callout() {
  return null;
}

export function Circle() {
  return null;
}

export default function MapView({ style, children }) {
  return (
    <View style={[styles.map, style]}>
      <Text style={styles.label}>MAP — native view, not rendered by the web harness</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.45)',
    borderStyle: 'dashed',
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.4,
    textAlign: 'center',
    paddingHorizontal: 16,
    color: 'rgba(90,90,90,0.9)',
  },
});
