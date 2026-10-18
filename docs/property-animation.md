# Property Animation clips

These clips animate a Cube or Sprite's Position, Rotation Y, Scale or Visibility. They are distinct from Sprite frame-animation assets and skeletal clips. Rotation Y tilts around the world Y-axis; it is not a flat XY-plane spin.

Select the Cube or Sprite, then use **Property Animation Clips → Add Animation Clip** in its Inspector (or Edit beside an existing clip). Give the clip a name, duration and Once/Loop/Ping-Pong playback. Add captures the object's authored value at the chosen time; adding at an existing time replaces that keyframe. Edit the X/Y/Z fields, Rotation Y in degrees, or Visible/Hidden directly to create different poses without leaving the modal. Easing belongs to the incoming segment at that keyframe.

Times must be unique on each track, between zero and Duration. Shortening Duration cannot cut off existing keys. Invalid edits show feedback and recover the prior valid value. Imported malformed clips are not silently repaired or discarded.

Use Preview to play, or the Preview time slider to inspect a pose through the same gameplay sampler. These are temporary views: Stop / Restore Pose, Cancel and Save restore the pre-preview pose. Cancel discards working clip edits; Save Clip commits one changed edit to project history. An unchanged Save adds no Undo entry.

To run the clip in a game, add the existing **Play Animation** action to the object's chosen event and select its clip name. For a moving solid platform, preserve the established collision/Moving Platform setup; visual animation alone does not create collision. Save/reopen and export use the ordinary project clip records. No script or separate timeline runtime is required.

Property clips own the entity pose, not Sprite frame-animation assets. A sampled property Visibility track retains its paused/completed value across frame-animation refreshes without rewriting the Sprite Renderer component. A parented editor scrub holds its temporary world pose until Stop, Cancel or Save; authored local offsets remain untouched.

Position keys retain the existing absolute world-space interpretation, including duplicated or reused Prefabs: they are not automatically rebased to the drop position. Legacy parent/socket gameplay resolution still resumes when ordinary property playback stops; the editor preview does not change that compatibility policy. For parented moving platforms use the established Moving Platform component's world-axis motion. Do not assign competing position controllers to the same object and expect animation to override their ownership. Flat XY spin, skeletal animation, root motion, socket gameplay end-pose retention and cinematic timelines are not implied by these controls.
