// Shared spawn layout: rendering, the live rig and route construction use the
// same mass distribution. Coordinates are relative to the launch edge and feet.
export const BODY_NODES = [
  { id: 'head', x: 2, y: -54, radius: 8.5, mass: 1.1 },
  { id: 'neck', x: 0, y: -43, radius: 3.5, mass: .9 },
  { id: 'chest', x: -1, y: -33, radius: 4.5, mass: 1.3 },
  { id: 'pelvis', x: -2, y: -21, radius: 4.5, mass: 1.3 },
  { id: 'elbowL', x: -8, y: -36, radius: 3, mass: .6 },
  { id: 'handL', x: -4, y: -26, radius: 3.5, mass: .5 },
  { id: 'elbowR', x: 9, y: -36, radius: 3, mass: .6 },
  { id: 'handR', x: 14, y: -28, radius: 3.5, mass: .5 },
  { id: 'kneeL', x: -5, y: -10, radius: 3.5, mass: .7 },
  { id: 'footL', x: -6, y: 0, radius: 4, mass: .6 },
  { id: 'kneeR', x: 4, y: -10, radius: 3.5, mass: .7 },
  { id: 'footR', x: 3, y: 0, radius: 4, mass: .6 },
];
export function launchOrigin(topLeft: number, topRight: number, platformY: number, side: 'left' | 'right') {
  const mass = BODY_NODES.reduce((s, n) => s + n.mass, 0);
  const dir = side === 'left' ? 1 : -1;
  const edge = side === 'left' ? topLeft - 16 : topRight + 16;
  return {
    x: edge + dir * BODY_NODES.reduce((s, n) => s + n.x * n.mass, 0) / mass,
    y: platformY - 4 + BODY_NODES.reduce((s, n) => s + n.y * n.mass, 0) / mass,
  };
}
