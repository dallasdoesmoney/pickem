// The ghosted team mark that sits behind a player's photo.
//
// Slightly larger than the thing it sits in, so the mark bleeds past the
// corners rather than sitting in the middle of a frame, and faint enough
// to stay behind the player instead of competing with him.
//
// These live here rather than in a component because two very different
// things now draw the same backdrop - the tier list's chips and the daily
// game's faces - and a player who looks like a Raven on one screen and a
// generic head on the other looks like two different features.
export const BACKDROP_SCALE = 1.2;
export const BACKDROP_OPACITY = 0.22;
