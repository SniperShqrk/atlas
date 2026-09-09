/**
 * ATLAS — movement patterns.
 *
 * Common mistakes are a property of the movement, not of the exercise. Letting
 * the bar drift toward the face is the same error on a flat bench, an incline
 * bench, a dumbbell press and a Smith press, and writing it out 162 times
 * produces 162 chances to write it slightly wrong. So the coaching lives on
 * the pattern, an exercise names its pattern, and anything genuinely specific
 * to one lift is added as an override on that lift.
 *
 * The taxonomy is the standard one strength coaches use — press, pull, hinge,
 * squat, lunge, carry, and the isolation patterns that hang off them — because
 * it is also how a programme is checked for gaps. It is the same structure the
 * planner and the balance analysis reason about.
 */

export type MovementPattern =
  // upper push
  | 'horizontal_press'
  | 'vertical_press'
  | 'dip'
  | 'chest_fly'
  // upper pull
  | 'vertical_pull'
  | 'horizontal_pull'
  | 'straight_arm_pull'
  | 'rear_delt'
  | 'shrug'
  // shoulders / arms
  | 'lateral_raise'
  | 'front_raise'
  | 'elbow_flexion'
  | 'elbow_extension'
  | 'wrist'
  // lower
  | 'squat'
  | 'leg_press'
  | 'lunge'
  | 'hinge'
  | 'knee_flexion'
  | 'knee_extension'
  | 'hip_thrust'
  | 'hip_abduction'
  | 'calf_raise'
  | 'back_extension'
  // core
  | 'trunk_flexion'
  | 'anti_extension'
  | 'rotation'
  | 'anti_rotation'
  | 'anti_lateral_flexion'
  | 'carry';

export interface PatternInfo {
  id: MovementPattern;
  label: string;
  /** what the pattern is, in one line */
  summary: string;
  /** the errors that actually cost people progress, worst first */
  commonMistakes: string[];
}

export const PATTERNS: Record<MovementPattern, PatternInfo> = {
  /* ---------------- upper push ---------------- */
  horizontal_press: {
    id: 'horizontal_press',
    label: 'Horizontal Press',
    summary: 'Pressing a load away from the chest while lying or seated upright.',
    commonMistakes: [
      'Letting the shoulder blades roll forward at the top. They stay pinned down and back for the whole set — losing that position is what turns a chest press into a shoulder press, and it is where most bench-related shoulder pain starts.',
      'Flaring the elbows to ninety degrees. Around 45–70° from the torso keeps the load on the chest and off the front of the shoulder capsule.',
      'Bouncing the bar off the ribs to get out of the bottom. It hides a weak position rather than fixing one, and the rep you cannot do without a bounce is the rep you actually need to train.',
      'Half-repping under a load that is too heavy. A full stretch at the bottom is where most of the growth stimulus lives.',
    ],
  },
  vertical_press: {
    id: 'vertical_press',
    label: 'Vertical Press',
    summary: 'Pressing a load overhead from the shoulders.',
    commonMistakes: [
      'Leaning back to turn it into an incline press. If the ribcage flares and the lower back arches, the weight is too heavy — squeeze the glutes and brace to keep the ribs down.',
      'Stopping short of lockout. The last few degrees overhead are the part of the range most people are weakest in, and skipping them is why the lift stalls.',
      'Letting the bar path bow forward around the head instead of moving the head back and pushing the bar straight up past the face.',
      'Pressing from a shrugged start. Set the shoulders down before the first rep so the delts do the work rather than the traps.',
    ],
  },
  dip: {
    id: 'dip',
    label: 'Dip',
    summary: 'Pressing your own bodyweight up between parallel supports.',
    commonMistakes: [
      'Going deeper than the shoulder can control. Stop when the upper arm is roughly parallel to the floor unless you have earned more depth — this is the single most common cause of a dip injury.',
      'Shrugging up at the bottom. Keep the shoulders pulled down away from the ears throughout.',
      'Adding load before the bodyweight version is clean. Fifteen controlled bodyweight reps first, then a belt.',
      'Torso angle drifting. Upright targets triceps, leaning forward targets chest — pick one and hold it, rather than swinging between them as you fatigue.',
    ],
  },
  chest_fly: {
    id: 'chest_fly',
    label: 'Chest Fly',
    summary: 'Bringing the arms together across the body with the elbow angle fixed.',
    commonMistakes: [
      'Bending and straightening the elbow, which turns a fly into a clumsy press. Set a soft elbow angle at the start and keep it constant.',
      'Going too heavy. This is a stretch-and-squeeze movement; load that forces the elbows to close is load that has stopped training the chest.',
      'Stopping at the midline. Bringing the hands together and slightly past is where the contraction actually happens.',
      'Letting the shoulders roll forward at the bottom of the stretch, which shifts the strain onto the joint rather than the muscle.',
    ],
  },

  /* ---------------- upper pull ---------------- */
  vertical_pull: {
    id: 'vertical_pull',
    label: 'Vertical Pull',
    summary: 'Pulling a load down from overhead, or pulling yourself up to it.',
    commonMistakes: [
      'Starting the pull with the arms. Depress the shoulder blades first, then bend the elbows — leading with the biceps is why people feel this in their arms and not their back.',
      'Kipping or swinging to get reps. If the last two reps need body english, the set ended two reps ago.',
      'Not letting the shoulders travel all the way up at the top of the stretch. The lats lengthen there, and cutting it short removes most of the point.',
      'Pulling the bar behind the neck. No mechanical advantage and a real shoulder cost.',
    ],
  },
  horizontal_pull: {
    id: 'horizontal_pull',
    label: 'Horizontal Pull',
    summary: 'Pulling a load toward the torso with the arms in front of you.',
    commonMistakes: [
      'Using the lower back as a lever. The torso angle is set at the start and does not change — if you are rowing yourself upright with each rep, the weight is winning.',
      'Pulling to the wrong place. Toward the belly hits the lats; toward the sternum hits the mid-back. Drifting between them trains neither well.',
      'Rushing the negative. Three-quarters of a row is the part where you lower it, and most people give that away.',
      'Shrugging at the top instead of retracting. The shoulder blades come together, they do not come up.',
    ],
  },
  straight_arm_pull: {
    id: 'straight_arm_pull',
    label: 'Straight-Arm Pull',
    summary: 'Driving the arms down or over with the elbows locked, isolating the lats.',
    commonMistakes: [
      'Bending the elbows, which quietly turns it into a triceps pushdown.',
      'Standing too upright. A slight hinge at the hips lengthens the lats and gives the movement a range worth training.',
      'Going heavy enough that the torso has to rock. This is an isolation movement — the load is meant to feel light.',
    ],
  },
  rear_delt: {
    id: 'rear_delt',
    label: 'Rear Delt',
    summary: 'Pulling the arms out and back at shoulder height, away from the midline.',
    commonMistakes: [
      'Turning it into a row by bending the elbows and pulling with the lats. The elbows stay nearly fixed and the arms travel outward, not backward.',
      'Loading it like a compound. Rear delts respond to 12–20 controlled reps, not to weight that requires momentum.',
      'Letting the traps take over by shrugging. Keep the shoulders down.',
      'Skipping the movement entirely because it is unglamorous. Every press you do trains the front delt for free; nothing trains the rear delt by accident.',
    ],
  },
  shrug: {
    id: 'shrug',
    label: 'Shrug',
    summary: 'Elevating the shoulder blades straight up against load.',
    commonMistakes: [
      'Rolling the shoulders. Straight up and straight down — the roll adds nothing and grinds the joint.',
      'Bending the elbows, which hands the work to the biceps.',
      'No pause at the top. A short hold is what makes a shrug worth doing.',
    ],
  },

  /* ---------------- shoulders / arms ---------------- */
  lateral_raise: {
    id: 'lateral_raise',
    label: 'Lateral Raise',
    summary: 'Raising the arms out to the side against gravity or a cable.',
    commonMistakes: [
      'Swinging with the hips. The most abused movement in any gym — if the torso moves, the side delt is not the thing being trained.',
      'Going above shoulder height, where the traps take over and the delt stops being the limiting factor.',
      'Leading with the hands rather than the elbows. Think about pushing the elbows out and up.',
      'Choosing a weight that only allows six reps. This is a small muscle with a short lever; 12–20 reps is where it grows.',
    ],
  },
  front_raise: {
    id: 'front_raise',
    label: 'Front Raise',
    summary: 'Raising the arms forward to shoulder height.',
    commonMistakes: [
      'Doing it at all when you already press heavily. Front delts get plenty of volume from every press — this is a movement most people can drop.',
      'Rocking backward to start the rep, which loads the lower back and unloads the target.',
      'Going past shoulder height, where the traps and serratus take over.',
    ],
  },
  elbow_flexion: {
    id: 'elbow_flexion',
    label: 'Elbow Flexion',
    summary: 'Bending the elbow against load — every curl variation.',
    commonMistakes: [
      'Swinging the weight up with the lower back. If the torso is moving, drop the load — this is the reason most people plateau on curls.',
      'Letting the elbows drift forward at the top, which hands the last third of the rep to the front delts.',
      'Cutting the bottom off. The biceps are longest, and most trainable, at full extension.',
      'Only training the supinated version. Neutral and pronated grips reach the brachialis and brachioradialis, which is a large part of arm thickness.',
    ],
  },
  elbow_extension: {
    id: 'elbow_extension',
    label: 'Elbow Extension',
    summary: 'Straightening the elbow against load — every triceps movement.',
    commonMistakes: [
      'Letting the elbows flare and travel. They stay pinned; only the forearm moves.',
      'Skipping the overhead versions. The long head of the triceps is only fully stretched with the arm overhead, and it is the largest of the three heads.',
      'Turning a pushdown into a lean-forward press with the whole bodyweight.',
      'Locking out violently. The elbow does not enjoy being slammed straight under load.',
    ],
  },
  wrist: {
    id: 'wrist',
    label: 'Forearm',
    summary: 'Flexing, extending or gripping against load at the wrist.',
    commonMistakes: [
      'Loading it like a bigger muscle. Forearms are worked constantly by everything else you do; direct work is a finisher, not a main lift.',
      'Only training flexion. The extensors on the back of the forearm are what keep the elbow healthy under heavy pulling.',
      'Rushing. Slow, full-range reps are the only version of this that does anything.',
    ],
  },

  /* ---------------- lower ---------------- */
  squat: {
    id: 'squat',
    label: 'Squat',
    summary: 'Bending at the knee and hip together under an axially loaded torso.',
    commonMistakes: [
      'Letting the hips shoot up first out of the bottom, turning the squat into a good morning. Hips and shoulders rise together.',
      'Knees caving inward. Push them out over the middle of the foot — usually a cue problem at light loads and a glute-strength problem at heavy ones.',
      'Cutting depth. Below parallel is where the glutes and adductors actually contribute; a quarter squat trains a quarter of the lift.',
      'Bracing wrong. Air into the belly and against the whole waistband before you descend, not a chest full of air held high.',
    ],
  },
  leg_press: {
    id: 'leg_press',
    label: 'Leg Press',
    summary: 'Pressing a sled away with the legs from a supported torso.',
    commonMistakes: [
      "Letting the lower back round off the pad at the bottom. That is the point where a leg press starts hurting spines — stop the descent just above it.",
      'Locking the knees out hard at the top under a heavy sled.',
      'Loading it as an ego lift. The leg press flatters everyone; the useful version is a controlled range, not a plate count.',
      'Foot placement drifting between sets. High and wide favours glutes and hamstrings, low and narrow favours quads — pick one per set.',
    ],
  },
  lunge: {
    id: 'lunge',
    label: 'Lunge / Split Squat',
    summary: 'Loading one leg at a time in a split stance.',
    commonMistakes: [
      'Too short a stride, which jams the front knee and takes the glute out of it entirely.',
      'Pushing off the back foot. The back leg is a kickstand — drive through the front heel.',
      'Letting the torso collapse forward as the set fatigues.',
      'Doing all the reps on the strong side first and then matching the weak side. Lead with the weaker leg and let it set the number.',
    ],
  },
  hinge: {
    id: 'hinge',
    label: 'Hip Hinge',
    summary: 'Driving the hips back and forward with a braced spine and minimal knee bend.',
    commonMistakes: [
      'Squatting it instead of hinging it. The hips travel backward, the knees stay soft but relatively still — this is the single most common error and it turns every deadlift variant into a bad squat.',
      'Losing the neutral spine. The moment the lower back rounds under load, the set is over.',
      'Letting the bar drift away from the legs, which multiplies the load on the lower back.',
      'Hyperextending at the top. Finish standing tall with the glutes squeezed, not leaning back.',
    ],
  },
  knee_flexion: {
    id: 'knee_flexion',
    label: 'Knee Flexion',
    summary: 'Bending the knee against load — hamstring curls.',
    commonMistakes: [
      'Lifting the hips off the pad to move more weight, which removes the hamstrings from the movement.',
      'Skipping the eccentric. Hamstrings are highly responsive to slow lowering and it is the part everyone rushes.',
      'Only ever training curls. The hamstring crosses two joints — it needs a hinge as well as a curl to be fully trained.',
    ],
  },
  knee_extension: {
    id: 'knee_extension',
    label: 'Knee Extension',
    summary: 'Straightening the knee against load — leg extensions.',
    commonMistakes: [
      'Slamming into lockout. Pause and squeeze instead; the knee does not need the impact.',
      'Gripping the handles and leaning back to swing the pad up.',
      'Setting the back pad wrong so the knee is not aligned with the machine pivot, which puts the load through the joint rather than the muscle.',
    ],
  },
  hip_thrust: {
    id: 'hip_thrust',
    label: 'Hip Thrust',
    summary: 'Driving the hips up from a supported upper back.',
    commonMistakes: [
      'Hyperextending the lower back at the top instead of finishing with a posterior tilt and a hard glute squeeze. The rib cage stays down.',
      'Bench too high or too low. The shoulder blades should sit right at the bench edge.',
      'Feet in the wrong place. At the top, the shins should be vertical — too close makes it quad-dominant, too far makes it a hamstring exercise.',
      'No pause at lockout. A one-second hold is what separates this from a hip swing.',
    ],
  },
  hip_abduction: {
    id: 'hip_abduction',
    label: 'Hip Abduction',
    summary: 'Moving the leg away from or across the midline against resistance.',
    commonMistakes: [
      'Using momentum on a machine that rewards it heavily.',
      'Leaning the torso to squeeze out extra range instead of moving at the hip.',
      'Treating it as a warm-up only. Glute medius work has real value for hip stability and for how a physique reads from behind.',
    ],
  },
  calf_raise: {
    id: 'calf_raise',
    label: 'Calf Raise',
    summary: 'Plantar-flexing the ankle against load.',
    commonMistakes: [
      'Bouncing on the tendon. The Achilles will happily do the work the muscle should — a pause at the bottom stretch is what forces the calf to contribute.',
      'Partial range at the top. Rise all the way onto the toes and hold.',
      'Training only the straight-leg version. Seated calf raises with the knee bent are what reach the soleus, which is most of the lower-leg mass.',
      'Too few reps. Calves are worked all day walking; they need volume and proximity to failure to respond.',
    ],
  },
  back_extension: {
    id: 'back_extension',
    label: 'Back Extension',
    summary: 'Extending the spine or hips against gravity from a supported position.',
    commonMistakes: [
      'Hyperextending at the top and hanging on the joints rather than stopping at neutral.',
      'Going too heavy too soon. The lower back responds well to controlled volume and badly to loaded ego.',
      'Rushing the reps rather than moving deliberately through the range.',
    ],
  },

  /* ---------------- core ---------------- */
  trunk_flexion: {
    id: 'trunk_flexion',
    label: 'Trunk Flexion',
    summary: 'Curling the ribcage toward the pelvis, or the pelvis toward the ribs.',
    commonMistakes: [
      'Pulling on the head and neck instead of curling the spine.',
      'Using the hip flexors to swing the legs rather than curling the pelvis under. If the lower back arches off, it is a hip flexor exercise.',
      'Never adding load. Abs are a muscle; if you can do fifty reps, add weight rather than reps.',
      'Rushing to a rep count. Two seconds up, two seconds down beats twice as many fast ones.',
    ],
  },
  anti_extension: {
    id: 'anti_extension',
    label: 'Anti-Extension',
    summary: 'Resisting the spine being pulled into extension — planks and rollouts.',
    commonMistakes: [
      'Letting the hips sag. The moment the lower back arches, the abs have stopped working and the spine is holding the position.',
      'Holding a plank for minutes. Past about 45 seconds you are training tolerance for boredom; make it harder instead of longer.',
      'Holding the breath. Brace and breathe shallowly against the brace.',
    ],
  },
  rotation: {
    id: 'rotation',
    label: 'Rotation',
    summary: 'Turning the torso against resistance.',
    commonMistakes: [
      'Rotating from the lower back rather than the ribcage. The lumbar spine has very little rotation available and forcing it there is how people hurt themselves.',
      'Moving fast with a heavy load, which is momentum rather than training.',
      'Letting the hips turn with the shoulders, which removes the resistance entirely.',
    ],
  },
  anti_rotation: {
    id: 'anti_rotation',
    label: 'Anti-Rotation',
    summary: 'Resisting a force trying to turn you — the most transferable core work there is.',
    commonMistakes: [
      'Standing too close to the anchor, which removes most of the resistance.',
      'Letting the arms bend and the load drift back toward the chest.',
      'Rushing. The value is in the hold at full extension, not in the reps.',
    ],
  },
  anti_lateral_flexion: {
    id: 'anti_lateral_flexion',
    label: 'Anti-Lateral Flexion',
    summary: 'Resisting being bent sideways — side planks and single-sided carries.',
    commonMistakes: [
      'Letting the hip drop toward the floor.',
      'Rotating the chest toward the ground instead of keeping the torso square.',
      'Only training one side because it is the easier one to set up.',
    ],
  },
  carry: {
    id: 'carry',
    label: 'Loaded Carry',
    summary: 'Walking under load with a braced trunk.',
    commonMistakes: [
      'Leaning away from the weight instead of standing tall and letting the trunk resist it.',
      'Shrugging the load up with the traps rather than letting the arms hang and the grip work.',
      'Taking long strides. Short, controlled steps keep the trunk doing its job.',
    ],
  },
};

export const PATTERN_ORDER: MovementPattern[] = Object.keys(PATTERNS) as MovementPattern[];

/** Broad buckets, for the library's pattern filter. */
export const PATTERN_GROUPS: { label: string; patterns: MovementPattern[] }[] = [
  { label: 'Press', patterns: ['horizontal_press', 'vertical_press', 'dip', 'chest_fly'] },
  {
    label: 'Pull',
    patterns: ['vertical_pull', 'horizontal_pull', 'straight_arm_pull', 'rear_delt', 'shrug'],
  },
  {
    label: 'Arms',
    patterns: ['elbow_flexion', 'elbow_extension', 'wrist', 'lateral_raise', 'front_raise'],
  },
  { label: 'Squat', patterns: ['squat', 'leg_press', 'lunge', 'knee_extension'] },
  {
    label: 'Hinge',
    patterns: ['hinge', 'knee_flexion', 'hip_thrust', 'hip_abduction', 'back_extension'],
  },
  { label: 'Calves', patterns: ['calf_raise'] },
  {
    label: 'Core',
    patterns: [
      'trunk_flexion',
      'anti_extension',
      'rotation',
      'anti_rotation',
      'anti_lateral_flexion',
      'carry',
    ],
  },
];
