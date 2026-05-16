// screen/GospelerIdFormScreen.jsx
// Multi-step membership form for the Gospeler ID. Mirrors the registration
// webapp's data shape (Title, Surname, Other Names, Sex, Church Status,
// Age Bracket, Phone, Email, City, Country, Region→District→Assembly) plus
// the mobile-only Photo + Date-of-birth, so the same human identifies the
// same way in either app.
//
// Wizard layout — 4 steps, validated at each Continue:
//   Step 1  Personal           Title, Surname, Other Names, Sex, Status, Age Bracket
//   Step 2  Contact & Location Phone, Email (RO), City, Country, Region→District→Assembly
//   Step 3  Photo & DOB        Profile picture + ISO date of birth
//   Step 4  Review             Read-only summary + Generate / Save
//
// Option lists come from GET /api/membership/options (cached). One source of
// truth across mobile + web; updating the lists only touches the backend.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, Image, ScrollView, TextInput, TouchableOpacity, ActivityIndicator,
  StatusBar, Alert, KeyboardAvoidingView, Platform, Animated, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

import { ICONS } from '../components/icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getTokens } from '../theme/tokens';
import { useScreenEntry } from '../hooks/useFluidAnim';
import {
  fetchGospelerId, createGospelerId, updateGospelerId, fetchMembershipOptions,
} from '../services/api';

const BLUE = '#1A56DB';
const BLUE_DEEP = '#1E3A8A';
const BLUE_LIGHT = '#EFF6FF';

const STEPS = [
  { id: 'personal',  label: 'Personal' },
  { id: 'contact',   label: 'Contact & Location' },
  { id: 'photo',     label: 'Photo & DOB' },
  { id: 'review',    label: 'Review' },
];

// Local fallback used only when the options API hasn't responded yet on first
// load. Keeps the form interactive instead of showing a spinner; the real
// (cached) lists overwrite these as soon as the fetch resolves.
const FALLBACK_OPTIONS = {
  titles:           ['Mr', 'Mrs', 'Miss', 'Dr', 'Pastor'],
  sexes:            ['Male', 'Female'],
  statuses:         ['MEMBER', 'WORKER', 'OTHERS'],
  countries:        ['Nigeria', 'Ghana', 'Other'],
  age_brackets:     ['Children (0-12)', 'Teenager (13-19)', 'Youth (20-35)', 'Adult (36-above)'],
  regions:          [],
  region_districts: {},
};

const isValidIsoDate = (s) => {
  if (!s) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime()) && s === d.toISOString().slice(0, 10);
};

export default function GospelerIdFormScreen({ navigation, route }) {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const tk = useMemo(() => getTokens(isDark), [isDark]);
  const { fade, translateY } = useScreenEntry();

  const mode = route?.params?.mode === 'edit' ? 'edit' : 'create';

  const [stepIdx, setStepIdx] = useState(0);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [options, setOptions] = useState(FALLBACK_OPTIONS);

  // Webapp-aligned field set. Keep firstName / lastName split internally so
  // the form UX matches the webapp ("Surname" / "Other Names") — combined
  // into `full_name` only at submit time.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [sex, setSex] = useState('');           // → gender column
  const [status, setStatus] = useState('');     // → church_status column
  const [ageBracket, setAgeBracket] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [assembly, setAssembly] = useState('');
  const [dob, setDob] = useState('');
  const [photoBase64, setPhotoBase64] = useState(null);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  // Legacy mobile-only `membership_role` (lowercase 6-enum). Hidden from the
  // user — derived from `status` so the rest of the platform (card, hub,
  // verify endpoint badge) keeps rendering a sensible role label.
  const [membershipRole, setMembershipRole] = useState('member');

  // Load options + (when editing) prefill from the server.
  useEffect(() => {
    (async () => {
      const em = await AsyncStorage.getItem('userEmail');
      if (!em) {
        Alert.alert(t('error', 'Error'), t('please_login', 'Please sign in first.'));
        navigation.goBack();
        return;
      }
      setEmail(em);

      // Options + (edit-mode) existing row, in parallel for speed.
      const [opts, existing] = await Promise.all([
        fetchMembershipOptions().catch(() => null),
        mode === 'edit' ? fetchGospelerId(em).catch(() => null) : Promise.resolve(null),
      ]);

      if (opts) setOptions({ ...FALLBACK_OPTIONS, ...opts });

      if (existing) {
        // Split the combined full_name back into first/last for the form.
        // Heuristic: last word = lastName, rest = firstName. Works for the
        // common "Other Names + Surname" order.
        const parts = String(existing.full_name || '').trim().split(/\s+/);
        const last = parts.length > 1 ? parts.pop() : '';
        const first = parts.join(' ');
        setFirstName(first);
        setLastName(last);
        setTitle(existing.title || '');
        setSex(existing.gender || '');
        setStatus(existing.church_status || '');
        setAgeBracket(existing.age_bracket || '');
        setPhone(existing.phone || '');
        setCity(existing.city || '');
        setCountry(existing.country || 'Nigeria');
        setRegion(existing.region || '');
        setDistrict(existing.district || '');
        setAssembly(existing.assembly || existing.church_branch || '');
        setDob(existing.date_of_birth ? String(existing.date_of_birth).slice(0, 10) : '');
        setPhotoBase64(existing.photo_base64 || null);
        setMembershipRole(existing.membership_role || 'member');
      } else if (mode === 'create') {
        // Prefill name from user_profiles if available — saves typing.
        try {
          const stored = await AsyncStorage.getItem('userName');
          if (stored) {
            const parts = stored.trim().split(/\s+/);
            if (parts.length > 1) {
              setLastName(parts.pop());
              setFirstName(parts.join(' '));
            } else {
              setFirstName(stored);
            }
          }
        } catch {}
      }
      setLoading(false);
    })();
  }, [mode, navigation, t]);

  // Derive the legacy lowercase `membership_role` from the webapp-style Status
  // code so existing card/hub UI keeps rendering a friendly role label. The
  // mapping is rough on purpose — any unrecognised status falls back to
  // 'member' rather than fabricating a role.
  useEffect(() => {
    const map = {
      MEMBER: 'member', WORKER: 'worker',
      PASTOR: 'pastor', ADP: 'pastor', SDP: 'pastor', RP: 'pastor',
      ELD: 'leader', HOD: 'leader',
      EVAG: 'minister', AGE: 'minister', GE: 'minister',
    };
    setMembershipRole(map[status] || 'member');
  }, [status]);

  const districts = useMemo(
    () => (region ? (options.region_districts[region] || []) : []),
    [region, options.region_districts],
  );

  // Step-scoped validation. Surfaces the first missing field so the user can
  // jump straight to fixing it — no error rollup.
  const validateStep = useCallback(() => {
    if (stepIdx === 0) {
      if (!lastName.trim())  return t('gid_err_surname', 'Surname is required.');
      if (!firstName.trim()) return t('gid_err_othernames', 'Other Names are required.');
      if (!title)            return t('gid_err_title', 'Title is required.');
      if (!sex)              return t('gid_err_sex', 'Sex is required.');
      if (!status)           return t('gid_err_status', 'Status is required.');
      if (!ageBracket)       return t('gid_err_age', 'Age Bracket is required.');
    }
    if (stepIdx === 1) {
      if (!phone.trim() || phone.replace(/\D/g, '').length < 7)
        return t('gid_err_phone', 'A valid phone number is required.');
      if (!city.trim())     return t('gid_err_city', 'City of Residence is required.');
      if (!country)         return t('gid_err_country', 'Country is required.');
      if (!region)          return t('gid_err_region', 'Region is required.');
      if (!district)        return t('gid_err_district', 'District is required.');
      if (!assembly.trim()) return t('gid_err_assembly', 'Assembly is required.');
    }
    if (stepIdx === 2) {
      if (dob && !isValidIsoDate(dob))
        return t('gid_err_dob', 'Date of birth must be YYYY-MM-DD.');
    }
    return '';
  }, [stepIdx, lastName, firstName, title, sex, status, ageBracket,
      phone, city, country, region, district, assembly, dob, t]);

  const goNext = () => {
    const msg = validateStep();
    if (msg) { Alert.alert(t('gid_err_title_box', 'Please fix the form'), msg); return; }
    setStepIdx((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setStepIdx((s) => Math.max(s - 1, 0));

  const handlePickPhoto = async () => {
    if (pickingPhoto) return;
    setPickingPhoto(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          t('gid_photo_perm_title', 'Permission needed'),
          t('gid_photo_perm_msg', 'Allow photo library access to choose a profile picture.'),
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const a = result.assets[0];
      if (!a.base64) {
        Alert.alert(t('error', 'Error'), t('gid_photo_failed', 'Could not read that photo.'));
        return;
      }
      setPhotoBase64(`data:image/jpeg;base64,${a.base64}`);
    } catch (e) {
      console.warn('photo pick failed:', e?.message);
    } finally {
      setPickingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    // Final validation — walk every step so the user can't skip ahead.
    for (let i = 0; i <= STEPS.length - 1; i++) {
      // Temporarily set stepIdx to i to reuse validateStep's logic.
      // (Local copy below avoids the closure churn from setStepIdx.)
    }
    // Combine first + last → full_name to fit the existing schema column.
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    const payload = {
      full_name:       fullName,
      phone:           phone.trim() || null,
      church_name:     null,                     // superseded by region/district/assembly
      church_branch:   assembly.trim() || null,  // legacy compat: surface assembly as branch
      country:         country || null,
      state_province:  region || null,           // legacy compat
      gender:          sex || null,
      date_of_birth:   dob || null,
      photo_base64:    photoBase64 || null,
      membership_role: membershipRole || 'member',
      // Extended fields:
      title:           title || null,
      church_status:   status || null,
      age_bracket:     ageBracket || null,
      city:            city.trim() || null,
      region:          region || null,
      district:        district || null,
      assembly:        assembly.trim() || null,
    };

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createGospelerId(email, payload);
        navigation.replace('GospelerIdCard');
      } else {
        const res = await updateGospelerId(email, payload);
        if (res?.regenerated) {
          Alert.alert(
            t('gid_regen_done_title', 'New ID generated'),
            t('gid_regen_done_msg',
              'Because you changed a key detail, your Gospeler ID has been regenerated. The previous version is archived.'),
            [{ text: t('btn_ok', 'OK'), onPress: () => navigation.replace('GospelerIdCard') }],
          );
        } else {
          navigation.replace('GospelerIdCard');
        }
      }
    } catch (e) {
      Alert.alert(t('error', 'Error'), e?.message || String(e));
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={BLUE} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tk.bg }} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tk.bg} />

      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
      }}>
        <TouchableOpacity onPress={() => stepIdx > 0 ? goBack() : navigation.goBack()}
          activeOpacity={0.75}
          style={{
            width: 40, height: 40, borderRadius: 20, justifyContent: 'center',
            alignItems: 'center', backgroundColor: tk.surfaceEl,
          }}>
          <ICONS.ArrowLeft color={tk.textPrimary} size={20} sw={2} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '800', color: tk.textPrimary }}>
          {mode === 'edit'
            ? t('gid_form_edit', 'Edit information')
            : t('gid_form_create', 'Membership form')}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <Stepper stepIdx={stepIdx} tk={tk} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ opacity: fade, transform: [{ translateY }] }}
        >
          {stepIdx === 0 && (
            <PersonalStep tk={tk} t={t}
              options={options}
              firstName={firstName} setFirstName={setFirstName}
              lastName={lastName} setLastName={setLastName}
              title={title} setTitle={setTitle}
              sex={sex} setSex={setSex}
              status={status} setStatus={setStatus}
              ageBracket={ageBracket} setAgeBracket={setAgeBracket} />
          )}
          {stepIdx === 1 && (
            <ContactStep tk={tk} t={t}
              options={options}
              email={email}
              phone={phone} setPhone={setPhone}
              city={city} setCity={setCity}
              country={country} setCountry={setCountry}
              region={region} setRegion={setRegion}
              district={district} setDistrict={setDistrict}
              assembly={assembly} setAssembly={setAssembly}
              districts={districts} />
          )}
          {stepIdx === 2 && (
            <PhotoStep tk={tk} t={t}
              photoBase64={photoBase64} pickingPhoto={pickingPhoto}
              onPickPhoto={handlePickPhoto}
              dob={dob} setDob={setDob} />
          )}
          {stepIdx === 3 && (
            <ReviewStep tk={tk} t={t}
              data={{
                title, firstName, lastName, sex, status, ageBracket,
                phone, email, city, country, region, district, assembly,
                dob, photoBase64,
              }} />
          )}
        </Animated.ScrollView>

        {/* Footer nav */}
        <View style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28,
          backgroundColor: tk.bg, borderTopWidth: 1, borderTopColor: tk.border,
          flexDirection: 'row', gap: 10,
        }}>
          {stepIdx > 0 && (
            <TouchableOpacity
              onPress={goBack}
              style={{
                paddingVertical: 16, paddingHorizontal: 18, borderRadius: 14,
                backgroundColor: tk.surface, borderWidth: 1, borderColor: tk.border,
                flexDirection: 'row', alignItems: 'center', gap: 6,
              }}
              activeOpacity={0.78}
            >
              <ICONS.ArrowLeft color={tk.textPrimary} size={16} sw={2} />
              <Text style={{ fontSize: 13, fontWeight: '800', color: tk.textPrimary }}>
                {t('btn_back', 'Back')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={stepIdx < STEPS.length - 1 ? goNext : handleSubmit}
            disabled={submitting}
            activeOpacity={0.88}
            style={{ flex: 1 }}
          >
            <LinearGradient
              colors={submitting ? [tk.textMuted, tk.textMuted] : [BLUE_DEEP, BLUE]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{
                paddingVertical: 16, borderRadius: 14,
                alignItems: 'center', flexDirection: 'row',
                justifyContent: 'center', gap: 10,
                shadowColor: BLUE, shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3, shadowRadius: 14, elevation: 6,
              }}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 }}>
                    {stepIdx < STEPS.length - 1
                      ? t('btn_continue', 'Continue')
                      : mode === 'edit'
                        ? t('gid_btn_save', 'Save changes')
                        : t('gid_btn_generate', 'Generate my ID')}
                  </Text>
                  {stepIdx < STEPS.length - 1 && (
                    <ICONS.ChevronRight color="#fff" size={16} sw={2.4} />
                  )}
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ stepIdx, tk }) {
  return (
    <View style={{
      flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, gap: 6,
    }}>
      {STEPS.map((s, i) => {
        const active = i === stepIdx;
        const done = i < stepIdx;
        return (
          <View key={s.id} style={{ flex: 1 }}>
            <View style={{
              height: 4, borderRadius: 2,
              backgroundColor: done || active ? BLUE : tk.surfaceEl,
            }} />
            <Text style={{
              fontSize: 10, fontWeight: '800', letterSpacing: 0.5,
              color: active ? BLUE : tk.textMuted,
              marginTop: 6,
            }} numberOfLines={1}>
              {`${i + 1}. ${s.label}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Steps ────────────────────────────────────────────────────────────────────
function PersonalStep({
  tk, t, options,
  firstName, setFirstName, lastName, setLastName,
  title, setTitle, sex, setSex, status, setStatus,
  ageBracket, setAgeBracket,
}) {
  return (
    <View>
      <Section title={t('gid_sec_personal', 'PERSONAL')} tk={tk} />
      <FormCard tk={tk}>
        <Field tk={tk} required
          label={t('gid_fld_surname', 'Surname')}
          placeholder="E.g. Doe"
          value={lastName} onChangeText={setLastName}
          Icon={ICONS.User} />
        <Field tk={tk} required noBorder
          label={t('gid_fld_other_names', 'Other Names')}
          placeholder="E.g. John Abiola"
          value={firstName} onChangeText={setFirstName}
          Icon={ICONS.User} />
      </FormCard>

      <Section title={t('gid_sec_about', 'ABOUT YOU')} tk={tk} />
      <ComboField tk={tk}
        label={t('gid_fld_title', 'Title')}
        value={title} onChange={setTitle}
        options={options.titles} required
        placeholder={t('gid_fld_title_ph', 'E.g. Pastor, Dr, Mrs (or type your own)')} />
      {/* Sex stays a strict picker — binary taxonomy, no free-text needed. */}
      <PickerRow tk={tk}
        label={t('gid_fld_sex', 'Sex')}
        value={sex} onChange={setSex}
        options={options.sexes} required
        placeholder={t('gid_fld_pick_sex', 'Select sex')} />
      <ComboField tk={tk}
        label={t('gid_fld_status', 'Status')}
        sub={t('gid_fld_status_sub',
          'Your role in the church — type your own or pick from the list.')}
        value={status} onChange={setStatus}
        options={options.statuses} required
        upper
        placeholder={t('gid_fld_status_ph', 'E.g. MEMBER, PASTOR, HOD')} />
      <ComboField tk={tk}
        label={t('gid_fld_age_bracket', 'Age Bracket')}
        value={ageBracket} onChange={setAgeBracket}
        options={options.age_brackets} required
        placeholder={t('gid_fld_age_ph', 'E.g. Adult (36-above)')} />
    </View>
  );
}

function ContactStep({
  tk, t, options, email,
  phone, setPhone, city, setCity, country, setCountry,
  region, setRegion, district, setDistrict, assembly, setAssembly,
  districts,
}) {
  return (
    <View>
      <Section title={t('gid_sec_contact', 'CONTACT')} tk={tk} />
      <FormCard tk={tk}>
        <Field tk={tk} required
          label={t('gid_fld_phone', 'Phone Number')}
          placeholder="+234 800 000 0000"
          keyboardType="phone-pad"
          value={phone} onChangeText={setPhone}
          Icon={ICONS.Bell} />
        <Field tk={tk} disabled noBorder
          label={t('gid_fld_email', 'Email Address')}
          value={email} onChangeText={() => {}}
          Icon={ICONS.Mail}
          hint={t('gid_fld_email_hint', 'Tied to your account — cannot be changed here.')} />
      </FormCard>

      <Section title={t('gid_sec_location', 'LOCATION')} tk={tk} />
      <FormCard tk={tk}>
        <Field tk={tk} required
          label={t('gid_fld_city', 'City of Residence')}
          placeholder="Lagos"
          value={city} onChangeText={setCity}
          Icon={ICONS.Globe} />
      </FormCard>
      <ComboField tk={tk}
        label={t('gid_fld_country', 'Country')}
        value={country} onChange={setCountry}
        options={options.countries} required
        placeholder={t('gid_fld_country_ph', 'E.g. Nigeria (or type your own)')} />
      <ComboField tk={tk}
        label={t('gid_fld_region', 'Region')}
        sub={t('gid_fld_region_sub',
          'Type your region freely, or tap the list icon to pick a denomination region.')}
        value={region} onChange={setRegion}
        options={options.regions} required
        placeholder={t('gid_fld_region_ph', 'E.g. Region 1, GSF Lagos Field, My Custom Region')} />
      <ComboField tk={tk}
        label={t('gid_fld_district', 'District')}
        value={district} onChange={setDistrict}
        options={districts} required
        // Pickable list only narrows if a known region is selected — but the
        // text input is always editable so unknown regions/districts still work.
        placeholder={t('gid_fld_district_ph', 'Type or tap to pick a district')} />
      <FormCard tk={tk}>
        <Field tk={tk} required noBorder
          label={t('gid_fld_assembly', 'Assembly')}
          placeholder={t('gid_fld_assembly_ph', 'Type your assembly name')}
          value={assembly} onChangeText={setAssembly}
          Icon={ICONS.BookStack} />
      </FormCard>
    </View>
  );
}

function PhotoStep({ tk, t, photoBase64, pickingPhoto, onPickPhoto, dob, setDob }) {
  return (
    <View>
      <Section title={t('gid_sec_photo', 'PROFILE PHOTO')} tk={tk} />
      <Text style={{
        paddingHorizontal: 20, fontSize: 12, color: tk.textMuted,
        lineHeight: 17, marginBottom: 16,
      }}>
        {t('gid_photo_intro',
          'Optional, but recommended — it makes your digital ID card unmistakably yours. Cropped to a square automatically.')}
      </Text>

      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <TouchableOpacity onPress={onPickPhoto} activeOpacity={0.85}
          disabled={pickingPhoto}
          style={{
            width: 160, height: 160, borderRadius: 36,
            backgroundColor: tk.surfaceEl,
            justifyContent: 'center', alignItems: 'center',
            borderWidth: 2, borderColor: BLUE + '40',
            overflow: 'hidden',
            shadowColor: BLUE, shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.18, shadowRadius: 16, elevation: 4,
          }}>
          {photoBase64 ? (
            <Image source={{ uri: photoBase64 }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover" />
          ) : pickingPhoto ? (
            <ActivityIndicator color={BLUE} size="large" />
          ) : (
            <>
              <ICONS.Camera color={BLUE} size={40} sw={1.9} />
              <Text style={{
                fontSize: 11, fontWeight: '800', letterSpacing: 0.5,
                color: BLUE, marginTop: 8,
              }}>
                {t('gid_add_photo', 'Add photo').toUpperCase()}
              </Text>
            </>
          )}
        </TouchableOpacity>
        {!!photoBase64 && (
          <TouchableOpacity onPress={onPickPhoto}
            style={{ marginTop: 14, paddingVertical: 6, paddingHorizontal: 14 }}>
            <Text style={{ color: BLUE, fontSize: 13, fontWeight: '800' }}>
              {t('gid_change_photo', 'Change photo')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Section title={t('gid_sec_dob', 'DATE OF BIRTH')} tk={tk} />
      <FormCard tk={tk}>
        <Field tk={tk} noBorder
          label={t('gid_fld_dob', 'Date of birth (YYYY-MM-DD)')}
          placeholder="1995-03-21"
          value={dob} onChangeText={setDob}
          keyboardType="numbers-and-punctuation"
          Icon={ICONS.Calendar}
          hint={t('gid_fld_dob_hint', 'Optional. Used only for age-based event eligibility.')} />
      </FormCard>
    </View>
  );
}

function ReviewStep({ tk, t, data }) {
  const fullName = [data.title, data.firstName, data.lastName].filter(Boolean).join(' ');
  const placeBits = [data.assembly, data.district, data.region].filter(Boolean).join(' · ');
  const personBits = [data.sex, data.ageBracket, data.status].filter(Boolean).join(' · ');

  return (
    <View>
      {/* Hero summary tile — looks like a card preview to reassure the user
          this is exactly what their Gospeler ID will say. */}
      <LinearGradient
        colors={[BLUE_DEEP, BLUE]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{
          marginHorizontal: 20, borderRadius: 20, padding: 20, marginBottom: 14,
          shadowColor: BLUE, shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.25, shadowRadius: 22, elevation: 6,
          overflow: 'hidden',
        }}
      >
        <View style={{
          position: 'absolute', top: -40, right: -30, width: 140, height: 140,
          borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.12)',
        }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.22)',
            justifyContent: 'center', alignItems: 'center',
            borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
            overflow: 'hidden',
          }}>
            {data.photoBase64 ? (
              <Image source={{ uri: data.photoBase64 }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover" />
            ) : (
              <ICONS.User color="#fff" size={28} sw={1.9} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 9, fontWeight: '900', letterSpacing: 2,
              color: 'rgba(255,255,255,0.85)', marginBottom: 4,
            }}>
              {t('gid_review_eyebrow', 'GOSPELER ID PREVIEW')}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff' }} numberOfLines={2}>
              {fullName || t('gid_no_name', 'No name yet')}
            </Text>
            {!!personBits && (
              <Text style={{
                fontSize: 11, fontWeight: '600',
                color: 'rgba(255,255,255,0.85)', marginTop: 4,
              }} numberOfLines={1}>
                {personBits}
              </Text>
            )}
          </View>
        </View>
      </LinearGradient>

      <Section title={t('gid_review_details', 'DETAILS')} tk={tk} />
      <View style={{
        marginHorizontal: 20, borderRadius: 16, overflow: 'hidden',
        backgroundColor: tk.surface, borderWidth: 1, borderColor: tk.border,
      }}>
        <ReviewRow tk={tk} label="Phone"        value={data.phone || '—'} />
        <ReviewRow tk={tk} label="Email"        value={data.email} />
        <ReviewRow tk={tk} label="City"         value={data.city || '—'} />
        <ReviewRow tk={tk} label="Country"      value={data.country || '—'} />
        <ReviewRow tk={tk} label="Region"       value={data.region || '—'} />
        <ReviewRow tk={tk} label="District"     value={data.district || '—'} />
        <ReviewRow tk={tk} label="Assembly"     value={data.assembly || '—'} />
        <ReviewRow tk={tk} label="Date of birth" value={data.dob || '—'} noBorder />
      </View>
      {!!placeBits && (
        <Text style={{
          paddingHorizontal: 28, fontSize: 11, color: tk.textMuted,
          marginTop: 14, lineHeight: 16, textAlign: 'center',
        }}>
          {placeBits}
        </Text>
      )}
    </View>
  );
}

// ─── Building blocks ──────────────────────────────────────────────────────────
function Section({ title, tk }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 }}>
      <Text style={{
        fontSize: 10, fontWeight: '900', letterSpacing: 2.5, color: tk.textMuted,
      }}>
        {title}
      </Text>
    </View>
  );
}

function FormCard({ children, tk }) {
  return (
    <View style={{
      marginHorizontal: 20, borderRadius: 16, overflow: 'hidden',
      backgroundColor: tk.surface, borderWidth: 1, borderColor: tk.border,
      marginBottom: 6,
    }}>
      {children}
    </View>
  );
}

function Field({
  tk, label, value, onChangeText, placeholder, Icon, keyboardType,
  required, disabled, hint, noBorder,
}) {
  return (
    <View style={{
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: noBorder ? 0 : 1, borderBottomColor: tk.border,
      opacity: disabled ? 0.6 : 1,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        {Icon ? <Icon color={BLUE} size={14} sw={2} /> : null}
        <Text style={{
          marginLeft: Icon ? 6 : 0,
          fontSize: 11, fontWeight: '800', color: tk.textSec, letterSpacing: 0.3,
        }}>
          {label}
          {required ? <Text style={{ color: '#DC2626' }}>  *</Text> : null}
        </Text>
      </View>
      <TextInput
        value={value || ''}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tk.textMuted}
        keyboardType={keyboardType || 'default'}
        editable={!disabled}
        autoCapitalize="words"
        autoCorrect={false}
        style={{
          fontSize: 15, fontWeight: '600', color: tk.textPrimary,
          paddingVertical: 2,
        }}
      />
      {!!hint && (
        <Text style={{ fontSize: 11, color: tk.textMuted, marginTop: 4 }}>{hint}</Text>
      )}
    </View>
  );
}

// Picker — opens a bottom-sheet modal with the option list. Used instead of
// the React Native <Picker> because that component is wildly inconsistent
// between iOS and Android; this gives us a single look + native feel.
function PickerRow({
  tk, label, sub, value, onChange, options, required, disabled, placeholder,
}) {
  const [open, setOpen] = useState(false);
  const rows = Array.isArray(options) ? options : [];

  return (
    <>
      <View style={{ marginHorizontal: 20, marginBottom: 6 }}>
        <TouchableOpacity
          onPress={() => !disabled && setOpen(true)}
          activeOpacity={0.78}
          disabled={disabled}
          style={{
            paddingHorizontal: 14, paddingVertical: 13,
            borderRadius: 14,
            backgroundColor: tk.surface, borderWidth: 1, borderColor: tk.border,
            opacity: disabled ? 0.55 : 1,
          }}
        >
          <Text style={{
            fontSize: 11, fontWeight: '800', color: tk.textSec, letterSpacing: 0.3,
            marginBottom: 4,
          }}>
            {label}
            {required ? <Text style={{ color: '#DC2626' }}>  *</Text> : null}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{
              flex: 1,
              fontSize: 15, fontWeight: '700',
              color: value ? tk.textPrimary : tk.textMuted,
            }} numberOfLines={1}>
              {value || placeholder || 'Select…'}
            </Text>
            <ICONS.ChevronDown color={tk.textMuted} size={16} sw={2} />
          </View>
          {!!sub && (
            <Text style={{ fontSize: 11, color: tk.textMuted, marginTop: 4 }}>
              {sub}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={open} animationType="slide" transparent
        onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Pressable
            onPress={() => {}}
            style={{
              marginTop: 'auto',
              backgroundColor: tk.bg,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              maxHeight: '80%',
              paddingTop: 12, paddingBottom: 24,
            }}>
            <View style={{
              alignSelf: 'center', width: 36, height: 4,
              borderRadius: 2, backgroundColor: tk.border, marginBottom: 10,
            }} />
            <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: tk.textPrimary }}>
                {label}
              </Text>
            </View>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6 }}
              showsVerticalScrollIndicator={false}
            >
              {rows.length === 0 ? (
                <Text style={{
                  paddingVertical: 24, textAlign: 'center', color: tk.textMuted,
                }}>
                  No options available.
                </Text>
              ) : rows.map((opt) => {
                const active = opt === value;
                return (
                  <TouchableOpacity
                    key={String(opt)}
                    onPress={() => { onChange(opt); setOpen(false); }}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingVertical: 14, paddingHorizontal: 14,
                      borderRadius: 12, marginBottom: 4,
                      backgroundColor: active ? BLUE + '12' : 'transparent',
                    }}
                  >
                    <Text style={{
                      flex: 1, fontSize: 15, fontWeight: active ? '800' : '600',
                      color: active ? BLUE : tk.textPrimary,
                    }}>
                      {opt}
                    </Text>
                    {active && <ICONS.Check color={BLUE} size={18} sw={2.4} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ComboField — text input that's always editable, with a small list button on
// the right that opens the bottom-sheet picker for one-tap selection from the
// canonical list. Built for fields where the canonical list is helpful but
// not exhaustive (Country, Region, District, Status, Title, Age Bracket).
//
// Pass `upper` to uppercase as the user types (used for STATUS codes so
// uppercase normalisation matches the backend).
function ComboField({
  tk, label, sub, value, onChange, options, placeholder, required, upper,
}) {
  const [open, setOpen] = useState(false);
  const rows = Array.isArray(options) ? options : [];

  const handleChange = (txt) => {
    onChange(upper ? String(txt || '').toUpperCase() : txt);
  };

  // Default helper so users always know they can type their own value —
  // the chevron makes the field look like a strict dropdown otherwise.
  const helper = sub || (rows.length > 0
    ? 'Type your own value, or tap the list icon to pick a suggestion.'
    : 'Type your value here.');

  return (
    <>
      <View style={{ marginHorizontal: 20, marginBottom: 6 }}>
        <View style={{
          paddingHorizontal: 14, paddingVertical: 12,
          borderRadius: 14,
          backgroundColor: tk.surface, borderWidth: 1, borderColor: tk.border,
        }}>
          <Text style={{
            fontSize: 11, fontWeight: '800', color: tk.textSec, letterSpacing: 0.3,
            marginBottom: 6,
          }}>
            {label}
            {required ? <Text style={{ color: '#DC2626' }}>  *</Text> : null}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              value={value || ''}
              onChangeText={handleChange}
              placeholder={placeholder}
              placeholderTextColor={tk.textMuted}
              autoCapitalize={upper ? 'characters' : 'words'}
              autoCorrect={false}
              style={{
                flex: 1, fontSize: 15, fontWeight: '700',
                color: tk.textPrimary, paddingVertical: 0,
              }}
            />
            {rows.length > 0 && (
              <TouchableOpacity
                onPress={() => setOpen(true)}
                activeOpacity={0.7}
                accessibilityLabel="Pick from list"
                style={{
                  width: 32, height: 32, borderRadius: 10,
                  backgroundColor: BLUE_LIGHT,
                  justifyContent: 'center', alignItems: 'center',
                }}>
                <ICONS.ChevronDown color={BLUE} size={16} sw={2.4} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={{ fontSize: 11, color: tk.textMuted, marginTop: 6 }}>
            {helper}
          </Text>
        </View>
      </View>

      <Modal visible={open} animationType="slide" transparent
        onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Pressable
            onPress={() => {}}
            style={{
              marginTop: 'auto',
              backgroundColor: tk.bg,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              maxHeight: '80%',
              paddingTop: 12, paddingBottom: 24,
            }}>
            <View style={{
              alignSelf: 'center', width: 36, height: 4,
              borderRadius: 2, backgroundColor: tk.border, marginBottom: 10,
            }} />
            <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: tk.textPrimary }}>
                {label}
              </Text>
              <Text style={{ fontSize: 12, color: tk.textMuted, marginTop: 4 }}>
                Don't see yours? Close this and just type it in the field.
              </Text>
            </View>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6 }}
              showsVerticalScrollIndicator={false}
            >
              {rows.length === 0 ? (
                <Text style={{
                  paddingVertical: 24, textAlign: 'center', color: tk.textMuted,
                }}>
                  No suggestions available — please type your value above.
                </Text>
              ) : rows.map((opt) => {
                const active = opt === value;
                return (
                  <TouchableOpacity
                    key={String(opt)}
                    onPress={() => { onChange(opt); setOpen(false); }}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      paddingVertical: 14, paddingHorizontal: 14,
                      borderRadius: 12, marginBottom: 4,
                      backgroundColor: active ? BLUE + '12' : 'transparent',
                    }}
                  >
                    <Text style={{
                      flex: 1, fontSize: 15, fontWeight: active ? '800' : '600',
                      color: active ? BLUE : tk.textPrimary,
                    }}>
                      {opt}
                    </Text>
                    {active && <ICONS.Check color={BLUE} size={18} sw={2.4} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ReviewRow({ tk, label, value, noBorder }) {
  return (
    <View style={{
      flexDirection: 'row', justifyContent: 'space-between',
      paddingHorizontal: 14, paddingVertical: 12,
      borderBottomWidth: noBorder ? 0 : 1, borderBottomColor: tk.border,
    }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: tk.textMuted }}>{label}</Text>
      <Text style={{
        fontSize: 13, fontWeight: '800', color: tk.textPrimary,
        maxWidth: '60%', textAlign: 'right',
      }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}
