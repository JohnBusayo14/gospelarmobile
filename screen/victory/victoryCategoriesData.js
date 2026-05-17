// screen/victory/victoryCategoriesData.js
// ─────────────────────────────────────────────────────────────────────────────
// Prayer categories — 9 spiritual gathering types, each with a curated starter
// set of prayers the user can pray immediately and a category-specific accent.
//
// Users can also append their own prayers to any category (stored via
// victoryStore.addCategoryPrayer).
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORIES = [
  {
    id: 'family-vigil',
    name: 'Family Vigil',
    blurb: 'Pray together as a household',
    emoji: '🏡',
    accent:    '#1A56DB',
    accentBg:  '#EFF6FF',
    gradient: ['#1E3A8A', '#3B82F6'],
    starters: [
      { id:'fv-1', title:'Cover Over the Home',           scripture:'Job 1:10',           body:'Father, build a hedge of protection around every member of this household. Let no evil come near our dwelling.' },
      { id:'fv-2', title:'Unity of Heart',                scripture:'Psalm 133:1',        body:'Lord, knit our hearts together. Where there is misunderstanding, send Your peace. Where there is bitterness, send Your healing.' },
      { id:'fv-3', title:'Generational Blessing',         scripture:'Joshua 24:15',       body:'As for me and my house, we will serve the Lord. Break every generational curse and establish generational blessing.' },
      { id:'fv-4', title:'Children Taught of the Lord',   scripture:'Isaiah 54:13',       body:'Teach our children Your ways. Let them grow in wisdom, in stature and in favour with You and with people.' },
      { id:'fv-5', title:'Provision for the Home',        scripture:'Philippians 4:19',   body:'Supply every need of this family according to Your riches in glory in Christ Jesus.' },
    ],
  },
  {
    id: 'youth-vigil',
    name: 'Youth Vigil',
    blurb: 'Fire for the next generation',
    emoji: '🔥',
    accent:    '#4F46E5',
    accentBg:  '#EEF2FF',
    gradient: ['#3730A3', '#6366F1'],
    starters: [
      { id:'yv-1', title:'Purity in Christ',              scripture:'1 Timothy 4:12',    body:'Father, let our youth be examples in speech, conduct, love, faith and purity. Set us apart from every form of compromise.' },
      { id:'yv-2', title:'Destiny Unlocked',              scripture:'Jeremiah 29:11',    body:'Reveal Your plans for our lives — plans of welfare and not evil, to give us a future and a hope.' },
      { id:'yv-3', title:'Renewed Mind',                  scripture:'Romans 12:2',       body:'Transform our minds. Deliver us from every pattern of this world that wars against our calling.' },
      { id:'yv-4', title:'Bold Witness',                  scripture:'Acts 4:29',         body:'Grant Your servants boldness to speak Your Word. Let signs and wonders confirm the message we carry to our generation.' },
      { id:'yv-5', title:'Holy Friendships',              scripture:'Proverbs 13:20',    body:'Connect us with companions who love You. Remove every relationship that pulls us away from Your presence.' },
    ],
  },
  {
    id: 'midnight',
    name: 'Midnight Prayer',
    blurb: 'War in the watches of the night',
    emoji: '🌙',
    accent:    '#7C3AED',
    accentBg:  '#F3E8FF',
    gradient: ['#4C1D95', '#7C3AED'],
    starters: [
      { id:'mn-1', title:'Arrows in the Night',           scripture:'Psalm 91:5',        body:'I shall not be afraid of the terror by night nor of the arrow that flies by day. Cover me under Your wings, O God.' },
      { id:'mn-2', title:'Songs at Midnight',             scripture:'Acts 16:25',        body:'As Paul and Silas sang, every chain be loosed and every prison door be opened around my life and family.' },
      { id:'mn-3', title:'Watchmen on the Wall',          scripture:'Isaiah 62:6',       body:'Lord, post angelic watchmen on the walls of my life. Let nothing the enemy plans against me prosper.' },
      { id:'mn-4', title:'Reverse the Verdicts',          scripture:'Daniel 7:22',       body:'Father, judgment is given in favour of Your saints. Reverse every evil verdict spoken against me at midnight.' },
      { id:'mn-5', title:'Heavens Open at Night',         scripture:'Genesis 28:12',     body:'Let the heavens open over me as I wait on You. Show me what I cannot see by day.' },
    ],
  },
  {
    id: 'thanksgiving',
    name: 'Thanksgiving',
    blurb: 'A heart of gratitude',
    emoji: '🌾',
    accent:    '#F59E0B',
    accentBg:  '#FEF3C7',
    gradient: ['#92400E', '#F59E0B'],
    starters: [
      { id:'tg-1', title:'For Salvation',                 scripture:'Psalm 103:1-2',     body:'Bless the Lord, O my soul, and forget not all His benefits — chief of which is the salvation of my soul.' },
      { id:'tg-2', title:'For Daily Bread',               scripture:'Matthew 6:11',      body:'Thank You, Lord, for every meal, every breath, every provision. You are my Jehovah Jireh.' },
      { id:'tg-3', title:'For Sustaining Grace',          scripture:'Lamentations 3:23', body:'Your mercies are new every morning. Great is Your faithfulness — even in seasons I did not deserve it.' },
      { id:'tg-4', title:'For Family and Friends',        scripture:'Philippians 1:3',   body:'I thank my God upon every remembrance of the people You have placed around me. They are gifts.' },
      { id:'tg-5', title:'For Answered Prayer',           scripture:'1 John 5:14',       body:'You hear us. You answer. Thank You for every prayer You have already answered and every one You are answering still.' },
    ],
  },
  {
    id: 'healing',
    name: 'Healing',
    blurb: 'By His stripes — wholeness',
    emoji: '🩹',
    accent:    '#0EA5E9',
    accentBg:  '#E0F2FE',
    gradient: ['#0C4A6E', '#0EA5E9'],
    starters: [
      { id:'hl-1', title:'Body Restored',                 scripture:'Isaiah 53:5',       body:'By His stripes I am healed. Every cell in my body align with Your Word. Every disease bow to Jesus.' },
      { id:'hl-2', title:'Mind Made Whole',               scripture:'2 Timothy 1:7',     body:'You have not given me a spirit of fear, but of power, love and a sound mind. Heal my anxieties; restore peace.' },
      { id:'hl-3', title:'Emotional Healing',             scripture:'Psalm 147:3',       body:'You heal the broken-hearted and bind up their wounds. Lord, mend every hidden hurt.' },
      { id:'hl-4', title:'Healing for Loved Ones',        scripture:'James 5:14-15',     body:'I lift up the names of those in pain or sickness. Stretch forth Your hand and heal them in Jesus\' name.' },
      { id:'hl-5', title:'Healed to Heal Others',         scripture:'2 Corinthians 1:4', body:'You comfort us so that we may comfort others. Use my testimony of healing to lead someone else to wholeness.' },
    ],
  },
  {
    id: 'breakthrough',
    name: 'Breakthrough',
    blurb: 'Walls fall — gates open',
    emoji: '🔓',
    accent:    '#DC2626',
    accentBg:  '#FEE2E2',
    gradient: ['#7F1D1D', '#DC2626'],
    starters: [
      { id:'bt-1', title:'Walls of Jericho',              scripture:'Joshua 6:20',       body:'Every Jericho wall standing between me and my promise — fall, in Jesus\' name. I march by faith and shout victory.' },
      { id:'bt-2', title:'Open Doors',                    scripture:'Revelation 3:8',    body:'You set before me an open door no one can shut. Lord, open doors of opportunity, of favour, of breakthrough.' },
      { id:'bt-3', title:'Financial Release',             scripture:'Deuteronomy 8:18',  body:'You give me power to get wealth to establish Your covenant. Release wisdom, ideas and supply.' },
      { id:'bt-4', title:'Waiting Made New',              scripture:'Habakkuk 2:3',      body:'Though the vision tarries, it will surely come. Lord, accelerate my promise.' },
      { id:'bt-5', title:'New Levels',                    scripture:'Isaiah 43:19',      body:'Behold, You do a new thing. Make a way in my wilderness and rivers in my desert.' },
    ],
  },
  {
    id: 'deliverance',
    name: 'Deliverance',
    blurb: 'Freedom is the children\'s bread',
    emoji: '⚔️',
    accent:    '#0F766E',
    accentBg:  '#CCFBF1',
    gradient: ['#134E4A', '#14B8A6'],
    starters: [
      { id:'dl-1', title:'Bondage Broken',                scripture:'Galatians 5:1',     body:'It is for freedom that Christ has set me free. Every chain on my mind, body and destiny — break by fire.' },
      { id:'dl-2', title:'Soul Ties Severed',             scripture:'1 Corinthians 6:17',body:'I sever every ungodly soul tie. I am joined to the Lord and one spirit with Him.' },
      { id:'dl-3', title:'Generational Patterns',         scripture:'Galatians 3:13',    body:'Christ has redeemed me from every curse. I reject every recurring negative pattern in my family line.' },
      { id:'dl-4', title:'Addictions Broken',             scripture:'John 8:36',         body:'Whom the Son sets free is free indeed. I command every addiction over my life to bow to Jesus.' },
      { id:'dl-5', title:'Fear Cast Out',                 scripture:'1 John 4:18',       body:'Perfect love casts out fear. Holy Spirit, fill me afresh and replace every fear with bold faith.' },
    ],
  },
  {
    id: 'personal',
    name: 'Personal Prayer',
    blurb: 'Your own walk with God',
    emoji: '✨',
    accent:    '#10B981',
    accentBg:  '#D1FAE5',
    gradient: ['#065F46', '#10B981'],
    starters: [
      { id:'pp-1', title:'Closer Walk',                   scripture:'Psalm 27:4',        body:'One thing I have desired — to dwell in Your house and behold Your beauty. Draw me near, Lord.' },
      { id:'pp-2', title:'Hearing His Voice',             scripture:'John 10:27',        body:'I am Your sheep — I hear Your voice. Sharpen my discernment; quiet the noise.' },
      { id:'pp-3', title:'Purpose Aligned',               scripture:'Psalm 138:8',       body:'You will perfect that which concerns me. Align me with the path You ordained before I was formed.' },
      { id:'pp-4', title:'Strength for Today',            scripture:'Isaiah 40:31',      body:'Those who wait on the Lord shall renew their strength. Today, I receive supernatural strength.' },
      { id:'pp-5', title:'Joy Restored',                  scripture:'Psalm 51:12',       body:'Restore unto me the joy of my salvation. Let Your joy be my strength.' },
    ],
  },
  {
    id: 'others',
    name: 'Others',
    blurb: 'For the world we live in',
    emoji: '🌍',
    accent:    '#475569',
    accentBg:  '#F1F5F9',
    gradient: ['#1E293B', '#475569'],
    starters: [
      { id:'ot-1', title:'For My Nation',                 scripture:'1 Timothy 2:1-2',   body:'I lift up the leaders of my nation. Grant wisdom, righteousness and the fear of God in their hearts.' },
      { id:'ot-2', title:'For Persecuted Believers',      scripture:'Hebrews 13:3',      body:'Remember those in chains as if you were bound with them. Strengthen Your church in every nation of suffering.' },
      { id:'ot-3', title:'For Missionaries',              scripture:'Matthew 9:38',      body:'Lord of the harvest, send out workers. Protect and provide for every missionary on the front lines.' },
      { id:'ot-4', title:'For My Workplace',              scripture:'Colossians 3:23',   body:'Bless the place You have planted me. Make me salt and light in my workplace. Use me there.' },
      { id:'ot-5', title:'For the Lost',                  scripture:'2 Peter 3:9',       body:'You are not willing that any should perish. Draw the lost — open eyes, soften hearts, send labourers.' },
    ],
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export const getCategory = (id) => CATEGORY_BY_ID[id] || CATEGORIES[0];
