/* Static data: emoji sets, colour names, label colours. */

export const EMOJI_CATEGORIES: { name: string; emojis: string }[] = [
  { name: "Frequently used", emojis: "👍 ❤️ 😂 🔥 🎉 👀 ✅ ❌ ⭐ 💯 🙏 👏 😍 🤔 😮 😢 🚀 💡" },
  { name: "Smileys & Emotion", emojis: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 😴 😷 🤒 🤕 🤢 🥵 🥶 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 💀 💩 🤡 👻 👽 🤖" },
  { name: "People & Body", emojis: "👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🙏 ✍️ 💅 💪 🦾 🧠 👀 👁️ 👅 👄 👶 🧒 👦 👧 🧑 👱 👨 🧔 👩 🧓 👴 👵 🙋 🙇 🤦 🤷 🧑‍💻 🧑‍🎨 🧑‍🏫 🧑‍🚀 🕺 💃" },
  { name: "Animals & Nature", emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦉 🦇 🐺 🐴 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🐙 🦀 🐠 🐬 🐳 🦈 🐊 🐘 🦒 🌵 🌲 🌳 🌴 🌱 🌿 🍀 🍁 🍂 🌸 🌼 🌻 🌹 🌷 🌞 🌝 🌙 ⭐ 🌈 ☁️ ⛈️ ❄️ 🔥 💧 🌊" },
  { name: "Food & Drink", emojis: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥔 🥕 🌽 🌶️ 🥒 🥦 🧄 🧅 🍞 🥐 🧀 🥚 🍳 🥞 🥓 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍚 🍙 🍰 🎂 🧁 🍩 🍪 🍫 🍬 🍭 🍦 ☕ 🍵 🧃 🥤 🧋 🍺 🍷 🥂" },
  { name: "Activities", emojis: "⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🏒 🏏 🥅 ⛳ 🏹 🎣 🥊 🥋 🎽 🛹 ⛸️ 🎿 🏂 🏋️ 🤸 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🎗️ 🎫 🎟️ 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎲 ♟️ 🎯 🎳 🎮 🧩" },
  { name: "Travel & Places", emojis: "🚗 🚕 🚙 🚌 🏎️ 🚓 🚑 🚒 🚚 🚜 🛵 🏍️ 🚲 🛴 ✈️ 🛫 🛬 🚀 🛸 🚁 ⛵ 🚤 🛳️ 🚢 ⚓ 🚉 🚆 🚇 🗺️ 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🏕️ 🏠 🏡 🏢 🏬 🏥 🏦 🏨 🏪 🏫 🕌 🕍 ⛪ 🌃 🌆 🌇 🌉" },
  { name: "Objects", emojis: "⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💾 💿 📷 📸 📹 🎥 📽️ 🎞️ 📞 📺 📻 🎙️ ⏰ ⌛ 📡 🔋 🔌 💡 🔦 🕯️ 💸 💵 💰 💳 💎 🔧 🔨 🛠️ 🔩 ⚙️ 🧲 🔫 💣 🔪 🛡️ 🔮 📿 💈 🔬 🔭 💊 💉 🩹 🧬 🧹 🧺 🧻 🧼 🛒 🎁 🎈 🎀 📦 📮 📝 📁 📂 📅 📆 📇 📈 📉 📊 📋 📌 📍 📎 ✂️ 🔒 🔓 🔑 🗝️" },
  { name: "Symbols", emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ ♾️ ‼️ ⁉️ ❓ ❔ ❕ ❗ 〰️ ⚠️ 🚫 ⛔ 🔞 📵 ♻️ ⚜️ 🔱 📛 🔰 ⭕ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🔶 🔷 🔺 🔻 💠 🔘 🆗 🆕 🆓 🔝 🆙 ℹ️ 💤" },
  { name: "Flags", emojis: "🏁 🚩 🎌 🏴 🏳️ 🏳️‍🌈 🇧🇩 🇮🇳 🇺🇸 🇬🇧 🇨🇦 🇦🇺 🇩🇪 🇫🇷 🇮🇹 🇪🇸 🇯🇵 🇰🇷 🇨🇳 🇧🇷 🇸🇦 🇦🇪 🇹🇷 🇵🇰 🇳🇵 🇱🇰 🇲🇾 🇸🇬 🇮🇩 🇹🇭 🇻🇳 🇵🇭 🇳🇱 🇸🇪 🇳🇴 🇫🇮 🇩🇰 🇨🇭 🇷🇺 🇺🇦 🇲🇽 🇦🇷 🇿🇦 🇪🇬 🇳🇬 🇰🇪" },
];

export const EMOJI_NAMES: Record<string, string> = {
  "👍": "thumbs up like yes", "❤️": "heart love", "😂": "laugh joy lol", "🔥": "fire hot lit", "🎉": "party celebrate tada",
  "👀": "eyes look", "✅": "check done yes", "❌": "cross no wrong", "⭐": "star", "💯": "hundred perfect", "🙏": "pray thanks please",
  "👏": "clap applause", "😍": "love heart eyes", "🤔": "thinking hmm", "😮": "wow surprised", "😢": "sad cry", "🚀": "rocket launch ship",
  "💡": "idea bulb", "😀": "smile happy grin", "😎": "cool sunglasses", "🎬": "film movie clapper video", "📷": "camera photo",
  "🎨": "art palette design", "🎵": "music note", "📌": "pin", "⚠️": "warning", "💰": "money", "📅": "calendar date", "🏆": "trophy win",
  "😡": "angry mad", "😴": "sleep tired", "🤯": "mind blown", "🥳": "party", "👎": "thumbs down dislike no",
};

/** Named colours used to give swatches a friendly name (nearest match). */
const COLOR_NAMES_RAW =
  "000000 Black,ffffff White,808080 Gray,c0c0c0 Silver,ff0000 Red,800000 Maroon,ffff00 Yellow,808000 Olive,00ff00 Lime,008000 Green,00ffff Aqua,008080 Teal,0000ff Blue,000080 Navy,ff00ff Fuchsia,800080 Purple," +
  "f0f8ff Alice Blue,faebd7 Antique White,7fffd4 Aquamarine,f0ffff Azure,f5f5dc Beige,ffe4c4 Bisque,ffebcd Blanched Almond,8a2be2 Blue Violet,a52a2a Brown,deb887 Burlywood,5f9ea0 Cadet Blue,7fff00 Chartreuse,d2691e Chocolate,ff7f50 Coral,6495ed Cornflower,fff8dc Cornsilk,dc143c Crimson," +
  "00008b Dark Blue,008b8b Dark Cyan,b8860b Dark Goldenrod,a9a9a9 Dark Gray,006400 Dark Green,bdb76b Dark Khaki,8b008b Dark Magenta,556b2f Dark Olive,ff8c00 Dark Orange,9932cc Dark Orchid,8b0000 Dark Red,e9967a Dark Salmon,8fbc8f Dark Sea Green,483d8b Dark Slate Blue,2f4f4f Dark Slate,00ced1 Dark Turquoise,9400d3 Dark Violet," +
  "ff1493 Deep Pink,00bfff Deep Sky Blue,696969 Dim Gray,1e90ff Dodger Blue,b22222 Firebrick,fffaf0 Floral White,228b22 Forest Green,dcdcdc Gainsboro,f8f8ff Ghost White,ffd700 Gold,daa520 Goldenrod,adff2f Green Yellow,f0fff0 Honeydew,ff69b4 Hot Pink,cd5c5c Indian Red,4b0082 Indigo,fffff0 Ivory,f0e68c Khaki," +
  "e6e6fa Lavender,fff0f5 Lavender Blush,7cfc00 Lawn Green,fffacd Lemon Chiffon,add8e6 Light Blue,f08080 Light Coral,e0ffff Light Cyan,90ee90 Light Green,ffb6c1 Light Pink,ffa07a Light Salmon,20b2aa Light Sea Green,87cefa Light Sky Blue,778899 Light Slate,b0c4de Light Steel Blue,ffffe0 Light Yellow,32cd32 Lime Green,faf0e6 Linen," +
  "66cdaa Medium Aquamarine,0000cd Medium Blue,ba55d3 Medium Orchid,9370db Medium Purple,3cb371 Medium Sea Green,7b68ee Medium Slate Blue,00fa9a Medium Spring Green,48d1cc Medium Turquoise,c71585 Medium Violet,191970 Midnight Blue,f5fffa Mint Cream,ffe4e1 Misty Rose,ffe4b5 Moccasin,ffdead Navajo White,fdf5e6 Old Lace,6b8e23 Olive Drab," +
  "ffa500 Orange,ff4500 Orange Red,da70d6 Orchid,eee8aa Pale Goldenrod,98fb98 Pale Green,afeeee Pale Turquoise,db7093 Pale Violet Red,ffefd5 Papaya Whip,ffdab9 Peach Puff,cd853f Peru,ffc0cb Pink,dda0dd Plum,b0e0e6 Powder Blue,bc8f8f Rosy Brown,4169e1 Royal Blue,8b4513 Saddle Brown,fa8072 Salmon,f4a460 Sandy Brown,2e8b57 Sea Green," +
  "fff5ee Seashell,a0522d Sienna,87ceeb Sky Blue,6a5acd Slate Blue,708090 Slate Gray,fffafa Snow,00ff7f Spring Green,4682b4 Steel Blue,d2b48c Tan,d8bfd8 Thistle,ff6347 Tomato,40e0d0 Turquoise,ee82ee Violet,f5deb3 Wheat,9acd32 Yellow Green," +
  "8bd5f6 Malibu,f5a623 Sun,4f7cff Royal Azure,e25563 Mandy,2bb39a Jungle Green,8b5cf6 Medium Purple,ec4899 Brilliant Rose,0ea5e9 Cerulean,22c55e Emerald,64748b Slate,f97316 Ecstasy,eab308 Corn,14b8a6 Java,6366f1 Royal Blue,a855f7 Lavender Indigo," +
  "ef4444 Cinnabar,f43f5e Radical Red,84cc16 Atlantis,06b6d4 Robin's Egg,3b82f6 Dodger Blue,c86b4a Terracotta,7d8f69 Sage,e4c9a8 Sand,f6f1e9 Cream,1f2933 Ink,ffd1dc Pastel Pink,b5ead7 Magic Mint,c7ceea Periwinkle,ffdac1 Peach,e2f0cb Tea Green," +
  "2c3e50 Midnight,34495e Wet Asphalt,16a085 Green Sea,27ae60 Nephritis,2980b9 Belize Hole,8e44ad Wisteria,f39c12 Orange Peel,d35400 Pumpkin,c0392b Pomegranate,bdc3c7 Concrete,7f8c8d Asbestos,ecf0f1 Clouds,1abc9c Turquoise,2ecc71 Emerald,3498db Peter River,9b59b6 Amethyst,f1c40f Sunflower,e67e22 Carrot,e74c3c Alizarin";

const COLOR_NAMES: [number, number, number, string][] = COLOR_NAMES_RAW.split(",").map((s) => {
  const hex = s.slice(0, 6);
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), s.slice(7)];
});

export function colorName(hex: string) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || "");
  if (!m) return "";
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16));
  let best = "";
  let bd = Infinity;
  for (const [cr, cg, cb, name] of COLOR_NAMES) {
    // weighted distance (closer to perceived difference than plain RGB)
    const d = 2 * (r - cr) ** 2 + 4 * (g - cg) ** 2 + 3 * (b - cb) ** 2;
    if (d < bd) {
      bd = d;
      best = name;
    }
  }
  return best;
}

export const LABEL_COLORS = ["#2bb3c0", "#4f7cff", "#8b5cf6", "#ec4899", "#e25563", "#f5a623", "#22c55e", "#64748b"];

/** Full colour palette shown in colour pickers (Milanote-style grid). */
export const PICKER_COLORS = [
  "#ffffff", "#e8e8e8", "#9be7c4", "#8be08b", "#f2a48b",
  "#ffd166", "#f7a54a", "#f25c5c", "#f06fd5", "#b57bff",
  "#7cc8ff", "#5b8cff", "#2f3437",
  "#c97b5a", "#c99a7a", "#d6bfa4", "#e9dccb", "#d9cdb7", "#b7c4a5", "#a6b48e",
];

export const isHex = (c?: string) => !!c && /^#[\da-f]{3,8}$/i.test(c);

export function readableOn(hex: string) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(hex);
  if (!m) return "#1f2328";
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1f2328" : "#ffffff";
}
