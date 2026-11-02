// metro.config.js — default Expo config, plus the offline Bible file type.
// `.bible` files (assets/bible/kjv.bible) are shipped as assets rather than
// bundled as JavaScript, so the 4 MB text is read from disk only when the
// Bible is opened instead of being parsed at every app start.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('bible');

module.exports = config;
