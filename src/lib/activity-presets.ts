export interface ActivityPreset {
  id: string
  name: string
  icon: string
  category: string
  enabled: boolean
  image_url?: string
}

export const ACTIVITY_CATEGORIES = [
  'Sports',
  'Social',
  'Outdoors',
  'Entertainment',
  'Food & Drink',
  'Fitness',
  'Other',
] as const

/** Map of keywords to emojis for auto-suggesting icons based on activity name */
const EMOJI_KEYWORDS: [string[], string][] = [
  // Sports
  [['basketball'], '🏀'],
  [['football'], '🏈'],
  [['soccer'], '⚽'],
  [['volleyball'], '🏐'],
  [['tennis'], '🎾'],
  [['pickleball', 'paddle', 'ping pong', 'table tennis'], '🏓'],
  [['golf', 'disc golf'], '⛳'],
  [['softball'], '🥎'],
  [['bowling'], '🎳'],
  [['hockey'], '🏒'],
  [['baseball'], '⚾'],
  [['dart'], '🎯'],
  [['pool', 'billiard'], '🎱'],
  [['lacrosse'], '🥍'],
  [['badminton', 'shuttlecock'], '🏸'],
  [['boxing'], '🥊'],
  [['wrestling'], '🤼'],
  [['fencing'], '🤺'],
  [['rugby'], '🏉'],
  [['cricket'], '🏏'],
  [['skateboard'], '🛹'],

  // Social
  [['dinner', 'supper'], '🍽️'],
  [['happy hour', 'drinks', 'bar'], '🍺'],
  [['brunch', 'mimosa', 'champagne'], '🥂'],
  [['game night', 'video game', 'gaming'], '🎮'],
  [['paint', 'art', 'drawing'], '🎨'],
  [['karaoke', 'sing'], '🎤'],
  [['book club', 'reading'], '📚'],
  [['poker', 'card game', 'cards'], '🃏'],
  [['bbq', 'barbecue', 'grill'], '🔥'],
  [['potluck'], '🥘'],
  [['party', 'celebration', 'birthday'], '🎉'],
  [['dance', 'dancing'], '💃'],
  [['bonfire'], '🔥'],
  [['meetup', 'hangout', 'get together'], '👋'],

  // Outdoors
  [['hik'], '🥾'],
  [['beach', 'shore'], '🏖️'],
  [['camp'], '⛺'],
  [['fish'], '🎣'],
  [['ski'], '⛷️'],
  [['snowboard'], '🏂'],
  [['surf'], '🏄'],
  [['kayak', 'canoe', 'paddle board'], '🛶'],
  [['bik', 'cycl', 'bicycle'], '🚴'],
  [['rock climb', 'climbing'], '🧗'],
  [['horse', 'equestrian', 'riding'], '🏇'],
  [['sail', 'boat'], '⛵'],
  [['garden'], '🌱'],
  [['bird watch', 'nature walk'], '🌿'],
  [['snow', 'sled'], '🛷'],

  // Entertainment
  [['movie', 'film', 'cinema'], '🎬'],
  [['concert', 'live music', 'show'], '🎵'],
  [['comedy', 'standup', 'stand-up', 'improv'], '😂'],
  [['trivia', 'quiz'], '🧠'],
  [['escape room', 'puzzle'], '🔐'],
  [['arcade'], '🕹️'],
  [['sporting event', 'stadium', 'arena'], '🏟️'],
  [['museum', 'gallery', 'exhibit'], '🖼️'],
  [['theater', 'theatre', 'play', 'musical'], '🎭'],
  [['festival', 'fair', 'carnival'], '🎪'],
  [['photo', 'photography'], '📸'],

  // Food & Drink
  [['pizza'], '🍕'],
  [['coffee', 'cafe', 'café'], '☕'],
  [['wine'], '🍷'],
  [['taco', 'mexican'], '🌮'],
  [['sushi', 'japanese'], '🍣'],
  [['burger', 'hamburger'], '🍔'],
  [['ice cream', 'gelato', 'froyo'], '🍦'],
  [['breakfast', 'pancake', 'waffle'], '🥞'],
  [['bak', 'cookie', 'cake'], '🧁'],
  [['tea'], '🍵'],
  [['cocktail', 'margarita'], '🍸'],
  [['beer', 'brewery'], '🍻'],
  [['lunch'], '🥪'],
  [['ramen', 'noodle', 'pho'], '🍜'],
  [['steak'], '🥩'],
  [['seafood', 'crab', 'lobster', 'shrimp'], '🦞'],
  [['donut', 'doughnut'], '🍩'],
  [['chocolate', 'fondue'], '🍫'],

  // Fitness
  [['run', 'jog', 'marathon', '5k', '10k'], '🏃'],
  [['yoga', 'stretch', 'pilates'], '🧘'],
  [['gym', 'weight', 'lift'], '🏋️'],
  [['swim'], '🏊'],
  [['crossfit', 'hiit', 'workout'], '💪'],
  [['martial art', 'karate', 'jiu', 'mma', 'kickbox'], '🥋'],
  [['walk'], '🚶'],
  [['spin', 'peloton'], '🚲'],
  [['jump rope', 'skipping'], '⏱️'],

  // Other
  [['road trip', 'drive', 'car'], '🚗'],
  [['volunteer', 'charity', 'community service'], '🤝'],
  [['study', 'homework', 'tutor'], '📖'],
  [['workshop', 'class', 'lesson', 'seminar'], '🛠️'],
  [['travel', 'trip', 'vacation'], '✈️'],
  [['dog', 'puppy', 'pet'], '🐕'],
  [['church', 'worship', 'bible', 'pray'], '⛪'],
  [['meditation', 'mindful'], '🧘'],
  [['clean', 'cleanup'], '🧹'],
  [['move', 'moving'], '📦'],
  [['shop', 'mall'], '🛍️'],
  [['spa', 'massage', 'facial'], '💆'],
  [['meeting', 'conference'], '📋'],
  [['picnic'], '🧺'],
  [['water park', 'waterpark', 'pool party'], '🌊'],
  [['laser tag', 'paintball'], '🔫'],
  [['trampoline'], '🤸'],
  [['go kart', 'go-kart', 'racing'], '🏎️'],
  [['board game'], '🎲'],
  [['chess'], '♟️'],
  [['frisbee', 'disc'], '🥏'],
  [['cornhole', 'bean bag'], '🎯'],
  [['ping pong'], '🏓'],
]

/**
 * Suggest an emoji based on an activity name by matching keywords.
 * Returns empty string if no match found.
 */
export function suggestEmoji(name: string): string {
  const lower = name.toLowerCase().trim()
  if (!lower) return ''

  // First try exact/full match
  for (const [keywords, emoji] of EMOJI_KEYWORDS) {
    for (const kw of keywords) {
      if (lower === kw || lower === kw + 's') return emoji
    }
  }

  // Then try "includes" match
  for (const [keywords, emoji] of EMOJI_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return emoji
    }
  }

  return ''
}

export const DEFAULT_ACTIVITY_PRESETS: ActivityPreset[] = [
  // Popular (pinned at top)
  { id: 'golf', name: 'Golf', icon: '⛳', category: 'Sports', enabled: true },
  { id: 'volleyball', name: 'Volleyball', icon: '🏐', category: 'Sports', enabled: true },
  { id: 'pickleball', name: 'Pickleball', icon: '🏓', category: 'Sports', enabled: true },

  // Sports
  { id: 'basketball', name: 'Basketball', icon: '🏀', category: 'Sports', enabled: true },
  { id: 'football', name: 'Football', icon: '🏈', category: 'Sports', enabled: true },
  { id: 'soccer', name: 'Soccer', icon: '⚽', category: 'Sports', enabled: true },
  { id: 'tennis', name: 'Tennis', icon: '🎾', category: 'Sports', enabled: true },
  { id: 'softball', name: 'Softball', icon: '🥎', category: 'Sports', enabled: true },
  { id: 'bowling', name: 'Bowling', icon: '🎳', category: 'Sports', enabled: true },
  { id: 'hockey', name: 'Hockey', icon: '🏒', category: 'Sports', enabled: true },
  { id: 'baseball', name: 'Baseball', icon: '⚾', category: 'Sports', enabled: true },
  { id: 'darts', name: 'Darts', icon: '🎯', category: 'Sports', enabled: true },
  { id: 'pool', name: 'Pool / Billiards', icon: '🎱', category: 'Sports', enabled: true },

  // Social
  { id: 'dinner', name: 'Dinner', icon: '🍽️', category: 'Social', enabled: true },
  { id: 'happy-hour', name: 'Happy Hour', icon: '🍺', category: 'Social', enabled: true },
  { id: 'brunch', name: 'Brunch', icon: '🥂', category: 'Social', enabled: true },
  { id: 'game-night', name: 'Game Night', icon: '🎮', category: 'Social', enabled: true },
  { id: 'paint-sip', name: 'Paint & Sip', icon: '🎨', category: 'Social', enabled: true },
  { id: 'karaoke', name: 'Karaoke', icon: '🎤', category: 'Social', enabled: true },
  { id: 'book-club', name: 'Book Club', icon: '📚', category: 'Social', enabled: true },
  { id: 'poker', name: 'Poker Night', icon: '🃏', category: 'Social', enabled: true },
  { id: 'bbq', name: 'BBQ', icon: '🔥', category: 'Social', enabled: true },
  { id: 'potluck', name: 'Potluck', icon: '🥘', category: 'Social', enabled: true },

  // Outdoors
  { id: 'hiking', name: 'Hiking', icon: '🥾', category: 'Outdoors', enabled: true },
  { id: 'beach', name: 'Beach Day', icon: '🏖️', category: 'Outdoors', enabled: true },
  { id: 'camping', name: 'Camping', icon: '⛺', category: 'Outdoors', enabled: true },
  { id: 'fishing', name: 'Fishing', icon: '🎣', category: 'Outdoors', enabled: true },
  { id: 'skiing', name: 'Skiing', icon: '⛷️', category: 'Outdoors', enabled: true },
  { id: 'snowboarding', name: 'Snowboarding', icon: '🏂', category: 'Outdoors', enabled: true },
  { id: 'surfing', name: 'Surfing', icon: '🏄', category: 'Outdoors', enabled: true },
  { id: 'kayaking', name: 'Kayaking', icon: '🛶', category: 'Outdoors', enabled: true },
  { id: 'biking', name: 'Biking', icon: '🚴', category: 'Outdoors', enabled: true },

  // Entertainment
  { id: 'movie', name: 'Movie Night', icon: '🎬', category: 'Entertainment', enabled: true },
  { id: 'concert', name: 'Concert', icon: '🎵', category: 'Entertainment', enabled: true },
  { id: 'comedy', name: 'Comedy Show', icon: '😂', category: 'Entertainment', enabled: true },
  { id: 'trivia', name: 'Trivia Night', icon: '🧠', category: 'Entertainment', enabled: true },
  { id: 'escape-room', name: 'Escape Room', icon: '🔐', category: 'Entertainment', enabled: true },
  { id: 'arcade', name: 'Arcade', icon: '🕹️', category: 'Entertainment', enabled: true },
  { id: 'sporting-event', name: 'Sporting Event', icon: '🏟️', category: 'Entertainment', enabled: true },

  // Food & Drink
  { id: 'pizza', name: 'Pizza Night', icon: '🍕', category: 'Food & Drink', enabled: true },
  { id: 'coffee', name: 'Coffee Meetup', icon: '☕', category: 'Food & Drink', enabled: true },
  { id: 'wine-tasting', name: 'Wine Tasting', icon: '🍷', category: 'Food & Drink', enabled: true },
  { id: 'taco-tuesday', name: 'Taco Tuesday', icon: '🌮', category: 'Food & Drink', enabled: true },
  { id: 'sushi', name: 'Sushi Night', icon: '🍣', category: 'Food & Drink', enabled: true },

  // Fitness
  { id: 'running', name: 'Running', icon: '🏃', category: 'Fitness', enabled: true },
  { id: 'yoga', name: 'Yoga', icon: '🧘', category: 'Fitness', enabled: true },
  { id: 'gym', name: 'Gym Session', icon: '🏋️', category: 'Fitness', enabled: true },
  { id: 'swimming', name: 'Swimming', icon: '🏊', category: 'Fitness', enabled: true },
  { id: 'crossfit', name: 'CrossFit', icon: '💪', category: 'Fitness', enabled: true },

  // Other
  { id: 'road-trip', name: 'Road Trip', icon: '🚗', category: 'Other', enabled: true },
  { id: 'volunteering', name: 'Volunteering', icon: '🤝', category: 'Other', enabled: true },
  { id: 'study-group', name: 'Study Group', icon: '📖', category: 'Other', enabled: true },
  { id: 'workshop', name: 'Workshop', icon: '🛠️', category: 'Other', enabled: true },
  { id: 'other', name: 'Other', icon: '📌', category: 'Other', enabled: true },
]
