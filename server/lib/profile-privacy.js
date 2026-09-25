export const PROFILE_VISIBILITIES = Object.freeze([
  "public",
  "followers",
  "friends",
  "hidden"
]);

export const DEFAULT_PROFILE_PRIVACY = Object.freeze({
  profile: false,
  profileVisibility: "hidden",
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

  const requestedVisibility =
    typeof source.profileVisibility === "string"
      ? source.profileVisibility.trim().toLowerCase()
      : "";

  const profileVisibility =
    PROFILE_VISIBILITIES.includes(requestedVisibility)
      ? requestedVisibility
      : source.profile === true
        ? "public"
        : "hidden";

  return {
    profile: profileVisibility === "public",
    profileVisibility,
    activity: source.activity === true,
    library: source.library === true,
    lists: source.lists === true,
    reviews: source.reviews === true,
    stats: source.stats === true,
    favorites: source.favorites === true
  };
}
