// components/Accordion.jsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { RichVerseText } from '../components/BibleVerseLink';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const C = {
  navy:     '#18326F',
  gold:     '#C9A84C',
  cream:    '#FDF8EE',
  white:    '#FFFFFF',
  textDark: '#0E1F47',
  textMid:  '#2D3E6B',
  textMuted:'#6B7A99',
  divider:  '#D6DEEE',
};

export default function Accordion({ day, title, scripture, content }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[styles.header, expanded && styles.headerExpanded]}
        onPress={toggle}
        activeOpacity={0.8}
      >
        {/* Left: day + title */}
        <View style={{ flex: 1 }}>
          {day ? (
            <Text style={styles.dayText}>{day}</Text>
          ) : null}
          <Text style={styles.titleText} numberOfLines={expanded ? undefined : 1}>
            {title}
          </Text>
          {scripture ? (
            <Text style={styles.scriptureText}>{scripture}</Text>
          ) : null}
        </View>

        {/* Chevron */}
        <View style={[styles.chevron, expanded && styles.chevronOpen]}>
          <Text style={styles.chevronText}>{expanded ? '−' : '+'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          <RichVerseText
            text={content || 'In this devotional reading, meditate on how the scripture for today connects to the lesson theme. Consider how you can apply this passage in your daily walk this week. Journal your reflections and bring a thought to share with your study group.'}
            lineHeight={styles.bodyText.lineHeight}
            style={styles.bodyText}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.divider,
    backgroundColor: C.white,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: C.white,
  },
  headerExpanded: {
    backgroundColor: C.cream,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  dayText: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  titleText: {
    color: C.textDark,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  scriptureText: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  chevron: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: `${C.navy}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronOpen: {
    backgroundColor: C.navy,
  },
  chevronText: {
    color: C.navy,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  body: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: C.white,
  },
  bodyText: {
    color: C.textMid,
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '500',
  },
});