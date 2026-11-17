// data/forgotPasswordStrings.js
// Text for the Forgot-password flow, bundled so it works in all four app
// languages without a server round-trip. ft(lang, key, vars) → string.
// Native-speaker review recommended for yo / ig / ha.

const S = {
  en: {
    fp_title: 'Reset password', fp_email_sub: 'Enter the email you signed up with and we’ll send you a 6-digit code.',
    fp_email_label: 'Email address', fp_send: 'Send code', fp_code_title: 'Check your email',
    fp_code_sub: 'We sent a 6-digit code to {e}. It expires in 15 minutes.', fp_spam: 'Can’t see it? Check your spam folder.',
    fp_code_label: '6-digit code', fp_verify: 'Continue', fp_resend: 'Send a new code', fp_resend_in: 'Send again in {s}s',
    fp_pw_title: 'Choose a new password', fp_pw_sub: 'Use at least 8 characters. You’ll be signed out on all your devices.',
    fp_new: 'New password', fp_confirm: 'Confirm password', fp_save: 'Change password',
    fp_mismatch: 'The two passwords don’t match.', fp_short: 'Use at least 8 characters.',
    fp_done_title: 'Password changed', fp_done_body: 'You can now sign in with your new password.', fp_signin: 'Sign in',
    fp_invalid_email: 'Enter a valid email address.', fp_network: 'No connection. Check your internet and try again.',
    fp_err_wrong: 'That code isn’t right. {n} tries left.', fp_err_expired: 'This code has expired. Ask for a new one.',
    fp_err_locked: 'Too many wrong codes. Ask for a new one.', fp_err_rate: 'Too many requests. Please try again in an hour.',
    fp_err_email: 'We couldn’t send the email right now. Please try again in a few minutes.', fp_err_generic: 'Something went wrong. Please try again.',
    fp_err_reset_expired: 'This reset has expired. Please start again.', fp_err_code6: 'Enter the 6-digit code from the email.',
  },
  yo: {
    fp_title: 'Tún ọ̀rọ̀ ìgbaniwọlé ṣe', fp_email_sub: 'Tẹ ímeèlì tí o fi forúkọ sílẹ̀ sí, a ó sì fi kóòdù oní-nọ́ńbà 6 ránṣẹ́ sí ọ.',
    fp_email_label: 'Àdírẹ́sì ímeèlì', fp_send: 'Fi kóòdù ránṣẹ́', fp_code_title: 'Ṣàyẹ̀wò ímeèlì rẹ',
    fp_code_sub: 'A ti fi kóòdù oní-nọ́ńbà 6 ránṣẹ́ sí {e}. Yóò parí láàrin ìṣẹ́jú 15.', fp_spam: 'O kò rí i? Ṣàyẹ̀wò àpò spam rẹ.',
    fp_code_label: 'Kóòdù oní-nọ́ńbà 6', fp_verify: 'Tẹ̀síwájú', fp_resend: 'Fi kóòdù tuntun ránṣẹ́', fp_resend_in: 'Tún fi ránṣẹ́ láàrin ìṣẹ́jú-àáyá {s}',
    fp_pw_title: 'Yan ọ̀rọ̀ ìgbaniwọlé tuntun', fp_pw_sub: 'Lo o kéré jù ọ̀rọ̀ 8. A ó yọ ọ́ kúrò lórí gbogbo ẹ̀rọ rẹ.',
    fp_new: 'Ọ̀rọ̀ ìgbaniwọlé tuntun', fp_confirm: 'Jẹ́rìí ọ̀rọ̀ ìgbaniwọlé', fp_save: 'Yí ọ̀rọ̀ ìgbaniwọlé padà',
    fp_mismatch: 'Àwọn ọ̀rọ̀ ìgbaniwọlé méjèèjì kò jọra.', fp_short: 'Lo o kéré jù ọ̀rọ̀ 8.',
    fp_done_title: 'A ti yí ọ̀rọ̀ ìgbaniwọlé padà', fp_done_body: 'O lè wọlé báyìí pẹ̀lú ọ̀rọ̀ ìgbaniwọlé tuntun rẹ.', fp_signin: 'Wọlé',
    fp_invalid_email: 'Tẹ àdírẹ́sì ímeèlì tó tọ́.', fp_network: 'Kò sí asopọ̀. Ṣàyẹ̀wò íńtánẹ́ẹ̀tì rẹ kí o sì gbìyànjú lẹ́ẹ̀kan sí i.',
    fp_err_wrong: 'Kóòdù yẹn kò tọ̀nà. Ìgbìyànjú {n} ló kù.', fp_err_expired: 'Kóòdù yìí ti parí. Béèrè fún tuntun.',
    fp_err_locked: 'Kóòdù àìtọ́ pọ̀ jù. Béèrè fún tuntun.', fp_err_rate: 'Ìbéèrè pọ̀ jù. Gbìyànjú lẹ́ẹ̀kan sí i lẹ́yìn wákàtí kan.',
    fp_err_email: 'A kò lè fi ímeèlì ránṣẹ́ báyìí. Gbìyànjú lẹ́ẹ̀kan sí i láìpẹ́.', fp_err_generic: 'Nǹkan kan ṣẹlẹ̀. Gbìyànjú lẹ́ẹ̀kan sí i.',
    fp_err_reset_expired: 'Ìtúnṣe yìí ti parí. Jọ̀wọ́ bẹ̀rẹ̀ lẹ́ẹ̀kan sí i.', fp_err_code6: 'Tẹ kóòdù oní-nọ́ńbà 6 tó wà nínú ímeèlì.',
  },
  ig: {
    fp_title: 'Tọgharịa paswọọdụ', fp_email_sub: 'Tinye imeelụ ị jiri debanye aha, anyị ga-eziga gị koodu nke ọnụọgụ 6.',
    fp_email_label: 'Adreesị imeelụ', fp_send: 'Zipu koodu', fp_code_title: 'Lelee imeelụ gị',
    fp_code_sub: 'Anyị zigara koodu nke ọnụọgụ 6 na {e}. Ọ ga-agwụ n’ime nkeji 15.', fp_spam: 'Ị naghị ahụ ya? Lelee ndebiri spam gị.',
    fp_code_label: 'Koodu ọnụọgụ 6', fp_verify: 'Gaa n’ihu', fp_resend: 'Zipu koodu ọhụrụ', fp_resend_in: 'Zipu ọzọ n’ime sekọnd {s}',
    fp_pw_title: 'Họrọ paswọọdụ ọhụrụ', fp_pw_sub: 'Jiri opekata mpe mkpụrụedemede 8. A ga-esi na ngwaọrụ gị niile mee ka ị pụọ.',
    fp_new: 'Paswọọdụ ọhụrụ', fp_confirm: 'Kwenye paswọọdụ', fp_save: 'Gbanwee paswọọdụ',
    fp_mismatch: 'Paswọọdụ abụọ ahụ adịghị otu.', fp_short: 'Jiri opekata mpe mkpụrụedemede 8.',
    fp_done_title: 'Agbanweela paswọọdụ', fp_done_body: 'Ị nwere ike ịbanye ugbu a site na paswọọdụ ọhụrụ gị.', fp_signin: 'Banye',
    fp_invalid_email: 'Tinye adreesị imeelụ ziri ezi.', fp_network: 'Enweghị njikọ. Lelee ịntanetị gị wee nwaa ọzọ.',
    fp_err_wrong: 'Koodu ahụ ezighi ezi. Ntụgharị {n} fọdụrụ.', fp_err_expired: 'Koodu a agwụla. Rịọ nke ọhụrụ.',
    fp_err_locked: 'Koodu ezighi ezi dị ọtụtụ. Rịọ nke ọhụrụ.', fp_err_rate: 'Arịrịọ dị ọtụtụ. Nwaa ọzọ mgbe otu awa gasịrị.',
    fp_err_email: 'Anyị enweghị ike izipu imeelụ ugbu a. Nwaa ọzọ n’ime nkeji ole na ole.', fp_err_generic: 'Ihe ezighi ezi mere. Nwaa ọzọ.',
    fp_err_reset_expired: 'Mgbanwe a agwụla. Biko malitegharịa.', fp_err_code6: 'Tinye koodu ọnụọgụ 6 sitere na imeelụ.',
  },
  ha: {
    fp_title: 'Sake saita kalmar sirri', fp_email_sub: 'Shigar da imel ɗin da ka yi rajista da shi, za mu aiko maka da lambar lambobi 6.',
    fp_email_label: 'Adireshin imel', fp_send: 'Aika lamba', fp_code_title: 'Duba imel ɗinka',
    fp_code_sub: 'Mun aika lambar lambobi 6 zuwa {e}. Za ta ƙare cikin mintuna 15.', fp_spam: 'Ba ka gan ta ba? Duba babban fayil ɗin spam.',
    fp_code_label: 'Lambar lambobi 6', fp_verify: 'Ci gaba', fp_resend: 'Aika sabuwar lamba', fp_resend_in: 'Sake aikawa cikin daƙiƙa {s}',
    fp_pw_title: 'Zaɓi sabuwar kalmar sirri', fp_pw_sub: 'Yi amfani da haruffa 8 aƙalla. Za a fitar da kai daga dukan na’urorinka.',
    fp_new: 'Sabuwar kalmar sirri', fp_confirm: 'Tabbatar da kalmar sirri', fp_save: 'Canja kalmar sirri',
    fp_mismatch: 'Kalmomin sirri biyu ba su yi daidai ba.', fp_short: 'Yi amfani da haruffa 8 aƙalla.',
    fp_done_title: 'An canja kalmar sirri', fp_done_body: 'Yanzu za ka iya shiga da sabuwar kalmar sirrinka.', fp_signin: 'Shiga',
    fp_invalid_email: 'Shigar da adireshin imel mai kyau.', fp_network: 'Babu haɗi. Duba intanet ɗinka ka sake gwadawa.',
    fp_err_wrong: 'Lambar ba daidai ba ce. Saura gwaji {n}.', fp_err_expired: 'Lambar ta ƙare. Nemi sabuwa.',
    fp_err_locked: 'Lambobi marasa daidai da yawa. Nemi sabuwa.', fp_err_rate: 'Buƙatu da yawa. Sake gwadawa bayan awa ɗaya.',
    fp_err_email: 'Ba mu iya aika imel yanzu ba. Sake gwadawa cikin ƙanƙanin lokaci.', fp_err_generic: 'Wani abu ya faru. Sake gwadawa.',
    fp_err_reset_expired: 'Wannan sake saitin ya ƙare. Da fatan ka sake farawa.', fp_err_code6: 'Shigar da lambar lambobi 6 daga imel.',
  },
};

export function ft(lang, key, vars) {
  let s = (S[lang] && S[lang][key]) || S.en[key] || key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
export const FORGOT_STRINGS = S;
