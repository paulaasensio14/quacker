export const DEFAULT_PROFILE_PRIVACY = Object.freeze({
  profile: false,
  activity: false,
  library: false,
  lists: false,
  reviews: false,
  stats: false,
  favorites: false
});

export function normalizeProfilePrivacy(value) {
  const source =
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
      ? value
      : {};

  return {
    profile: source.profile === true,
    activity: source.activity === true,
    library: source.library === true,
    lists: source.lists === true,
    reviews: source.reviews === true,
    stats: source.stats === true,
    favorites: source.favorites === true
  };
}
