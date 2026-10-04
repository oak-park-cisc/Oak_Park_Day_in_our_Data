// Oak Park points of interest shown as toggleable overlays on the crime map.
// Coordinates come from OpenStreetMap (Nominatim). To add a landmark, append
// an entry to the matching category's `places` list.

const LANDMARK_CATEGORIES = [
  {
    key: "historic",
    label: "Historic landmarks",
    icon: "🏛️",
    color: "#7c3aed",
    places: [
      { name: "Frank Lloyd Wright Home & Studio", address: "951 Chicago Ave", lat: 41.89405, lon: -87.79967 },
      { name: "Unity Temple", address: "875 Lake St", lat: 41.88835, lon: -87.79685 },
      { name: "Ernest Hemingway Birthplace", address: "339 N Oak Park Ave", lat: 41.89277, lon: -87.79504 },
      { name: "Pleasant Home", address: "217 S Home Ave", lat: 41.88499, lon: -87.80017 },
      { name: "Cheney Mansion", address: "220 N Euclid Ave", lat: 41.89106, lon: -87.79226 },
    ],
  },
  {
    key: "parks",
    label: "Parks & gardens",
    icon: "🌳",
    color: "#16a34a",
    places: [
      { name: "Scoville Park", address: "800 Lake St", lat: 41.88945, lon: -87.79527 },
      { name: "Austin Gardens", address: "167 Forest Ave", lat: 41.88951, lon: -87.80078 },
      { name: "Oak Park Conservatory", address: "615 Garfield St", lat: 41.87143, lon: -87.78969 },
      { name: "Rehm Park", address: "515 Garfield St", lat: 41.8707, lon: -87.78783 },
      { name: "Longfellow Park", address: "610 S Ridgeland Ave", lat: 41.87738, lon: -87.78375 },
      { name: "Lindberg Park", lat: 41.90617, lon: -87.80222 },
      { name: "Taylor Park", lat: 41.90296, lon: -87.78549 },
    ],
  },
  {
    key: "transit",
    label: "Train stations",
    icon: "🚆",
    color: "#2563eb",
    places: [
      { name: "Harlem/Lake (CTA Green)", address: "1 S Harlem Ave", lat: 41.88687, lon: -87.80401 },
      { name: "Oak Park (CTA Green)", address: "100 S Oak Park Ave", lat: 41.88704, lon: -87.79387 },
      { name: "Ridgeland (CTA Green)", address: "36 S Ridgeland Ave", lat: 41.88719, lon: -87.7836 },
      { name: "Austin (CTA Green)", address: "351 N Austin Blvd", lat: 41.88731, lon: -87.77432 },
      { name: "Oak Park (CTA Blue)", address: "950 S Oak Park Ave", lat: 41.87208, lon: -87.79154 },
      { name: "Austin (CTA Blue)", address: "1050 S Austin Blvd", lat: 41.87089, lon: -87.77679 },
      { name: "Oak Park (Metra UP-W)", address: "1115 North Blvd", lat: 41.88706, lon: -87.80156 },
    ],
  },
  {
    key: "safety",
    label: "Police & fire",
    icon: "🚓",
    color: "#dc2626",
    places: [
      { name: "Village Hall & Police Department", address: "123 Madison St", lat: 41.87949, lon: -87.77866 },
      { name: "Fire Station #1", address: "100 N Euclid Ave", lat: 41.88762, lon: -87.79227 },
    ],
  },
  {
    key: "health",
    label: "Hospitals",
    icon: "🏥",
    color: "#db2777",
    places: [
      { name: "Rush Oak Park Hospital", address: "520 S Maple Ave", lat: 41.87892, lon: -87.80307 },
      { name: "West Suburban Medical Center", address: "3 Erie Ct", lat: 41.89161, lon: -87.77628 },
    ],
  },
  {
    key: "schools",
    label: "Schools",
    icon: "🏫",
    color: "#d97706",
    places: [
      { name: "Beye Elementary School", address: "230 N Cuyler Ave", lat: 41.89108, lon: -87.78234 },
      { name: "Hatch Elementary School", address: "1000 N Ridgeland Ave", lat: 41.9048, lon: -87.78318 },
      { name: "Holmes Elementary School", address: "508 N Kenilworth Ave", lat: 41.895, lon: -87.79731 },
      { name: "Irving Elementary School", address: "1125 S Cuyler Ave", lat: 41.86817, lon: -87.78344 },
      { name: "Lincoln Elementary School", address: "1111 S Grove Ave", lat: 41.86814, lon: -87.79587 },
      { name: "Longfellow Elementary School", address: "715 S Highland Ave", lat: 41.8758, lon: -87.78283 },
      { name: "Mann Elementary School", address: "921 N Kenilworth Ave", lat: 41.90255, lon: -87.79851 },
      { name: "Whittier Elementary School", address: "715 N Harvey Ave", lat: 41.89909, lon: -87.78258 },
      { name: "Brooks Middle School", address: "325 S Kenilworth Ave", lat: 41.88245, lon: -87.79774 },
      { name: "Julian Middle School", address: "416 S Ridgeland Ave", lat: 41.88106, lon: -87.78321 },
      { name: "Oak Park & River Forest High School", address: "201 N Scoville Ave", lat: 41.89045, lon: -87.78965 },
      { name: "Fenwick High School", address: "505 Washington Blvd", lat: 41.88078, lon: -87.78859 },
      { name: "Ascension School", lat: 41.87393, lon: -87.79015 },
      { name: "St. Catherine - St. Lucy School", address: "27 Washington Blvd", lat: 41.88172, lon: -87.77596 },
      { name: "St. Edmund School", lat: 41.88475, lon: -87.79395 },
      { name: "St. Giles School", lat: 41.90454, lon: -87.79212 },
      { name: "Intercultural Montessori Language School", lat: 41.88324, lon: -87.785 },
    ],
  },
  {
    key: "libraries",
    label: "Libraries",
    icon: "📚",
    color: "#0891b2",
    places: [
      { name: "Oak Park Public Library", address: "834 Lake St", lat: 41.88919, lon: -87.79636 },
    ],
  },
];
