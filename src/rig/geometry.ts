/* Rig geometry. Local space: pelvis near (0,0), figure faces +x, y grows downward. */

/** The ground line in rig space. Open Peeps bodies are moved down to stand on it (waist-up bodies rest their bottom
    edge on it), so swapping a body keeps the character on the same floor. */
export const GROUND = 189;
