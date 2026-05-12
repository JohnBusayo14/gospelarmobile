// data/victoryMonth.js
// ─────────────────────────────────────────────────────────────────────────────
// Victory Month Prayer Bulletin — 30 days of focused prayer + 6 vigil guides.
//
// Source: GOFAMINT North America 2026 Victory Month Bulletin
//   Theme:  "Season of True Revival & Great Exploits"
//   Window: January 2 – 31, 2026
//
// Shape per day:
//   day             — 1..30
//   date            — display string ("Friday, January 2, 2026")
//   focus           — title shown on the hero
//   scripture       — reference, e.g. "Psalms 40:1-11, 136"
//   message         — short inspirational paragraph
//   prayer_points   — array of strings
//   intercession    — single string ("Special Intercession")
//
// Shape per vigil:
//   id              — slug ('family-1', 'youth', 'women', 'men', 'general')
//   group           — Family | Youth | Women | Men | General
//   date            — display string
//   focus           — title
//   scripture       — reference
//   message         — narrative
//   discussion      — array of strings (discussion / reflection questions)
//   prayer_points   — array of strings
// ─────────────────────────────────────────────────────────────────────────────

export const VICTORY_META = {
  year:     2026,
  theme:    'Season of True Revival & Great Exploits',
  window:   'January 2 – 31, 2026',
  organisation: "The Gospel Faith Mission Int'l (GOFAMINT) — North America",
  pages:    125,
};

export const VICTORY_DAYS = [
  {
    day: 1,
    date: 'Friday, January 2, 2026',
    focus: 'Thanksgiving for What God Has Done and Will Do in 2026',
    scripture: 'Psalms 40:1-11; 136',
    message:
      "As we step into this season of revival and great exploits, we begin rightly with a heart full of thanksgiving. Genuine revival does not start with activity — it begins with a heart that recognises God's grace. Throughout Scripture, whenever God prepared a people for renewal, increase and divine exploits, He first called them back to gratitude, humility and reverence. Thanksgiving aligns our hearts with God, clears the spiritual atmosphere and prepares us for divine exploits beyond human strength.",
    prayer_points: [
      'Father, we thank You for GOFAMINT worldwide — for preservation, growth and continuity by Your grace.',
      'Thank You for every nation, city and community where You have planted GOFAMINT as a light and witness.',
      'We thank You for revival already stirring in our assemblies, leaders and members.',
      'Thank You for past victories, answered prayers and spiritual exploits that remind us You are still at work.',
      'Father, we appreciate You for unity of vision, doctrine and purpose across GOFAMINT globally.',
      'We thank You for our General Overseer Pastor (Dr.) Elijah Oludele Abina — for renewed strength and continued favor.',
      'Thank You for our leaders, pastors, evangelists, ministers and workers who have remained faithful in season and out of season.',
      'We thank You in advance for greater exploits, supernatural impact and unusual testimonies this season.',
      'Father, we thank You for preserving our families by Your mercy and sustaining us by Your grace.',
      'Thank You for peace in our homes, provision for our needs and protection over our loved ones.',
      'Lord, I thank You for this season of revival — for reviving my hunger for You and positioning me for great exploits.',
      'Father, we give You thanks in advance for all You will do in these 30 days of prayer and fasting.',
    ],
    intercession:
      'Psalms 84:2-8 — Receive strength to pray through without wavering or weariness throughout the Victory Month.',
  },
  {
    day: 2,
    date: 'Saturday, January 3, 2026',
    focus: 'Overcoming Barriers to True Revival and Great Exploits',
    scripture: 'Acts 4:29-32; Daniel 11:32; Hosea 10:12; Habakkuk 3:2',
    message:
      "Every genuine move of God in history has begun with a desperate cry from His people: 'Lord, revive us again!' Revival is not a human invention — it is a divine visitation. The greatest need of our Church today is not merely growth in number, structure or programs, but a fresh outpouring of the Spirit. Between God's desire to revive and the Church's experience of revival lie barriers — unconfessed sin, cold love, lukewarmness, fear, unforgiveness, materialism, loss of passion for souls, prayerlessness, pride, doctrinal compromise — that must be identified and removed.",
    prayer_points: [
      'Heavenly Father, we humbly repent from every form of backsliding. Cleanse Your Church from spiritual complacency and revive our passion for You.',
      'Lord, purge Your Church of every hidden sin and secret compromise that has quenched the fire of the Holy Spirit.',
      'O Lord, by the power of Your Spirit, remove every barrier, seen or unseen, standing in the way of true revival.',
      'Father, let Your signs, wonders and mighty works follow our willingness and obedience.',
      'Lord, tear down every wall of division, strife, bitterness and unforgiveness — unite us in one accord.',
      'Father, deliver us from worldliness, pride and self-glory. Let every desire that competes with Your glory be uprooted from our hearts.',
      'O Lord, awaken every sleeping leader, worker and member throughout Your Church worldwide.',
      'Father, let the fire of prayer burn anew upon every altar. Ignite in us a fresh hunger and thirst for Your presence.',
      'Lord, pour fresh oil upon every leader, worker and member for usefulness, fruitfulness and lasting kingdom impact.',
      "O Lord, make every assembly a place of divine encounter, revival and great exploits.",
      'Spirit of Truth, expose and uproot every false doctrine and error in all our assemblies worldwide.',
      'Father, begin with me. Revive my heart again. Make me Your agent of revival wherever I go.',
    ],
    intercession:
      'Lord, ignite true revival in our hearts and keep us burning for You in season and out of season, for Your glory alone.',
  },
  {
    day: 3,
    date: 'Sunday, January 4, 2026',
    focus: 'Personal Revival — Lord, Make Me an Agent of True Revival',
    scripture: 'John 9:4-5; Romans 13:11-14; Psalms 80:18-19; Isaiah 57:15; Leviticus 6:13',
    message:
      'Personal revival is the root of family and Church revival — the seed from which all other revivals grow. To be personally revived is to be re-fired, refined, refilled, rightly corrected, connected and re-empowered for the glory of God. Personal revival makes you become a wall of fire, a voice of truth and a weapon in God\'s hand. Without it, devotional altars turn to ashes; with it, you don\'t just survive — you shine, serve faithfully and stand strong for God in your circle of influence.',
    prayer_points: [
      'Father, breathe life into my spirit; awake every dormant part of my heart that has grown cold towards You.',
      'Father, help me that I will not be useful to Satan and his kingdom in any way or form.',
      'O Lord, revive me so that I will not be useless to Your kingdom, myself, my family and my generation.',
      'O Lord, revive me in all aspects of my personal life — make me very useful and fruitful for Your Kingdom.',
      'O Lord, revive and empower me to become a great barrier to Satan and his agenda at all levels.',
      'O Lord, help me to be renewed in prayer, holiness and obedience so the revival fire spreads from me to my family.',
      'Lord, cause me to shine, serve faithfully and stand strong for God every day of my life.',
      'Heavenly Father, deliver me from all human and demonic factors and activities of the flesh that rob one of genuine personal revival.',
      'Father, increase my hunger and thirst for Your righteousness and presence.',
      'Holy Spirit, convict me of every hidden sin and attitude that grieves you; lead me to genuine repentance.',
      'Father, baptize me with a contagious passion that ignites revival in my family, Church and beyond.',
      'Lord Jesus, breathe Your resurrection power into every dying area of my life.',
    ],
    intercession:
      'Father, let personal revival be my passion and portion. Renew my heart by Your Spirit and make me a vessel fully yielded to You, where the works of the enemy have no place.',
  },
  {
    day: 4,
    date: 'Monday, January 5, 2026',
    focus: 'Family Revival — Lord, Usher My Family Into a Season of True Revival',
    scripture: 'Joshua 24:14-15; Psalms 78:1-11',
    message:
      "Family is the foundation of society and the first school of faith and holiness. The Church is a collection of families — therefore family revival is the seed of national transformation. You can be righteous and still have no revival in your family: Lot was righteous, Eli served faithfully, Samuel led with integrity, David was a man after God's heart — yet their homes lacked revival fire. True revival does not end in the secret place; it must flow into the living room. God is calling fathers, mothers and children back to the family altar — to pray again, search the Scripture together again, forgive again and love again.",
    prayer_points: [
      'Lord, have mercy on me and my family in every area of our lives; let Your mercy speak for us.',
      'Our great God, show us mercy and revive us in every area of our family life — spiritually, relationally, emotionally and financially.',
      'Lord, purge our family of any sin that is calling for judgment; let Your mercy speak over us.',
      'Every satanic assignment against the peace, joy or destiny of my family — be destroyed by the blood of Jesus.',
      'Heavenly Father, let Your fire fall on my household — purify, heal and revive every heart in my family.',
      'Father, break every negative generational pattern in my family line.',
      'O Lord, deliver my family from hidden battles and silent tears.',
      'Lord, let all my family members encounter You personally and uniquely.',
      'Lord, save every unsaved member of my family and sanctify every unsanctified member.',
      'Father, let peace, forgiveness and understanding reign among our family members.',
      'O Lord, let our home be a sanctuary of Your peace, love and unity — and not chaos.',
      'Father, rekindle the fire of revival in my family and let it burn continuously.',
    ],
    intercession:
      "Lord, by Your mercy, dry the tears of every family on the verge of collapse. Strengthen the weary, lift the depressed, restore their spiritual passion and realign their hearts to godly priorities.",
  },
  {
    day: 5,
    date: 'Tuesday, January 6, 2026',
    focus: 'Church-Wide Revival — A Dawn of True Revival in Our Church Worldwide',
    scripture: 'Hosea 10:12; Revelation 2:4-5; Psalm 85:6; Zechariah 10:1',
    message:
      "The greatest issue is not the absence of divine power, but the absence of prepared, faithful and available vessels. True revival begins when the Church stops entertaining and starts repenting — when the Word of God replaces religious discussion, prayer replaces program, holiness replaces noise, and love for souls replaces love for status. Revival is not a program — it is a visitation. When God Himself steps into the Church, sermons carry fire, prayers carry power, worship carries weight and holiness becomes beautiful again.",
    prayer_points: [
      'Lord, forgive us for every sin that is recorded against us, quenching Your fire in our Church.',
      'Lord, pour out on us a new passion for holiness, truth and faithfulness to You.',
      'Father, let every pulpit in our Church burn again with uncompromising fire.',
      'Gracious Father, let every department, ministry, unit and venture experience the flame of revival.',
      'God, keep me very useful and fruitful in Your service.',
      'Father, empower us and let our children and youths be agents of revival.',
      'Holy Spirit, empower me to do and sustain exploits, not just achieve it.',
      'Lord, let the power of purity silence the noise of hypocrisy in my Church.',
      'Father, heal wounded ministers and restore fallen soldiers among us worldwide.',
      'Lord, let signs and wonders follow Your Word in every assembly of this Church.',
      'Father, let holiness return to our pulpits and passion to our pews.',
      'Heavenly Father, raise men and women of prayer, power and purity in every local assembly.',
    ],
    intercession:
      'Father, pour upon us fresh oil from heaven to ignite renewal and sustain genuine revival in every aspect of our Church worldwide.',
  },
  {
    day: 6,
    date: 'Wednesday, January 7, 2026',
    focus: 'Overcoming Unforgiveness in Our Lives, Families and Church',
    scripture: 'Matthew 6:14-15; Ephesians 4:31-32; Mark 11:25-26; 2 Chronicles 7:14',
    message:
      "Unforgiveness is a great barrier to the move of God through any individual, family and Church. It is holding a fire that burns only you. Revival dies where unforgiveness thrives. Forgiveness is the doorway to revival — when we forgive, we mirror the cross; when we release others, heaven releases us. The Holy Spirit cannot dwell in a heart filled with bitterness. Forgiveness opens the heavens, invites divine visitation, heals wounds, restores presence, opens doors of miracles, and multiplies exploits in ministry.",
    prayer_points: [
      'Father, we thank You because through the blood of Jesus we have redemption — the forgiveness of our sins.',
      'O Lord, heal Your Church as those You have forgiven. Shape us into a forgiving people.',
      'Father, empower us to overcome the stronghold of unforgiveness that seeks to weaken Your Church.',
      'O Lord, breathe fresh revival through hearts that forgive.',
      'Father, revive our hearts by Your mercy and let the spirit of forgiveness flow freely in our families.',
      'Heavenly Father, restore the spirit of unity in our Church and break every chain of offense.',
      'O Lord, reveal and heal every hidden root of bitterness in my heart and within my family.',
      'Gracious Father, heal broken friendships and restore marriages throughout Your Church worldwide.',
      'Father, cleanse us from every form of pride, anger and resentment.',
      'Lord, immerse us in compassion and ignite again the fire of love across our Church.',
      'Father, as You forgive me, help me to forgive others — break every barrier created by offense.',
      'Heavenly Father, let forgiveness open afresh the gate of miracles and kingdom exploits.',
    ],
    intercession:
      'O Lord, baptize us with uncommon grace to forgive fully and walk in love, both in our homes and in every GOFAMINT assembly worldwide.',
  },
  {
    day: 7,
    date: 'Thursday, January 8, 2026',
    focus: 'Rekindle the Fire in All Departments, Ministries, Units and Ventures',
    scripture: 'Ephesians 4:15-16; Psalms 85:6-9; Leviticus 6:13',
    message:
      "All departments, ministries, units and ventures in GOFAMINT are expected to be vibrant, effective and efficient. We need to ask God to re-kindle the fire of revival as in the past — the power, love and commitment of old. When fire falls, fear disappears and faith arises, cowards become carriers of power, ordinary departments become extraordinary channels of miracles, and ventures thrive by divine wisdom and not mere strategy.",
    prayer_points: [
      'Heavenly Father, we thank You for all departments, ministries, units and ventures within GOFAMINT.',
      'Father, we thank You for the leaders and heads of these departments, ministries, units and ventures.',
      'Lord, surround every department with the wall of Your power; keep every polluting influence far away.',
      'O Lord, protect all workers, ministers and staff from every form of attack — spiritual, emotional or physical.',
      'Heavenly Father, empower every unit and venture to function effectively and efficiently.',
      'Lord, may all who labor faithfully not lose their reward, neither on earth nor in heaven.',
      'Father, let the divine purpose for which each unit was established be fully accomplished.',
      'Father, let the Spirit of holiness rest mightily upon every department, ministry, unit and venture.',
      'Lord, cause great exploits to break forth from every department, ministry, unit and venture.',
      'Father, ignite every cold, discouraged, distracted or weary heart within our departments — set them ablaze again.',
      'Lord, transform every department into a lighthouse of revival and a center of spiritual reawakening.',
      'We pray that every leader receives clear vision, divine burden, wisdom and courage for effective leadership.',
    ],
    intercession:
      'Father, release fresh passion upon every leader, worker and member to walk worthy of our calling across all departments, units and ministries of the Church, to the glory of Your name.',
  },
  {
    day: 8,
    date: 'Friday, January 9, 2026',
    focus: 'Empowering Our Leaders to Become Agents of Transformational Revival',
    scripture: 'Psalms 85:6-7; Acts 6:3-4; 1 Samuel 10:6; Judges 6:14; Daniel 11:32',
    message:
      "Every lasting revival began with leaders who caught the fire of God. When leaders are weak, prayerless and carnal, the work of God stagnates; but when leaders are Spirit-empowered and full of faith, revival flows from them like a river. Today we don't just need trained leaders — we need transformed leaders, carriers of Holy Ghost fire with conviction, compassion and courage. When leaders are blazing, followers catch the flame. True exploits are Spirit-birthed, not self-manifested.",
    prayer_points: [
      'Heavenly Father, we thank You for the leaders at every level of GOFAMINT — we receive them as Your gifts.',
      'Lord, we thank You for the sustaining grace that has preserved our leaders in their various spheres of responsibility.',
      'Father, we repent of every leadership weakness, misunderstanding or disunity that has hindered the flow of Your power.',
      'O Lord, uproot every form of carnality, rivalry and unhealthy competition that quenches the fire of revival.',
      'Heavenly Father, equip our leaders with fresh grace, inner strength, spiritual zeal and divine wisdom for effective leadership.',
      'Lord, endue our leaders with power from above and the abiding presence of Your Spirit, that they may serve faithfully without falling.',
      'Father, energize our leaders to function as agents of regeneration and transformation across GOFAMINT.',
      'Heavenly Father, strengthen and encourage our leaders to walk and work as carriers of revival in every area of their responsibility.',
      'Lord, grant our leaders sound knowledge, discernment and understanding.',
      'Father, saturate the hearts of our leaders with heaven-inspired commitment that produces Spirit-birthed exploits.',
      'Lord, raise a new generation of leaders who are passionate in spirit, pure in heart and purposeful in calling.',
      'Lord, transform our leaders into vessels who see through Your eyes, serve through Your love, speak with Your authority and move under Your anointing.',
    ],
    intercession:
      'Father, make our leaders carriers of Your revelation and grace, empowering every member of our Church to remain focused and serve You with undivided loyalty, to the glory of Your name.',
  },
  {
    day: 9,
    date: 'Saturday, January 10, 2026',
    focus: 'Revival in Our Worship Services — Breathe on Our Sunday and Midweek Gatherings',
    scripture: 'Psalm 85:6-7; Zephaniah 3:16-20',
    message:
      "The Church is the called-out people of God. As people come together on Sundays and otherwise, expectations are that God's people will be effective and efficient in worship, fellowship and service. Yet in many places what should be a divine encounter has become a routine gathering. When the Holy Ghost breathes upon a service, souls are convicted — not entertained, hearts are transformed — not impressed, the sick are healed and sinners are saved. Every service must not remain a normal meeting; it must become a holy furnace of transformation.",
    prayer_points: [
      'Heavenly Father, we thank You for Your faithful dealings with GOFAMINT from its inception until now.',
      'Lord, we thank You for Your manifold grace upon every minister and member of GOFAMINT worldwide.',
      'Lord, we repent of every form of routine, lifeless worship and powerless gathering — we ask for Your mercy and renewal.',
      'O Lord, breathe afresh upon our Sunday services and turn them into channels of divine encounter and abundant blessing.',
      'Father, let every Sunday service across GOFAMINT become a platform for genuine revival and extraordinary miracles.',
      'Heavenly Father, make our Sunday and midweek services spiritually attractive and powerful.',
      'Lord, anoint all our ministers with grace for thorough preparation and Spirit-led delivery of Your Word.',
      'Father, ignite in our members a deep hunger and thirst for You, for holiness and spiritual maturity.',
      'Father, visit our midweek services with fresh revelation and prophetic fire, causing hearts to burn within us.',
      'Holy Spirit, preside over every service — direct every moment, guide every word, manifest Your presence.',
      'Father, replace routine with revival and tradition with genuine transformation.',
      'Lord, release the power of conviction upon every gathering — let sinners encounter Christ and not depart unchanged.',
    ],
    intercession:
      "Father, unite us in worship and fellowship, and let a season of refreshing from Your presence flow freely and unhindered among us, in Jesus' name.",
  },
  {
    day: 10,
    date: 'Sunday, January 11, 2026',
    focus: 'Gospel City Partnership Seed Drive',
    scripture: 'Ezra 6:14; Deuteronomy 18:4, 26:11; Luke 5:1-11; Exodus 25:1-9, 36:2-7; 1 Kings 17:8-15; Zechariah 1:17',
    message:
      "The acquisition of our Gospel City property was made possible solely by the grace of God in 2022. Today, GOFAMINT NA stands as the full owner of this $2,061,906.25 property — completely debt-free — through the collective sacrifice of our partners. The 2025/2026 Gospel City Partnership Seed Drive, launched by our National Overseer, is a faith-driven campaign aimed at raising $1 million between July 2025 and July 2026. Partnership is a covenant pathway for blessing, and Zechariah 1:17 declares: 'My cities shall again spread out through prosperity.'",
    prayer_points: [
      'Father, we thank You because You are the Giver of all things and freely give us all things to enjoy.',
      'Father, we thank You for every member of GOFAMINT NA who has identified with the Gospel City vision.',
      'O Lord, grant us the grace of obedience to Your commandments, that we may walk fully in Your will.',
      'Father, bless all Your children who have remained faithful in the payment of their tithes and Partnership Seed.',
      'O Lord, as I participate faithfully in this year\'s Partnership Seed, activate Your covenant over my life.',
      'Father, arise in Your power and raise covenant helpers for me; enlarge my coast as I obey You faithfully.',
      'Every connection that ties me to destiny killers — catch fire and be burnt to ashes by the Holy Spirit.',
      'Father, baptize us with a higher grace of sacrificial giving this year — surpassing all previous levels.',
      'Father, let everyone who has redeemed pledges experience divine conquests and unstoppable prosperity.',
      'Father, use the Partnership Seed to elevate us into higher dimensions of cheerful and faithful giving.',
      'Because we are committed to Your project, O Lord, banish poverty and lack from our lives.',
      'Father, bless the Chairman and members of the Gospel City Maintenance and Building Committee with blessings money can buy and blessings money cannot buy.',
    ],
    intercession:
      "Personal prayer requests for 2026 and special ministration for those who have pledged, who desire to pledge, who have redeemed pledges fully, and who are trusting God for grace to complete their commitments.",
  },
  {
    day: 11,
    date: 'Monday, January 12, 2026',
    focus: 'Divine Intervention for Our Matured Singles and Waiting Couples',
    scripture: 'John 2:1-11; Psalms 68:3-6; Psalms 113:5-9',
    message:
      "Today a sacred and weighty responsibility rests upon us as the household of faith. As a church, we are called to carry — compassionately — the burdens of our matured single brothers and sisters who desire marriage, and our married couples who are trusting God for the fruit of the womb. Though some may smile in public worship, only God knows the silent tears shed in private moments. The Lord declares in Exodus 3:7, 'I have surely seen the affliction of My people… and have heard their cry.' Our God sees, hears, knows and performs.",
    prayer_points: [
      'Father, we repent for every time we have been insensitive to the silent struggles of our brethren who desire marriage and children.',
      'Today we stand in the gap on behalf of our brethren. Look upon us in mercy and turn their sorrow into joy.',
      'According to Your Word, we choose to weep with those who weep — let heaven respond to our united cry.',
      'Lord, heal every abnormality, every reproach and every hidden wound in their lives.',
      'Just as You visited the wedding at Cana, Lord Jesus, step into our midst today and intervene in every delayed situation.',
      'Father, by Your mighty power, open the doors of goodness, favor and divine connection into the lives of our brethren.',
      "Father, pour new wine into the lives of our matured singles — replace weariness with hope and silence with songs of rejoicing.",
      'Turn every season of mourning into celebration — let the days of wedding bells and naming ceremonies arise among us.',
      'We prophesy that the God-ordained spouse for our waiting sisters and brothers will manifest and align with them divinely.',
      'In the name of Jesus, we declare the release of God-ordained children into the wombs of all waiting mothers in GOFAMINT.',
      'According to Genesis 2:18, it is not good for man or woman to be alone — Lord, give each one their bone of bones and flesh of flesh.',
      'According to Psalm 127:3, children are Your heritage — Lord, release Your heritage into every waiting family.',
    ],
    intercession:
      "Father, break every barrier to conjugal bliss in our churches. Establish honorable marriages and keep the marriage bed undefiled. Let our tabernacles be filled with the voice of rejoicing and salvation. No more silent tears, no more reproach — only testimonies and celebrations.",
  },
  {
    day: 12,
    date: 'Tuesday, January 13, 2026',
    focus: 'Total Protection, Provision and Preservation for All GOFAMINT Members',
    scripture: 'Isaiah 45:1-8; Psalm 125',
    message:
      "Being in Christ carries immeasurable covenant privileges. Salvation is not merely an escape from sin; it is an entrance into a divine heritage of provision, protection, preservation and peace. The world around us is characterised by uncertainty and spiritual darkness, but we are not of this world. As GOFAMINT members we carry an enduring spiritual legacy. Fear, anxiety, sadness and discouragement are not fruits of the Spirit; they are weapons of the enemy, designed to weaken believers and hinder destiny. Today we rise above every negative influence and step fully into our covenant advantage in Christ.",
    prayer_points: [
      'Father, we thank You because You have not given us the spirit of fear, but of power, love and a sound mind.',
      'By the authority in the name of Jesus, we cast out the spirits of fear, anxiety, sadness and discouragement.',
      'We release the blood of Jesus to destroy every negative force operating around our personal lives, families and GOFAMINT assemblies.',
      'We reject and renounce every spirit of ill-luck, failure, disappointment, disaster and frustration.',
      'We receive the sound mind produced by faith, prayer and joy.',
      'We reject and eject every poverty mentality from the hearts of GOFAMINT members worldwide.',
      'We decree a divine transition from dry places of lack to well-watered gardens of more than enough.',
      'Father, as the mountains surround Jerusalem, let Your divine presence surround GOFAMINT members worldwide.',
      'Every evil operation plotted in secret against GOFAMINT members is cancelled and destroyed.',
      'According to Psalm 91:10, we decree zero evil occurrence and zero evil experience for all GOFAMINT members.',
      'In fulfillment of Isaiah 8:18, let signs and wonders define GOFAMINT families and assemblies.',
      'According to Proverbs 4:18, we decree progress, growth and increase in all our lives and assemblies.',
    ],
    intercession:
      'Father, instill divine confidence in all our undertakings. Release the spirit of boldness, faith and sound mind upon all GOFAMINT members. Empower us to advance fearlessly, flourish greatly and fulfill destiny.',
  },
  {
    day: 13,
    date: 'Wednesday, January 14, 2026',
    focus: 'Miraculous Intervention in Difficult Times in Our Mission Worldwide',
    scripture: 'Isaiah 1:2-7; Jonah 2:1-10',
    message:
      "One of the common realities of human existence is difficulty. Yet every challenge has a divine antidote. Jesus speaks: 'Be of good cheer; it is I; be not afraid.' Scripture reveals three major sources of challenges: sin of commission, sin of omission and satanic attacks. Jonah's struggle was ultimately connected to his reluctance to evangelise. The Great Commission remains God's highest priority — when the Church neglects soul-winning, spiritual unrest follows. Apostle Paul cried: 'Woe is unto me, if I preach not the gospel!'",
    prayer_points: [
      'Father, we thank You because Your plans for our lives are plans of peace, hope and a glorious future.',
      'With a contrite heart, we confess and forsake every sin of commission and omission. Cleanse us by the blood of Jesus.',
      'Father, let mercy prevail over judgment in our lives. Silence every accusation of the enemy through the blood of Jesus.',
      'As Jonah cried from the depths, we cry unto You today, Lord — arise and intervene in every unresolved challenge.',
      'According to 1 Cor 10:13b, release heaven\'s ordained solution to every challenge confronting my life.',
      'Let the anointing of the Holy Spirit break every yoke and terminate long-standing problems in our lives.',
      'Remove the garment of hardship and clothe us with freedom, joy and glory.',
      'We reject sickness and receive health; we reject failure and receive success; we reject stagnation and receive progress.',
      'By divine power, transport us from places of discomfort to our God-ordained rest and fulfillment.',
      'Under the corporate anointing of the Holy Spirit, we decree the release of every GOFAMINT member under oppression.',
      "All across GOFAMINT, Father grant us the grace of genuine repentance and total obedience.",
      'Father, restore GOFAMINT fully to the heartbeat of evangelism — rekindle fresh passion for soul-winning.',
    ],
    intercession:
      'Father, deliver us from selective obedience. Align our hearts fully with Your will. Make us obedient, fruitful and pleasing unto You. Let GOFAMINT NA walk in divine order, spiritual authority and kingdom impact.',
  },
  {
    day: 14,
    date: 'Thursday, January 15, 2026',
    focus: 'Solving Our Problems and Meeting All Our Needs',
    scripture: 'Psalm 128; Philippians 4:13-20',
    message:
      "Every human being instinctively desires goodness, peace, progress, fulfillment and abundance — this desire is God-given. Yet the very good things God designed for our lives often appear delayed or elusive. Jesus revealed the spiritual explanation: 'An enemy has done this.' But three powerful truths work in our favor: God's purpose for our lives is good (Jer 29:11), the righteous desires of our hearts are approved by God (Ps 37:4), and the primary mission of Christ was to destroy the works of the enemy (1 John 3:8). Prayer is our spiritual rod that confronts satanic resistance.",
    prayer_points: [
      'We declare that we are conquerors and overcomers through Christ Jesus.',
      'Father, we thank You for Your loving-kindness and Your eternal program of goodness for our lives.',
      'With heartfelt appreciation and by faith in the finished work of Christ, we receive every package of goodness You have prepared.',
      'We come under the Cross of Calvary and declare that Jesus Christ is Lord over our lives, families and destinies.',
      'Every power resisting God\'s good plan for our lives — bow, lose your grip and be removed in Jesus\' name.',
      'According to 1 John 4:4, we declare that we are of God, and no aspect of our lives shall yield to satanic operations.',
      'We decree divine healing over our land, our families and all GOFAMINT assemblies.',
      'As in Joshua 7:20-24, we expose and uproot every hidden work of sin and compromise in our midst.',
      "We decree Operation 'No Room for Satan' in GOFAMINT, in Jesus' name.",
      'In line with Daniel 11:32b, empower each of us to know You and the power of Your resurrection.',
      'Give every one of us an open door into our land of destiny to fulfill divine purpose.',
      'According to Psalm 34:10, make GOFAMINT a house of abundant spiritual nourishment and tangible blessings.',
    ],
    intercession:
      "Father, meet all our needs according to Your riches in glory by Christ Jesus. Arise and contend with every adversary standing against Your people. Let GOFAMINT NA walk in victory, abundance, peace and divine rest — no lack, no defeat, no unanswered prayers, only glory, provision and triumph.",
  },
  {
    day: 15,
    date: 'Friday, January 16, 2026',
    focus: 'Overcoming Destiny-Limiting Vices — Laziness, Ignorance, Mediocrity, Procrastination',
    scripture: 'Proverbs 6:6-11; Ecclesiastes 10:18; Romans 12:11; Hosea 4:6; Proverbs 4:7; Daniel 6:3; Ecclesiastes 11:4',
    message:
      "Destiny is God's eternal blueprint for every individual life — His ordained plan for impact, relevance and fulfillment. Yet many destinies are delayed, diminished or even aborted not primarily by demons, but by personal vices: laziness suffocates potential, ignorance limits capacity, mediocrity opposes excellence, procrastination is the silent thief of time. Daniel stood out because 'an excellent spirit was in him.' Jesus lived with urgency: 'I have a baptism to be baptized with; how am I straitened till it be accomplished!' When diligence replaces laziness, wisdom replaces ignorance, excellence replaces mediocrity and discipline replaces procrastination, destiny is preserved.",
    prayer_points: [
      'Father, thank You for the gift of destiny and divine purpose You have deposited in my life.',
      'Lord, I surrender every area of weakness, inconsistency and compromise — let Your strength be perfected in me.',
      'Father, deliver me from every spirit of laziness, slothfulness and complacency hindering my progress.',
      'Every power assigned to make me waste time, energy and opportunity — be destroyed in Jesus\' name.',
      'O Lord, baptize me afresh with the spirit of diligence, discipline and excellence.',
      'Every chain of ignorance limiting my growth — break now by fire.',
      'Father, let the Spirit of revelation, insight and wisdom abide with me continually.',
      'Father, uproot every spirit of average performance — impart unto me an excellent spirit like Daniel.',
      'Lord, make me a standard of excellence and a model of godly success in my generation.',
      'Father, deliver me from the traps of delay, indecision and procrastination.',
      'Father, awaken every dormant gift, calling and potential You placed within me.',
      'By Your Spirit, move me from excuses to execution, from potential to performance.',
    ],
    intercession:
      'Father, deliver us as a people from laziness, complacency and the demon of procrastination. Impart unto us the grace for diligence, urgency, excellence and faithful stewardship. Our destiny shall not be aborted, our purpose shall not be delayed, and God shall be glorified through our lives.',
  },
  {
    day: 16,
    date: 'Saturday, January 17, 2026',
    focus: 'Home Mission — Great Breakthrough, Divine Speed, Provision and Protection for Missionaries',
    scripture: 'Isaiah 58:11; Psalm 107:9; Song of Solomon 4:15; Psalm 91:3-6',
    message:
      "Nigeria remains our primary mission field — a land with vast populations still unreached. Though churches abound, many communities remain in spiritual darkness. The gospel will not reach these fields unless missionaries are sent. Satan is making frantic efforts to barricade people from the truth through fear, violence, poverty and persecution. Missionary work is not convenient — it is costly. Yet our missionaries press on, driven by love for souls and obedience to the Great Commission. The Gospel Faith Mission International itself began as a missionary movement; to neglect missions is to disconnect from our roots.",
    prayer_points: [
      'Father, we thank You for Your faithfulness over all our missionaries through the years.',
      'Lord, we appreciate You for the Missions Department, its leadership, staff and members.',
      'Thank You, Father, for sustaining the Missions School and using it to strengthen our soul-winning mandate.',
      'According to Psalm 91:3-6, continue to honor Your covenant of protection and peace over every missionary.',
      'Father, grant our missionaries uncommon favor with community leaders, government authorities and the people they serve.',
      'Lord, grant them divine speed and grace to penetrate difficult and resistant mission fields for Your glory.',
      'Heavenly Father, provide regularly and abundantly for our missionaries.',
      'In this season of great exploits, grant our missionaries undeniable testimonies of kingdom expansion and transformed lives.',
      'For those in remote and health-challenging environments, grant divine immunity against diseases and harsh weather.',
      'Father, in the face of insecurity and kidnapping, let Your shadow of protection rest upon all our missionaries.',
      'Lord, where missionaries lack adequate provision, raise covenant helpers and faithful partners for them.',
      'We declare that no weapon fashioned against any of our missionaries shall prosper.',
    ],
    intercession:
      "Father, raise lovers of missions and helpers of missionaries among our brethren. Stir hearts to pray, give, go and support. May Nigeria witness a fresh wave of gospel light, revival and transformation through our missionaries. The gospel shall advance, missionaries shall be preserved, souls shall be saved.",
  },
  {
    day: 17,
    date: 'Sunday, January 18, 2026',
    focus: 'Operation 2030 — Aggressive Soul Winning, Church Planting and Kingdom Advancement',
    scripture: 'Matthew 28:16, 18-20; Acts 22:14-15; Mark 16:15-17',
    message:
      "The Gospel Faith Mission International exists for one central purpose: to preach the gospel of our Lord Jesus Christ. Operation 2030 was birthed as a prophetic vision to raise the number of GOFAMINT branches in Nigeria to over 2,000 by 2030. In 2024 National Evangelists were deployed to the North-East; in 2025 the focus shifted to the South-South and South-East, leading to a new Missionary Region headquartered in Abakaliki. The Vision 2030 train is moving with speed — but every fast-moving divine vision must be powered by prayer, sustained by intercession and defended spiritually.",
    prayer_points: [
      'Father, we thank You for choosing GOFAMINT as one of Your vessels for the continuity of the gospel.',
      'Thank You, Lord, for standing by this Mission for almost seventy years.',
      'We appreciate You for the chosen vessels, past and present, who have faithfully carried this divine assignment.',
      'Father, we thank You for fresh vision and clarity on soul-winning given through Your servant Pastor (Dr.) Elijah Oludele Abina.',
      'We bless Your name for Operation Identification, Operation Open Door and now Operation 2030.',
      'Lord, let Operation 2030 continue to yield abundant harvests of souls for Your glory.',
      'In the name of Jesus, we terminate every power from the pit of hell resisting Operation 2030.',
      'We decree that every church planted through Operation 2030 will continue to grow, expand and multiply.',
      'Father, let the progress of Operation 2030 continually bring joy to Your servant and renew his strength daily.',
      'Lord, grant Pastor Oludimila Olaoluwa grace to run with the vision of Operation 2030 and fulfill divine mandate faithfully.',
      'God of provision, this vision is Your project — we declare there shall be no lack of resources to accomplish it.',
      "O Lord, from this moment, re-orient our hearts as a Mission — let soul-winning become our lifestyle and priority.",
    ],
    intercession:
      'Father, place the burden of Operation 2030 deeply upon our hearts. Help us intercede consistently, sacrificially and strategically. Let no prayer fall to the ground, no effort be wasted, no soul be lost. The vision 2030 shall not fail, the laborers shall not faint, the harvest shall be great, and Christ shall be glorified.',
  },
  {
    day: 18,
    date: 'Monday, January 19, 2026',
    focus: 'O Lord, Let Africa Be Harvested for You',
    scripture: 'Matthew 9:35-38',
    message:
      "During His earthly ministry, Jesus went through cities and villages, teaching and preaching. When He looked upon the multitudes, Scripture tells us He was moved with compassion. That same compassionate gaze rests heavily upon Africa today. Africa is afflicted not only by physical disease but by spiritual and moral crises. These cannot be healed by social reforms alone — they require the wholesome gospel of Jesus Christ. Africa needs Word, Warfare and Welfare. Not everyone is called to go, but everyone can participate as Goers, Givers or Groaners (intercessors who travail in prayer).",
    prayer_points: [
      'Father, we thank You for our past evangelistic efforts in Africa and the harvests You gave us.',
      'Father, we ask for a greater move of Your Spirit to bring spiritual reform, transformation and revival to these continents.',
      'Father, we use GOFAMINT as a point of contact — let the Church in these continents be bold and courageous in sharing the truth of Jesus.',
      'Father, let Your mighty power be tangibly evident in the lives of our ministers and brethren as they share the gospel.',
      'We decree: Africa, your time of salvation has come! Every power of darkness resisting the gospel is overthrown.',
      'Every principality blinding Africa to the light of Christ — be uprooted and destroyed by the power of God.',
      'Father, arise and restore peace, godly fear, love of the brethren and obedience to spiritual authority in GOFAMINT Benin Republic.',
      'Lord, raise men and women across Africa whose hearts are committed to You — bless them financially to support the gospel.',
      'We pray for increased grace upon strong mission fields like Ghana, Benin Republic, Liberia, Togo and Kenya.',
      'Father, release great grace and supernatural help upon struggling mission fields like Cameroon, Sierra Leone, Côte d\'Ivoire and South Africa.',
      'We decree that the AGO African Missions, Pastor (Dr.) Sam Okomolehin, shall receive marvelous help from men and angels.',
      'Father, terminate the spirit of poverty across African Missions fields and supply needs according to Your riches in glory.',
    ],
    intercession:
      "In the name of Jesus, Lord of Harvest, send forth laborers into the harvest fields of Africa. Raise dependable men and women — Goers, Givers and Groaners — whom You can rely upon. The harvest of Africa shall not waste, faithful laborers shall arise, Africa shall be saved, Christ shall be glorified.",
  },
  {
    day: 19,
    date: 'Tuesday, January 20, 2026',
    focus: 'Our General Overseer — Great Revelation, Uncommon Leading, Repositioning Grace, Divine Protection',
    scripture: '1 Samuel 12:6; Psalm 103:1-5; 1 Chronicles 12:32; Jeremiah 23:29',
    message:
      "Every generation requires a man who walks closely with God, hears His heartbeat and courageously leads God's people. When God raises such a leader, He also raises intercessors to uphold his hands. Pastor (Dr.) Elijah Oludele Abina has been a vessel of divine wisdom, unwavering faith and uncommon obedience for decades. True spiritual leadership is not driven by experience or popular opinion — uncommon leading flows from the Holy Spirit. We vividly remember when God instructed our father in the Lord concerning the move to Gospel City; logic and expert counsel opposed it, yet he stood on what God had spoken — and history testifies that obedience to divine leading never fails.",
    prayer_points: [
      'Father, we thank You for the life of Your servant, Pastor (Dr.) E. O. Abina — for calling, anointing and preserving him.',
      'Lord, we thank You for the grace, wisdom, consistency and faithfulness You have bestowed upon him through the years.',
      'Father, we are grateful for the great revelations and uncommon spiritual leading You have entrusted to him.',
      'Lord, open unto Your servant new and higher realms of revelation in Your Word and in the Spirit.',
      'Father, continue to speak to him clearly and unmistakably concerning Your agenda and purpose for the Church.',
      'Let every word that proceeds from his mouth be filled with divine light, truth and power that transforms lives.',
      'Release upon him fresh anointing for apostolic leadership, kingdom advancement and generational impact.',
      'Surround him with men and women of faith, integrity, loyalty and divine insight to help fulfill the vision.',
      'Father, renew his strength daily like the eagle — let Your peace continually guard his heart and mind.',
      'Let no weapon fashioned against him or his family prosper in any form.',
      'Father, surround his home with angels of protection and Your abiding presence.',
      'Father, make his later years more glorious than the former; let his influence increase continually.',
    ],
    intercession:
      'Father, we pray that our General Overseer will never miss Your mark. He shall finish well and finish strong. No tears, sorrow or regret shall accompany his later years. His path shall shine brighter and brighter unto the perfect day.',
  },
  {
    day: 20,
    date: 'Wednesday, January 21, 2026',
    focus: 'Power, Boldness and Zeal to Preach Jesus with Signs and Wonders',
    scripture: 'Acts 1:8; Acts 4:29-33; Mark 16:17-20; Romans 1:16; 2 Timothy 1:6-7; 1 Corinthians 2:4',
    message:
      "The greatest assignment entrusted to the Church is the Great Commission. This mandate cannot be fulfilled by human wisdom or eloquent speech alone — it requires divine power, holy boldness and unquenchable zeal. Jesus made it clear: 'But ye shall receive power, after that the Holy Ghost is come upon you; and ye shall be witnesses unto me.' Power is the evidence of God's presence, boldness is the courage to proclaim Christ in hostile environments, zeal is the spiritual fire that sustains passion for souls, and signs and wonders are God's confirmation upon the preached Word.",
    prayer_points: [
      'Father, I dedicate myself afresh as a vessel for Your glory and a faithful witness of Jesus in my generation.',
      'Lord, purify my heart and cleanse my motives — let my passion for souls be genuine and Spirit-driven.',
      'Father, deliver me from every spirit of fear, timidity, complacency and silence.',
      'Lord, empower me to speak Your Word with conviction, courage and clarity.',
      'O Lord, give me a tongue of fire that cannot be silenced, compromised or intimidated.',
      'Deliver me from spiritual lukewarmness and weariness — rekindle holy fire within me.',
      'Father, make me restless until souls are saved, discipled and established in Your Kingdom.',
      'Fill me afresh with the power of the Holy Spirit and grant me unusual boldness to preach Christ without fear.',
      'Father, empower every pastor and minister in GOFAMINT with fresh fire, wisdom, revelation and boldness.',
      'Lord, empower us to demonstrate the Kingdom of God with supernatural evidence.',
      'Let the fire of evangelism sweep through our churches, campuses, workplaces and communities.',
      'Father, through my obedience and witness, let countless souls be added to Your Kingdom.',
    ],
    intercession:
      'Father, make every member, worker and minister in GOFAMINT a carrier of Your power in 2026. Let our assemblies become solution centers — places of healing, deliverance, salvation and restoration. GOFAMINT is empowered by the Holy Ghost, all members are bold witnesses, the harvest is gathered across nations.',
  },
  {
    day: 21,
    date: 'Thursday, January 22, 2026',
    focus: 'GOFAMINT in Europe, Asia and Australia',
    scripture: 'Luke 2:49',
    message:
      "The Holy Spirit is gathering souls into the Kingdom in large numbers in the continents of the world, even as the rapture of the saints is imminent. Despite massive corruption and apostasy, God is raising agents of revival. We bless the Lord for the presence of GOFAMINT in Europe, Asia and Australia, and the impact we have made there in recent years. Some members in the UK face challenges arising from new immigration policies. The enemy raises opposition — for example, the Anglican Church in the UK just named its first openly liberal female Archbishop of Canterbury. But we are not ignorant of his devices.",
    prayer_points: [
      'Father, we thank You for past evangelistic efforts in Europe, Asia and Australia and the harvests You gave us.',
      'Father, we ask for a greater move of Your Spirit to bring spiritual reform, transformation and revival to these continents.',
      'Father, we pray that the Church in these continents shall be bold and courageous in sharing the truth of Jesus Christ, even in persecution.',
      'Father, let Your mighty power be tangibly evident in the lives of our ministers and brethren as they share the gospel.',
      'Father, open more doors for GOFAMINT in the United Kingdom; cause GOFAMINT to spread there faster this year.',
      "Father, intervene in the immigration situation of Your children currently impacted by government policies — make a way for them by righteous means.",
      'Father, awaken a deep hunger for Your presence in Your people in Belgium — let our assemblies be centers of spiritual renewal.',
      'Holy Spirit, empower Your children in Belgium with boldness, compassion and divine strategies to reach the lost.',
      'Father, strengthen the UAE church to withstand every odd and give all ministers courage to spread the gospel with signs following.',
      'Father, we ask for rapid kingdom expansion in the UAE through GOFAMINT — 2 more branches and extensions to the Gulf.',
      'Father, we ask that Your mercy will shield Australian saints from all strange diseases and sudden death.',
      'Father, we ask for the overrunning fire of revival that will spread from GOFAMINT Australia to all Pacific nations.',
    ],
    intercession:
      'Lord, multiply disciples in GOFAMINT Australia and grant an unstoppable move of Your power among us. Let the fire of revival spread across Europe, Asia and the Pacific from this year forward.',
  },
  {
    day: 22,
    date: 'Friday, January 23, 2026',
    focus: 'Removing Barriers to Unstoppable Church Growth in GOFAMINT',
    scripture: 'Matthew 16:18; Zechariah 4:6-7; Isaiah 57:14; 2 Corinthians 2:11; Acts 12:24',
    message:
      "The Church of Jesus Christ is divinely ordained for unstoppable growth. Yet unseen barriers — spiritual, organisational, relational and internal — slow the pace of God's agenda. Some obstacles are 'hidden yet obvious'; we feel their effects but ignore or overlook their sources. God does not bless what He has not purified. Before increase comes cleansing; before expansion comes alignment. When the Holy Spirit opens our eyes, hidden enemies are exposed and dismantled. What planning, meetings or committees cannot remove, prayer destroys. A praying church moves beyond limitations into divine acceleration.",
    prayer_points: [
      'Father, we thank You for establishing this Mission and making us part of Your end-time Church.',
      'Lord, we thank You for every soul saved, every life transformed and every testimony of Your grace.',
      'O Lord, forgive us in every way we may have contributed, knowingly or unknowingly, to the slow growth of Your Church.',
      'Father, expose and uproot every hidden but obvious obstacle hindering the growth of this Mission.',
      'Lord, silence every voice of division, strife, disunity and confusion within our Mission.',
      'Father, let the fire of revival sweep through every assembly under this Mission.',
      'O Lord, grant our leaders wisdom, boldness and divine direction for strategic and sustainable growth.',
      'Father, frustrate every satanic plan designed to resist the advancement of this Church.',
      'Father, reveal and dismantle every unseen hand or force secretly working against the expansion of this Mission.',
      'In the name of Jesus, we uproot every seed of division, rebellion and discord sown by the enemy among us.',
      'Lord, heal every broken relationship, mistrust and internal conflict weakening our unity.',
      'Father, confirm Your Word among us with signs, wonders and undeniable testimonies of transformation.',
    ],
    intercession:
      'Father, remove every imaginary and real boundary limiting this Mission. Dismantle every barricade standing against limitless growth and expansion. Let Your Church advance unhindered, unstoppable and victorious. The barriers to GOFAMINT growth are removed; our gates are opened continually for unstoppable increase.',
  },
  {
    day: 23,
    date: 'Saturday, January 24, 2026',
    focus: 'GOFAMINT in North and South America',
    scripture: 'Luke 2:49',
    message:
      "GOFAMINT NA launched the 'Elijah Abina Soul Winners Competition' in line with Operation 2030 — now in its third year with modest gains. The church is making progress on the 30.4-acre Gospel City vision; a MasterPlan of the multi-million-dollar dream city was presented at the last annual convention. The GOFAMINT NA Seminary, under Pastor (Dr.) Tosin Oladapo, is in its second academic year, with 109 pioneer students graduating in July 2024. GOFAMINT has been successfully registered in Brazil — we trust the Lord to win many souls in South America using Brazil as our launching pad.",
    prayer_points: [
      'Father, we thank You for Your goodness and faithfulness to GOFAMINT in North America for over 40 years.',
      'Father, bless the visions and initiatives of GOFAMINT North America with amazing results this year.',
      'Father, supply all human, material and spiritual resources needed to carry out the operations of the church.',
      'Father, use the Elijah Abina soul-winner\'s initiative to achieve massive souls\' harvest under Operation 2030.',
      'Father, help GOFAMINT to be fully established in South America — grant us the wherewithal to be fully operational in Brazil this year.',
      'Father, cause every assembly of GOFAMINT in North and South America to be a solution center.',
      'Father, populate all our churches in North and South America with indigenes of the nations.',
      'Father, let Your mighty hand rest on the Chosen Generation and Next Generation ministries in North America.',
      'Father, please help the National Overseer Pastor Taiwo Fagbuyi and his team — let their efforts yield exponential results.',
      'Father, use the GOFAMINT NA Seminary to raise apostolic leaders for Your work in North America.',
      'In the mighty name of Jesus, we receive more than sufficient resources to build the Gospel City without stress or struggle.',
      'Father, come through for our members dealing with finances, academics, jobs and immigration — grant miraculous solutions.',
    ],
    intercession:
      "Father, uphold and sustain GOFAMINT Mexico — bless them with committed members and wisdom for leaders. Establish GOFAMINT solidly in Jamaica and launch them on the wings of grace this year. For GOFAMINT Canada — raise men and women that will sponsor, support, strengthen and stabilise the work, and give us laborers with deep passion for lost souls.",
  },
  {
    day: 24,
    date: 'Sunday, January 25, 2026',
    focus: 'Youths & Students — Contact True Revival and Attract Great Exploits',
    scripture: 'Isaiah 57:15; 2 Chronicles 7:14; Isaiah 40:31; Romans 12:2; Joel 2:28-29; Psalms 51:10',
    message:
      "In an age defined by speed, noise and endless distractions, the Church is confronted with spiritual boredom, lukewarm faith and shallow conversions. The distinct moral identity of Christian youths is under intense pressure. Technology and social media compete aggressively for attention, flooding young hearts with information while starving their spirits of intimacy with God. What the Church urgently needs is a fresh encounter with the holiness, presence and power of God — a return to sincere repentance, fervent prayer, love for God's Word and holy praise. Revived youths transform society and the Church.",
    prayer_points: [
      'Lord, open the eyes of our youths and students to their true spiritual condition and create in them a desperate hunger for You.',
      'Father, on behalf of our youths, we confess their sins corporately and plead for genuine brokenness and repentance.',
      'According to Psalm 51:10, create in them clean hearts, O God, and renew right spirits within them.',
      'Father, ignite in our youths and students a deep hunger for Your Word and pour out Your Spirit afresh.',
      'Lord, purify their hearts from worldly influences, addictions and hopelessness — grant courage to live sanctified lives.',
      'Replace lukewarmness with passionate love for God in the lives of our youths and students.',
      'Father, release a mighty outpouring of the Holy Spirit upon them — empowering them to live and preach the gospel boldly.',
      'Make our youths committed, relevant and available for mentorship as future godly leaders in GOFAMINT.',
      'Father, make them truly the light of the world in their schools, workplaces and communities.',
      'Strengthen all Youth, GSF and NYSC leaders to preach the Word with boldness, conviction and power.',
      'Use our youths for a mighty harvest of souls, shaking nations with the power of the gospel.',
      'Grant them grace to endure, walk in newness of life and preserve the fruits of revival for generations.',
    ],
    intercession:
      'Father, let the long-awaited impact of our youths and students begin to manifest across all our assemblies and institutions. Awaken a revived generation that loves holiness, burns for souls and lives for Your glory.',
  },
  {
    day: 25,
    date: 'Monday, January 26, 2026',
    focus: 'Heaven-Minded, God-Honoring, Dependable Financiers',
    scripture: 'Genesis 26:12; Deuteronomy 8:18; Zechariah 1:17; Acts 4:34-37',
    message:
      "God is the ultimate Source of all wealth — men are merely channels. When God blesses a person, it is never for personal comfort alone, but for Kingdom purpose. Heaven-minded believers understand that wealth is a trust, not a trophy. The advancement of the Church is accelerated when God raises dependable men and women of substance — faithful stewards who can be trusted to fund His vision without murmuring or compromise. The prayer of Jabez teaches us to ask boldly. Your coast is your sphere of influence, increase and productivity; God desires to bring His people to overflow.",
    prayer_points: [
      'Father, we thank You as the Source of all wealth and resources; we acknowledge You as our Provider.',
      'Lord, raise heaven-minded, covenant-keeping financiers who will honor You in all their ways within our Mission.',
      'Father, fill every heart in GOFAMINT with the spirit of generosity and faithful stewardship.',
      'Bless the work of our members\' hands and make them channels of divine supply.',
      'Uproot every spirit of selfishness, greed and financial unfaithfulness from our midst.',
      'Empower us to give joyfully, consistently and sacrificially for Kingdom advancement.',
      'O Lord, raise dependable men and women who will finance Your projects without wavering.',
      'Release divine ideas, businesses, strategies and opportunities that will fund GOFAMINT\'s vision.',
      'Lord, enlarge our coasts and open our lives to supernatural increase.',
      'Grant me the grace of the sons of Issachar — to know what to do and when to do it.',
      'Every power resisting my lifting and advancement — scatter by fire in Jesus\' name.',
      'Make GOFAMINT a testimony of divine abundance and faithful stewardship in our generation.',
    ],
    intercession:
      'Father, raise dependable financiers for GOFAMINT. Trust us with resources for Your vision. Let me be counted among those You will use to fund Your work faithfully and joyfully.',
  },
  {
    day: 26,
    date: 'Tuesday, January 27, 2026',
    focus: 'Executive Council — Sharing the Heartbeat of Our General Overseer for Soul-Winning',
    scripture: 'Numbers 11:16-25',
    message:
      "Two men stand as pillars in GOFAMINT history — the founding General Overseer Pastor (Dr.) R. A. George, and the present General Overseer Pastor (Dr.) Elijah Oludele Abina. In 1979, Pastor George ordered a six-month crash training for fifty Seminary students and released them into the harvest field at once; within years branches sprang up across the nation. Pastor Abina has continued in the same spirit — launching Operation Open Door and Operation Identification, with the fire still burning brighter. If the Executive Council fully catches and carries this evangelistic fire, the entire church will burn with it.",
    prayer_points: [
      'Father, we thank You for the power of the gospel through which You saved our souls and established GOFAMINT.',
      'Thank You, Lord, for the vision You gave to our founding fathers — a vision still bearing fruit.',
      'We bless Your name for our heroes of faith for the mighty exploits You accomplished through them.',
      'Father, we thank You for choosing every member of the present Executive Council.',
      'Grant each of them deep intimacy with You and sustained fellowship with the Holy Spirit.',
      'According to Num 11:16-17, take of the spirit upon Your servant the General Overseer and release it upon every EXCO member.',
      'Renew and deepen the vision for soul-winning in the hearts of all Executive Council members.',
      'Let the anointing for evangelism flow powerfully from the General Overseer, through the EXCO, to all GOFAMINT ministers.',
      'In all their meetings and deliberations, help them give soul-winning the highest priority.',
      'Use the present Executive Council to write another chapter of outstanding success in GOFAMINT\'s evangelistic history.',
      'Bless the lives and families of every Executive Council member with blessings money can buy and blessings money cannot buy.',
      'Protect them from every danger, evil plot and spiritual attack.',
    ],
    intercession:
      'Father, keep the GOFAMINT Executive Council permanently on the firing line of soul-winning. Let the heartbeat of the General Overseer — evangelism and harvest of souls — remain the heartbeat of the EXCO and the entire Mission. May GOFAMINT never lose its evangelistic fire.',
  },
  {
    day: 27,
    date: 'Wednesday, January 28, 2026',
    focus: 'Honoring and Sustaining Our Retired Fathers and Mothers',
    scripture: 'Ecclesiastes 3:1-11; Psalms 92:12-15',
    message:
      "Today's reading presents a timeless truth — there is a season for everything under heaven. The fathers and mothers we are lifting in our prayers today were once vibrant young men and women, full of strength and dreams. They have now entered a quieter season, operating more in the background. While the gift of longevity is a blessing, advancing age brings real limitations: health challenges, reduced strength, dependency. Many of our retirees lived purposeful lives — serving God, nurturing families, building the Church. Now they need divine sustainability, comfort, honor and support.",
    prayer_points: [
      'Father, we thank You for the lives of our fathers and mothers — the retirees — whom You have graciously preserved.',
      'Thank You for the many years of service they rendered to their families, the Church and the community.',
      'Dear Lord, in this season of their lives, draw them closer to You and surround them with Your abiding presence.',
      'Father, where strength has diminished and ability is limited, arise as their help and provider.',
      'Raise helpers for them and bless their children with the capacity and willingness to care for their parents honorably.',
      'Put the spirit of honor, love and responsibility toward parents in the hearts of all the children of our retirees.',
      'Touch the hearts of brethren in the Church to be compassionate and responsive to the needs of our retirees.',
      'Holy Spirit, fill their hearts with joy, peace and contentment — let sadness and loneliness be far from them.',
      'Open doors of reward for them — let them reap the harvest of their labor of love in Your Kingdom.',
      'Grant them divine health and strength; let their remaining days not be marked by pain or distress.',
      'Help them maintain a strong, vibrant relationship with You, walking in faith and hope to the end.',
      'Father, help them finish strong and finish well — enjoying Your love on earth and eternal fellowship in heaven.',
    ],
    intercession:
      'Father, raise covenant helpers for all our retirees. Be their shield, comforter and protector. Sustain them by Your grace until it pleases You to call them home in peace and glory.',
  },
  {
    day: 28,
    date: 'Thursday, January 29, 2026',
    focus: 'Great Grace and Divine Support for Founding Heroes\' Families',
    scripture: 'Psalm 112',
    message:
      "One of the greatest blessings God has given to our world is the gift of godly men and women who lived for His purpose and poured out their lives for others. GOFAMINT stands today as a fruitful vineyard — a place of salvation, healing, restoration, promotion and divine encounters — because of the genuine calling and absolute devotion of our founding General Overseer and his co-laborers. Though many have gone to glory, their works remain alive. One of the noblest ways to honor our late fathers in the faith is to pray intentionally for their families.",
    prayer_points: [
      'Blessed be the God of Pastor Reuben Akinwalere George, who saved him, called him, anointed him and used him as a blessing to our world.',
      'Father, we thank You for the great vision You gave him — a vision that continues to transform lives across generations.',
      'According to Psalm 112:2, we pray that the descendants of Pastor R. A. George will be mighty upon the earth.',
      'Lord, visit every branch of the R. A. George family lineage and establish them in greatness and honor.',
      'Let abundance of spiritual and natural resources rest upon them without measure.',
      'Help every member of that family to discover, connect with and fulfill their God-ordained destinies.',
      'According to Psalm 112:10, let not the lot of the wicked come upon any member of that blessed family.',
      'Every mountain of challenge confronting any of them — be brought low and reduced to nothing.',
      'We declare divine blessings upon all the families of those who labored faithfully with Pastor R. A. George.',
      'Father, release abundance of blessings upon the families of all who have served in the Executive Council of GOFAMINT.',
      'Every battle confronting any member of the families of our heroes of faith — scatter and collapse by the power of God.',
      'Make them shining examples of faith and living reflections of Your glory.',
    ],
    intercession:
      'Father, let our founding General Overseer and all past heroes of faith never lack biological and spiritual children to carry on their divine mandate and vision. Preserve their legacy, multiply their seed, and let their impact continue from generation to generation.',
  },
  {
    day: 29,
    date: 'Friday, January 30, 2026',
    focus: 'Nigeria Shall Rise Again — A Call to National Repentance and Divine Intervention',
    scripture: '2 Chronicles 7:14',
    message:
      "Nigeria is richly endowed by God — blessed with abundant natural resources and resilient, intelligent people. Yet a land of abundance groans under scarcity; a nation filled with potential struggles to shine. There is food in plenty, yet hunger persists. These contradictions remind us that human solutions alone cannot heal Nigeria. Like Nehemiah, when he heard of the broken walls and reproach of Jerusalem, we must rise to pray. We must not deceive ourselves into believing that salvation will come merely through politics or personalities — our nation needs divine intervention.",
    prayer_points: [
      'O God, Creator of Nigeria, we thank You for Your mercy that has preserved our nation.',
      'Thank You, Lord, for the rich endowments You have given Nigeria — both human and material.',
      'Father, we confess that we have sinned as a nation — forgive us our shortcomings and rebellion.',
      'By the blood of Jesus, purge Nigeria from every sin, iniquity and corruption.',
      'O Lord, heal our land — heal our institutions, our communities and our hearts.',
      'We take authority in Christ and dismantle every power and stronghold controlling Nigeria.',
      'Father, grant our leaders a change of heart — let them govern with wisdom, justice, compassion and fear of God.',
      'Lord, help us as citizens to be law-abiding, responsible and committed to righteousness.',
      'According to Psalm 126, turn our captivity, O Lord — restore our joy, prosperity and dignity.',
      'Deliver Nigeria from all forms of oppression — political, economic, social and spiritual.',
      'Father, revive Nigeria\'s economy — restore strength to our currency and stability to our markets.',
      'Lord, arise in Your power and put an end to insecurity, violence and fear.',
    ],
    intercession:
      'Father, put an end to genocide, bloodshed and the destruction of lives and property in Nigeria. Let righteousness, peace and justice prevail. Ignite a nationwide Jesus Revolution that transforms hearts, reforms systems and restores hope. Nigeria is redeemed, Nigeria is restored, Nigeria shall fulfill her destiny.',
  },
  {
    day: 30,
    date: 'Saturday, January 31, 2026',
    focus: 'Enjoying the Season of Great Revival and Great Exploits',
    scripture: 'Joel 3:16-21; Isaiah 60:1-6',
    message:
      "Life is governed by divine contrasts — light and darkness, night and morning, battles and victories. While evil characterises the last days, the same days witness an unprecedented outpouring of the Holy Spirit (Joel 2:28). Throughout this season we have prayed against the works of darkness. Now we must believe that the night has passed and the morning has come. 'Weeping may endure for a night, but joy comes in the morning.' God has visited us as a people. He is calling GOFAMINT to arise and shine — our light has come and His glory is risen upon us. After thirty days of fasting and prayer, the season of celebration has come.",
    prayer_points: [
      'I have every reason to praise the Lord — He has done great things for me.',
      'Father, thank You for the genuine spirit of revival You have released upon our lives and our church.',
      'Thank You for the transformational encounters that have become our portion.',
      'Thank You for the manifestation of Your glory in unprecedented ways in our lives.',
      'Thank You, Lord, for taking Your rightful place in our lives and in GOFAMINT.',
      'We bless You because the power of the flesh and the forces of darkness no longer hold us captive.',
      'Every obstacle has turned into a miracle — thank You, Lord.',
      'We declare forward movement spiritually, ministerially and financially.',
      'No weapon fashioned against us shall prosper anymore.',
      'We receive divine connections and alignments for effective functioning and fruitfulness.',
      "Surely goodness and mercy shall follow us continually.",
      'According to Genesis 26:13, we declare: "We wax great, we go forward, and we grow until we become very great."',
    ],
    intercession:
      'Father, let this new season usher in a continual time of refreshing throughout 2026. Sustain the victories You have given us. Let joy, peace, progress and divine increase abound in our lives and GOFAMINT. The night is over, the morning has come, our joy is permanent, God is glorified — forever in and through us. Hallelujah!',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Vigil guides — 6 special vigil sessions for groups during Victory Month.
// ─────────────────────────────────────────────────────────────────────────────
export const VICTORY_VIGILS = [
  {
    id: 'family-1',
    group: 'Family',
    title: 'Family Vigil 1',
    date: 'Monday, January 5, 2026',
    focus: 'Victory Over Family Challenges and Household Battles',
    scripture: 'Job 5:3-16; Nehemiah 4:14',
    message:
      "Every family — no matter how strong, loving or godly — faces challenges and battles within the home. Some are natural (financial stress, communication breakdown, parenting struggles), while others are deeply spiritual (household enemies, generational curses, addictions). If left unchecked, these issues can weaken the bond of love, drain spiritual vitality and tear families apart. God never designed the family to be a battlefield of defeat but a sanctuary of love, peace and His abiding presence.",
    discussion: [
      'What are some common family challenges we face today, and how do they compare with challenges faced by biblical families?',
      'How can financial stress affect love, unity and spirituality in the home?',
      'What practical steps can couples take to improve communication and reduce strife in marriage?',
      'In what ways do household enemies (Micah 7:6) manifest in today\'s families, and how should believers respond?',
      'How does the absence of a family altar (prayer, devotion, worship) open the door to household battles?',
      'What role do forgiveness and love play in securing victory over both natural challenges and spiritual battles?',
    ],
    prayer_points: [
      'Father, I thank You because my family is ordained for blessing and not for defeat.',
      'Every power assigned to sow division and strife in my household — be scattered in the name of Jesus.',
      'Lord, supply all the financial needs of my family according to Your riches in glory.',
      'We reject sickness, untimely death and affliction in our household — let health and peace reign.',
      'Every root of misunderstanding, bitterness and poor communication in my family — be uprooted.',
      'Father, release wisdom and grace upon us to raise godly children that will bring You glory.',
      'By the blood of Jesus, I break every generational curse and household bondage working against my family.',
      'O Lord, deliver my family from the manipulation of household enemies and unfriendly friends.',
      'Father, restore love, unity and joy in every marriage and home under attack.',
      'Lord, build a hedge of protection around my household against the arrows of the wicked.',
      'We declare that as for us and our household, we shall serve the Lord all the days of our lives.',
      'Father, let our home become a testimony of victory, peace and fruitfulness to the glory of Your name.',
    ],
  },
  {
    id: 'family-2',
    group: 'Family',
    title: 'Family Vigil 2',
    date: 'Monday, January 12, 2026',
    focus: 'Revive Us Again, O Lord, and Make Us a Blessing to Our Generation',
    scripture: 'Psalm 85:6; Genesis 12:1-3',
    message:
      "The cry for revival is not new. The Psalmist prayed, 'Wilt thou not revive us again: that thy people may rejoice in thee?' Revival is God breathing life into dry bones, rekindling dying fires, visiting His people anew. But revival is never for personal satisfaction alone — it is so that we might become blessings to others. Abraham was called, blessed, and then commissioned: 'I will bless thee… and thou shalt be a blessing.' Our prayer is not only 'Lord, revive me' but also 'Lord, make me an agent of revival to my generation.'",
    discussion: [
      'What does revival mean to you personally?',
      'Why must revival start from the home?',
      'How can we practically rebuild broken prayer altars?',
      'What role does forgiveness play in revival?',
      'What are the signs of losing our first love for God?',
      'In what ways can a revived believer be a blessing to his/her community?',
    ],
    prayer_points: [
      'Lord, revive my heart and set me aflame for Your glory.',
      'Father, let revival begin in me and overflow to my family.',
      'O Lord, restore every broken prayer altar in my life and home.',
      'Heal all broken relationships in my family, church and community.',
      'Rekindle my first love for You, O Lord, and renew my hunger for Your Word.',
      'Let there be a fresh outpouring of Your Spirit upon me and my generation.',
      'Father, visit me with divine encounters that will transform my destiny.',
      'Make me and my family channels of blessing to our generation.',
      'Empower me to become an agent of revival in my church and community.',
      'Lord, let this year be marked with undeniable revival and mighty testimonies.',
    ],
  },
  {
    id: 'family-3',
    group: 'Family',
    title: 'Family Vigil 3',
    date: 'Monday, January 19, 2026',
    focus: 'My Family, Arise, Shine and Do Great Exploits',
    scripture: 'Isaiah 60:1; Daniel 11:32',
    message:
      "Every family is ordained by God to be a light in a dark world — a city set on a hill that cannot be hidden. The command 'Arise, shine' is not a suggestion but a divine call to action. To arise means to break free from limitation, stagnation or bondage; to shine means to reflect the glory of God in every aspect of life. Families that know their God will not only survive but do great exploits for His kingdom (Daniel 11:32b). A shining family experiences deliverance from darkness, open heavens, manifestation of God's glory, and grace to serve God and excel in destiny.",
    discussion: [
      'What does it mean for a family to arise and shine in today\'s world?',
      'What are some common forms of darkness families need deliverance from?',
      'How can a family practically walk under open heavens?',
      'In what ways can God\'s glory be seen in a Christian home?',
      'What role does grace play in excelling in life and destiny?',
      'How can families balance prosperity with kingdom building?',
      'What practical steps can our family take to become a blessing to others?',
    ],
    prayer_points: [
      'Father, thank You for making my family a carrier of Your light and glory.',
      'By the blood of Jesus, I decree total deliverance of my family from every power of darkness.',
      'O Lord, let every closed heaven over my family be opened now in Jesus\' name.',
      'Father, let Your glory overshadow my family and make us a testimony.',
      'Lord, release fresh grace upon us to serve You faithfully and fruitfully.',
      'Father, empower every member of my family to excel in life and destiny.',
      'Lord, let our family prosper in health, wisdom and resources.',
      'Father, make our home a center of revival and kingdom expansion.',
      'Lord, break every generational curse and establish generational blessings in my lineage.',
      'Father, let our family altar carry fresh fire for prayer and worship.',
      'O Lord, use our family to raise godly children and impact our community.',
      'Father, let our family arise, shine and do great exploits for Your kingdom.',
    ],
  },
  {
    id: 'youth',
    group: 'Youth',
    title: 'Youth Vigil',
    date: 'Friday, January 9, 2026',
    focus: 'Liberating Your Future From the Cankerworm of Godless Lifestyle',
    scripture: 'Proverbs 14:12; 2 Timothy 3:1-5; 1 John 2:15-17; James 4:7-8',
    message:
      "Every person has a glorious, God-given destiny — a 'mountain top destiny,' not a life of failure or mediocrity. However, sin (waywardness) and spiritual pollution act as 'cankerworms' that hinder destiny fulfillment. With godly courage, we must persevere through challenges, staying focused on our ultimate purpose. Joseph used his pit and prison years as training for his destiny as Prime Minister of Egypt; he fled temptation when Potiphar's wife tried to seduce him. Daniel and his friends refused to pollute themselves with the king's rich food and refused to bow to an idol — and ended up enjoying God's favor and promotion.",
    discussion: [
      'How does a lack of knowledge about our divine destiny (Jer 29:11) make us more susceptible to waywardness and pollution?',
      'How do you reconcile personal dreams and ambitions with "God\'s plan" for your life?',
      'The time of youth is a crucial foundation-laying period. Why is it important to start early in seeking God and His purpose?',
      'In what ways can peer pressure or modern media contribute to "pollution" in young people\'s lives?',
      'Can you share a situation where you had to make a choice between "fitting in" with friends and maintaining your purity?',
      'What practical steps can we take as a youth group to help each other stay pure and focused on our destiny?',
    ],
    prayer_points: [
      'Every power assigned to frustrate my destiny — be frustrated, in Jesus\' name.',
      'Father, anytime I want to make a mistake, direct me aright; anoint my eyes, hands and legs to locate my divine purpose.',
      'My Father, I refuse to be stagnant in life — re-arrange my destiny according to Your divine purpose.',
      'Father, restore me to Your original design and purpose for my life.',
      'Father, connect me with wise friends and mentors who will support me in fulfilling my destiny.',
      'Holy Ghost fire, purge my spirit, soul and body of every pollution; let the Blood of Jesus flush out every contamination.',
      'By the authority of the name of Jesus, I paralyze every destiny polluter assigned against my life.',
      'Every satanic cage or chain holding me captive in waywardness and stagnation — break by fire.',
      'Lord, reveal to me the cankerworms in my life and grant me the strength to overcome them.',
      'Every curse of stagnation and waywardness operating against my destiny — break by fire.',
      'I receive the grace to flee youthful passions and pursue righteousness, faith, love and peace with a pure heart.',
      'Father, restore every wasted year and lost opportunity, and place me back on Your divine schedule for my destiny.',
    ],
  },
  {
    id: 'women',
    group: 'Women',
    title: 'Women Vigil',
    date: 'Friday, January 16, 2026',
    focus: 'Uprooting Satanic Activities From Our Church and Homes',
    scripture: 'Acts 5:1-13; Acts 16:15-26',
    message:
      "It is unfortunate that the tares are always found among the wheat in the church of God. The wheat are the true children of the kingdom while the tares are the agents of Satan. Allowing such satanic agents to thrive in the church will never bring glory to God — they must be uprooted. While we don't put any punitive action against any human being, we must use our spiritual weapons to cast out the evil spirits being used right in our midst. The Bible never told us to spare demons — instead, we are commanded to cast them out. Paul and Silas in Acts 16 is a good example.",
    discussion: [
      'How did Peter discover that Ananias and Sapphira were insincere?',
      'What is the advantage of the word of knowledge and the word of wisdom in the ministry of our ministers?',
      'What is the difference between the manifestation of the gifts of the Spirit (as in Peter\'s life) and levelling allegations against people on suspicion?',
      'Suggest other ways by which we can prevent satanic activities in the church.',
    ],
    prayer_points: [
      'Thank You, Lord, for shedding Your blood for the sanctification of the church.',
      '2 Cor 6:14-18 — Help every one of us in the church to sanctify ourselves and separate our lives from all unclean things.',
      'Help all our ministers to continue to deliver the true message of the word for the liberation of people.',
      'Grant our ministers both the discerning of spirit and the word of knowledge to rid the church of strange elements.',
      'Grant every one of us in the church the genuine heart of repentance and faithfulness to God.',
      'Holy Spirit, please move in the length and breadth of our church to help all our members forsake hidden works of dishonesty.',
      'Dear Lord, strengthen any brethren being falsely accused of demon involvement — that they remain steadfast in the Lord.',
      'Dear Father, let there be light in our church and let all manifestations of darkness disappear.',
      'We stand against all satanic agents and instruments in our church — we declare them null and void.',
      'We release the fire of God all over our church for total destruction of all the works of Satan.',
      'Let there be revival fire to consume all evil works over our churches.',
      'Whatever trouble has been imported into the church by satanic agents — let there be total deliverance and relief.',
    ],
  },
  {
    id: 'men',
    group: 'Men',
    title: 'Men Vigil',
    date: 'Friday, January 23, 2026',
    focus: 'Fortifying Our Homes and Churches Against Worldly Allurements',
    scripture: 'Psalm 127:1; Romans 12:2; 1 John 2:15-17; James 4:7-8',
    message:
      "In these perilous times, the walls of holiness around many homes and churches have been broken down by worldly pleasures, distractions and compromises. The devil no longer fights with open persecution; he seduces through attraction. God is raising a remnant that will fortify their homes and sanctuaries with prayer, purity and power. Like Nehemiah, we must rebuild the broken walls of faith and consecration. Revival begins not in the crowd, but in the closet of prayer in our homes — where parents lead altars of devotion, and in churches that exalt Christ above comfort.",
    discussion: [
      'How does lack of love and unity between husband and wife create broken walls in the home? Who should initiate love?',
      'How does the lack of family devotion affect the family? Whose responsibility is it to be the priest in the house?',
      'How does lack of provision and protection affect the home? Can society have security if leaders cannot provide for their homes? (1 Tim 3:4-5)',
      'What other factors must we take heed of in order to fortify our homes from the perils of the end-time?',
    ],
    prayer_points: [
      'Lord, as men and head of each home, we surrender back to You — take over our homes and churches.',
      'Father, thank You for preserving our lives, homes and churches despite the corruption of this present age.',
      'Lord, forgive us for every compromise that opened the door to worldliness.',
      'Father, deliver us from every worldly pattern and mindset infiltrating our homes and Churches.',
      'Lord, purge our hearts from the love of worldly pleasures and material distractions.',
      'Father, rebuild the broken spiritual walls around our homes and churches.',
      'Lord, separate us from ungodly influences that defile our spirits.',
      'O Lord, restore the altar of prayer and devotion in every GOFAMINT home — and especially that we men wake up to our priesthood duties.',
      'Let every strange fire on the altar of the Church or in our homes be quenched by the fire of the Holy Ghost.',
      'Expose and destroy every satanic agenda hidden in worldly entertainment.',
      'Let holiness return to the GOFAMINT pulpit, the choir and the congregation.',
      'Sanctify GOFAMINT youths and deliver them from the grip of immoral influence.',
      'Lord, fortify GOFAMINT marriages and families against satanic attacks.',
      'Father, ignite fresh fire that will consume spiritual coldness in GOFAMINT.',
      'Holy Spirit, move mightily across our homes, cities and nations with revival fire.',
    ],
  },
  {
    id: 'general',
    group: 'General',
    title: 'General Vigil',
    date: 'Friday, January 30, 2026',
    focus: 'Dealing With Obvious and Hidden Obstacles to Revival and Church Growth',
    scripture: 'Psalm 139:23-24; Isaiah 6:5-8; Ezekiel 36:26-27; Joel 2:12-13; Isaiah 2:2-3',
    message:
      "Every move of God faces resistance — both seen and unseen. Revival does not fail because God is unwilling, but because obstacles remain unbroken. Some barriers are visible — fear, disunity, complacency, sin, prayerlessness. Others are hidden — pride, unbelief, wrong motives, lack of discernment. God reveals obstacles so we can confront them through repentance and prayer. Until we clear the hindrances, the rain of revival cannot fully fall. A pure heart, united spirit and obedient people attract divine visitation. This is the time to break barriers and usher in a new wave of God's power.",
    discussion: [
      'What are the mountains, challenges and obstacles that confront us today as believers in securing strategic positioning?',
      'What is the "big picture" that God has on our strategic positioning according to Zech 1:17?',
      'Discuss the importance of possessing the seven mountains of influence (Religion, Family, Education, Science/Technology, Commerce, Politics, Arts/Entertainment) — to what extent do we have GOFAMINT members fully entrenched on these mountains?',
      'How can we download the seven realms obtained for us by Jesus (Rev 5:12) by His sevenfold Spirit operation (Isaiah 11:2)?',
    ],
    prayer_points: [
      'Lord, search us deeply and expose every hidden flaw or motive that hinders revival and growth in our lives and churches.',
      'Father, purge every vessel You intend to use for revival — make us ready and available.',
      'Lord, replace our stony hearts with hearts of flesh — tender, teachable and obedient to Your Spirit.',
      'Help Your Church return to sincere repentance, fasting and brokenness that births genuine revival.',
      'Deliver us from unbelief and spiritual complacency that limit Your move among us.',
      'Stir up a fresh spirit of intercession and sacrifice that breaks strongholds in our mission.',
      'Lord, let the fire of the Holy Ghost rest upon our leaders, workers and members for end-time revival.',
      'Give every member of GOFAMINT a united heart and renewed zeal to build and advance the Kingdom.',
      'Father, breathe life into every weak department, cold altar and dry congregation — send revival again.',
      'Go before GOFAMINT, Lord, and remove every crooked system, hidden agenda or unseen resistance.',
      'O Lord, let Your Heavenly Carpenters defray all the scattering horns against our greatness and strategic growth.',
      'By the power of the Holy Spirit, grant us divine re-positioning for strategic take-over of significant mountains for You.',
      'Father, let the fire of revival spread beyond our assemblies — across cities, nations and continents!',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Lookups + helpers (the screens read these by name, never index VICTORY_DAYS
// directly, so the data file can grow / shrink without screen changes).
// ─────────────────────────────────────────────────────────────────────────────
const PLACEHOLDER = {
  day:           0,
  date:          '',
  focus:         'Arriving soon',
  scripture:     '',
  message:       '',
  prayer_points: [],
  intercession:  '',
};

export const getDay = (n) => {
  const idx = Math.max(1, Math.min(VICTORY_DAYS.length, Number(n) || 1)) - 1;
  return VICTORY_DAYS[idx] || { ...PLACEHOLDER, day: idx + 1 };
};

export const getVigil = (id) =>
  VICTORY_VIGILS.find((v) => v.id === id) || null;

export const TOTAL_DAYS  = VICTORY_DAYS.length;
export const TOTAL_VIGILS = VICTORY_VIGILS.length;
export const HAS_CONTENT  = VICTORY_DAYS.some((d) => d.focus && d.focus !== 'Arriving soon');

// ─────────────────────────────────────────────────────────────────────────────
// Today's day index — uses Jan 2 2026 as Day 1 and wraps to the closest valid
// day so the home screen always has something current to surface. Outside the
// fasting window (Jan 2 - 31) this falls back to Day 1.
// ─────────────────────────────────────────────────────────────────────────────
export const todayDayIndex = () => {
  const today = new Date();
  const start = new Date(2026, 0, 2);   // Jan 2 2026
  const diff  = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
  if (diff >= 1 && diff <= TOTAL_DAYS) return diff;
  // Outside the window — surface today's calendar date modulo the run length
  // so the screen is never stuck on Day 1 (preview-friendly).
  const wrapped = ((new Date().getDate() - 1) % TOTAL_DAYS) + 1;
  return Math.max(1, Math.min(TOTAL_DAYS, wrapped));
};
