// App.js
// ─────────────────────────────────────────────────────────────────────────────
// Gospelar Sunday School — Navigation Root
// All screens registered. Auth screens are public; content screens are guarded.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import { NavigationContainer }        from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider }           from 'react-native-safe-area-context';
import { ActivityIndicator, View, Alert } from 'react-native';
import * as Notifications             from 'expo-notifications';
import NotificationService            from './services/NotificationService';
import { useContentSync }             from './services/contentSync';

// ── Contexts ──────────────────────────────────────────────────────────────────
import { ThemeProvider }        from './context/ThemeContext';
import { LanguageProvider }     from './context/LanguageContext';
import { SubscriptionProvider } from './context/SubscriptionContext';

// ── Auth screens (public) ─────────────────────────────────────────────────────
import LoginScreen    from './screen/LoginScreen';
import RegisterScreen from './screen/RegisterScreen';
import PaymentScreen  from './screen/PaymentScreen';

// ── Main content screens (protected) ─────────────────────────────────────────
import LibraryScreen           from './screen/LibraryScreen';
import BookReaderScreen        from './screen/BookReaderScreen';
import BookPaywallScreen       from './screen/BookPaywallScreen';
import HomeScreen              from './screen/Homescreen';
import CombinedUnitsPage       from './screen/CombinedUnitsPage';
import LessonPage              from './screen/LessonPage';
import DevotionalReadingScreen from './screen/DevotionalReadingScreen';
import SundaySchoolVoiceReading from './screen/SundaySchoolVoiceReading';
import NotesScreen             from './screen/NotesScreen';

// ── Victory Month Prayer book ────────────────────────────────────────────────
import VictoryMonthHome            from './screen/victory/VictoryMonthHome';
import VictoryDayList              from './screen/victory/VictoryDayList';
import VictoryDayScreen            from './screen/victory/VictoryDayScreen';
import VictoryProgress             from './screen/victory/VictoryProgress';
import VictoryAbout                from './screen/victory/VictoryAbout';
import VictoryVigilList            from './screen/victory/VictoryVigilList';
import VictoryVigilScreen          from './screen/victory/VictoryVigilScreen';
import VictoryEditDay              from './screen/victory/VictoryEditDay';
import VictoryReadingMode          from './screen/victory/VictoryReadingMode';
import VictoryAudioPlayer          from './screen/victory/VictoryAudioPlayer';
import VictoryAudioRoomList        from './screen/victory/VictoryAudioRoomList';
import VictoryAudioRoom            from './screen/victory/VictoryAudioRoom';
import VictoryCreateRoom           from './screen/victory/VictoryCreateRoom';
import VictoryFastingHub           from './screen/victory/VictoryFastingHub';
import VictoryFastingScheduler     from './screen/victory/VictoryFastingScheduler';
import VictoryReminders            from './screen/victory/VictoryReminders';
import VictoryCategories           from './screen/victory/VictoryCategories';
import VictoryCategoryScreen       from './screen/victory/VictoryCategoryScreen';
import VictoryAchievementsScreen   from './screen/victory/VictoryAchievementsScreen';
import BookGuard                   from './components/BookGuard';

// ── Settings & profile screens ────────────────────────────────────────────────
import SettingsScreen       from './screen/SettingsScreen';
import ProfileScreen        from './screen/ProfileScreen';
import ProgressScreen       from './screen/ProgressScreen';
import StatsScreen          from './screen/StatsScreen';
import ChangePasswordScreen from './screen/ChangePasswordScreen';
import DeleteAccountScreen  from './screen/DeleteAccountScreen';
import AboutScreen          from './screen/AboutScreen';

// ── Subscription guard ────────────────────────────────────────────────────────
import SubscriptionGuard from './components/SubscriptionGuard';
import AdBanner          from './components/AdBanner';

// ── Teacher screens ───────────────────────────────────────────────────────────
import TeacherDashboard   from './screen/teacher/TeacherDashboard';
import TeacherMarkSheet   from './screen/teacher/TeacherMarkSheet';
import TeacherClassDetail from './screen/teacher/TeacherClassDetail';
import SplashScreen from './screen/SplashScreen';

const Stack = createNativeStackNavigator();

// 1. Module-level ref so both AppNavigator and App can access it
const navigationRef = React.createRef();

/**
 * Global force-logout hook.
 * This is called by SubscriptionContext when the backend reports that 
 * the current session token is no longer valid (e.g., login on another device).
 */
// App.js
global.__gofamintForceLogout = () => {
  // Use a small timeout to ensure the navigation state is settled
  setTimeout(() => {
    if (navigationRef.current?.isReady()) {
      navigationRef.current.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
      Alert.alert("Session Expired", "Logged in on another device.");
    } else {
      console.warn("Navigation not ready for logout");
    }
  }, 500); 
};

const Guarded = ({ Component, navigation, route }) => (
  <SubscriptionGuard navigation={navigation}>
    <Component navigation={navigation} route={route} />
  </SubscriptionGuard>
);

// ─────────────────────────────────────────────────────────────────────────────
// Root navigator — determines initial route from saved session
// ─────────────────────────────────────────────────────────────────────────────
function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);

  // Background content sync — fires on mount and on every offline → online
  // transition. Throttled to once per 30 minutes so brief network flaps don't
  // re-download everything. Manual button on the profile screen still bypasses
  // the throttle via runNow({ force: true }).
  useContentSync();

  useEffect(() => {
    // Always show SplashScreen first — it checks local session and routes accordingly
    setInitialRoute('SplashScreen');

    // Initialise notifications
    NotificationService.init();

    // Handle notification taps. We branch on the `type` payload set by each
    // notification scheduler so taps deep-link straight to the relevant
    // screen instead of just opening the app cold.
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const type = response.notification.request.content.data?.type;
      if (!navigationRef.current) return;

      if (type === 'quiz' || type === 'devotional') {
        navigationRef.current.navigate('HomeScreen');
      } else if (type === 'fastEnded' || type === 'fastStarted' || type === 'fastMidpoint') {
        // Victory Month fast alarm — route to the Fasting Hub so the user
        // can mark complete / see remaining time / start the next fast.
        navigationRef.current.navigate('VictoryFastingHub');
      } else if (type === 'prayerReminder') {
        // Recurring prayer reminder — open the Reminders screen so the user
        // can adjust the time or jump straight into today's prayer.
        navigationRef.current.navigate('VictoryReminders');
      }
    });

    return () => sub.remove();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      {/* Splash */}
      <Stack.Screen name="SplashScreen"  component={SplashScreen} />

      {/* Auth — public, no guard */}
      <Stack.Screen name="Login"         component={LoginScreen} />
      <Stack.Screen name="Register"      component={RegisterScreen} />
      <Stack.Screen name="PaymentScreen" component={PaymentScreen} />

      {/* Library launcher — post-auth landing page, lists every book.
          NOT subscription-guarded itself; the gate fires when entering a
          specific book's homepage (Sunday School → HomeScreen below). */}
      <Stack.Screen name="Library" component={LibraryScreen} />

      {/* Generic reader for any "daily-entry" book in the library
          (Victory Month Prayer Bulletin, Teacher Manual, future books).
          Sunday School is NOT routed here — it has its own bespoke
          HomeScreen flow. Public route — gating, when added, happens at
          the library tile level, not inside the reader. */}
      <Stack.Screen name="BookReader" component={BookReaderScreen} />

      {/* Core content — subscription guarded */}
      <Stack.Screen
        name="HomeScreen"
        children={(props) => <Guarded Component={HomeScreen} {...props} />}
      />
      <Stack.Screen
        name="SecondPage"
        children={(props) => <Guarded Component={CombinedUnitsPage} {...props} />}
      />
      <Stack.Screen
        name="LessonPage"
        children={(props) => <Guarded Component={LessonPage} {...props} />}
      />
      <Stack.Screen
        name="DevotionalReading"
        children={(props) => <Guarded Component={DevotionalReadingScreen} {...props} />}
      />
      {/* Dedicated voice-reading screen for the SS daily devotional —
          launched from the Listen (♪) button on DevotionalReadingScreen.
          Same SubscriptionGuard as the reader so users without an active
          SS subscription can't deep-link in. */}
      <Stack.Screen
        name="SundaySchoolVoiceReading"
        children={(props) => <Guarded Component={SundaySchoolVoiceReading} {...props} />}
      />
      <Stack.Screen name="Notes" component={NotesScreen} />

      {/* Per-book paywall — public so the user can see it before subscribing. */}
      <Stack.Screen name="BookPaywall" component={BookPaywallScreen} />

      {/* Victory Month Prayer book — every screen gated by BookGuard so the
          user can't deep-link in without owning the SKU. */}
      <Stack.Screen
        name="VictoryMonthHome"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryMonthHome {...props} />
          </BookGuard>
        )}
      />
      <Stack.Screen
        name="VictoryDayList"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryDayList {...props} />
          </BookGuard>
        )}
      />
      <Stack.Screen
        name="VictoryDayScreen"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryDayScreen {...props} />
          </BookGuard>
        )}
      />
      <Stack.Screen
        name="VictoryProgress"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryProgress {...props} />
          </BookGuard>
        )}
      />
      <Stack.Screen
        name="VictoryAbout"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryAbout {...props} />
          </BookGuard>
        )}
      />
      <Stack.Screen
        name="VictoryVigilList"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryVigilList {...props} />
          </BookGuard>
        )}
      />
      <Stack.Screen
        name="VictoryVigilScreen"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryVigilScreen {...props} />
          </BookGuard>
        )}
      />

      {/* Enhanced Prayer Module screens — journaling, audio, fasting,
          reminders, categories, achievements. All BookGuard-protected. */}
      <Stack.Screen
        name="VictoryEditDay"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryEditDay {...props} />
          </BookGuard>
        )}
      />
      <Stack.Screen
        name="VictoryReadingMode"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryReadingMode {...props} />
          </BookGuard>
        )}
      />
      <Stack.Screen
        name="VictoryAudioPlayer"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryAudioPlayer {...props} />
          </BookGuard>
        )}
      />
      {/* Audio rooms — surfaced from LibraryScreen so any signed-in user
          can join community prayer without owning a specific book. */}
      <Stack.Screen name="VictoryAudioRoomList" component={VictoryAudioRoomList} />
      <Stack.Screen name="VictoryAudioRoom"     component={VictoryAudioRoom} />
      <Stack.Screen name="VictoryCreateRoom"    component={VictoryCreateRoom} />
      <Stack.Screen
        name="VictoryFastingHub"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryFastingHub {...props} />
          </BookGuard>
        )}
      />
      <Stack.Screen
        name="VictoryFastingScheduler"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryFastingScheduler {...props} />
          </BookGuard>
        )}
      />
      <Stack.Screen
        name="VictoryReminders"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryReminders {...props} />
          </BookGuard>
        )}
      />
      <Stack.Screen
        name="VictoryCategories"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryCategories {...props} />
          </BookGuard>
        )}
      />
      <Stack.Screen
        name="VictoryCategoryScreen"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryCategoryScreen {...props} />
          </BookGuard>
        )}
      />
      <Stack.Screen
        name="VictoryAchievementsScreen"
        children={(props) => (
          <BookGuard bookId="victory_month_prayer" {...props}>
            <VictoryAchievementsScreen {...props} />
          </BookGuard>
        )}
      />

      {/* Settings hub — intentionally not SubscriptionGuard-wrapped: language,
          theme, sign-out, and account management must remain reachable for any
          logged-in user, including those inside a non-Sunday-School book who
          haven't bought the SS subscription. The screen itself reads `book`
          from route params so its in-screen links route back to the right
          book context. */}
      <Stack.Screen name="Settings" component={SettingsScreen} />

      {/* Profile & progress — guarded */}
      <Stack.Screen
        name="Profile"
        children={(props) => <Guarded Component={ProfileScreen} {...props} />}
      />
      <Stack.Screen
        name="Progress"
        children={(props) => <Guarded Component={ProgressScreen} {...props} />}
      />
      <Stack.Screen
        name="Stats"
        children={(props) => <Guarded Component={StatsScreen} {...props} />}
      />

      {/* Account management — accessible after login, no sub guard needed */}
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="DeleteAccount"  component={DeleteAccountScreen} />
      <Stack.Screen name="About"          component={AboutScreen} />

      {/* Teacher screens */}
      <Stack.Screen name="TeacherDashboard"   component={TeacherDashboard} />
      <Stack.Screen name="TeacherMarkSheet"   component={TeacherMarkSheet} />
      <Stack.Screen name="TeacherClassDetail" component={TeacherClassDetail} />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <SubscriptionProvider>
            {/* The ref here is crucial for the global logout to work */}
            <NavigationContainer ref={navigationRef}>
              <AppNavigator />
              <AdBanner />
            </NavigationContainer>
          </SubscriptionProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}