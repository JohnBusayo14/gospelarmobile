// services/comingSoon.js
// A class is "coming soon" when the server has no units for it. Driven by the
// data rather than a hard-coded list, so a class reopens as soon as content is
// published — no app release needed. Only a successful, empty response counts;
// a network error never marks a class as coming soon.

import { useEffect, useState } from 'react';
import { fetchUnits } from './api';

const CATEGORY_IDS = ['adult', 'youth', 'intermediate', 'children'];

export function useComingSoonCategories(lang = 'en') {
  const [comingSoon, setComingSoon] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    Promise.all(CATEGORY_IDS.map((id) =>
      fetchUnits(lang, id)
        .then((units) => (Array.isArray(units) && units.length === 0 ? id : null))
        .catch(() => null),
    )).then((ids) => {
      if (!cancelled) setComingSoon(new Set(ids.filter(Boolean)));
    });
    return () => { cancelled = true; };
  }, [lang]);

  return comingSoon;
}
