/* Two-bone forward and inverse kinematics. Angles are degrees: 0 = straight down, positive = toward +x. */
import type { Bend, LimbPose, Vec } from '../types';
import { RAD } from './geometry';

/** joint positions [origin, joint, end] from the two bone angles */
export function fk(o: Vec, l1: number, l2: number, a1: number, a2: number): [Vec, Vec, Vec] {
  const e: Vec = [o[0] + l1 * Math.sin(a1 * RAD), o[1] + l1 * Math.cos(a1 * RAD)];
  const b = (a1 + a2) * RAD;
  return [o, e, [e[0] + l2 * Math.sin(b), e[1] + l2 * Math.cos(b)]];
}

/** Solves a limb so its end reaches `t`. `s` picks which way the joint bends. Out-of-reach targets are clamped. */
export function ik(o: Vec, l1: number, l2: number, t: Vec, s: Bend): LimbPose {
  const dx = t[0] - o[0], dy = t[1] - o[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1), l1 + l2 - 0.5);
  const cl = (v: number) => Math.max(-1, Math.min(1, v));
  const phi = Math.atan2(dx, dy);
  const al = Math.acos(cl((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const be = Math.acos(cl((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2)));
  return [(phi - s * al) / RAD, s * (Math.PI - be) / RAD, s];
}
