// Server/build-time localization of the FINAL reviewed source. Never apply the
// Chinese editorial replacement pipeline to already translated text.
import messages from './messages.json';
import glossaryMessages from './glossary.json';
import week01 from './week-01.json';
import week02 from './week-02.json';
import week03 from './week-03.json';
import week04 from './week-04.json';
import week05 from './week-05.json';
import week06 from './week-06.json';
import week06Continuation from './week-06-continuation.json';
import week07 from './week-07.json';
import week08 from './week-08.json';
import week09 from './week-09.json';
import week10 from './week-10.json';
import week11 from './week-11.json';
import week12 from './week-12.json';
import appendix from './appendix.json';
import { getCourse } from '../course-runtime';
import { GLOSSARY_ENTRIES } from '../glossary';
import { loadCourse } from '../load-course';
import { isCoursePath, localePath, type CourseLocale } from '../course-paths';

const dictionary: Readonly<Record<string, string>> = messages;
const unitDictionaries: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  'week-01': week01,
  'week-02': week02,
  'week-03': week03,
  'week-04': week04,
  'week-05': week05,
  'week-06': { ...week06, ...week06Continuation },
  'week-07': week07,
  'week-08': week08,
  'week-09': week09,
  'week-10': week10,
  'week-11': week11,
  'week-12': week12,
  'mini-gpt-reference': appendix,
};
const protectedFields = new Set([
  'id',
  'aliases',
  'sectionId',
  'unitId',
  'reviewSectionId',
  'source',
  'sourceFilename',
  'version',
  'slug',
  'filename',
]);

/** Exact source strings are translation keys: an edited source becomes missing
 * instead of silently displaying an outdated translation. IDs are never translated. */
export function translateValue<T>(
  value: T,
  missing: Set<string>,
  field = '',
  lexicon = dictionary,
): T {
  if (protectedFields.has(field)) return value;
  if (typeof value === 'string') {
    if ((field === 'href' || field === 'route') && isCoursePath(value))
      return localePath(value, 'en') as T;
    if (Object.hasOwn(lexicon, value)) return lexicon[value] as T;
    if (/\p{Script=Han}/u.test(value)) missing.add(value);
    return value;
  }
  if (Array.isArray(value))
    return value.map((item) =>
      translateValue(item, missing, field, lexicon),
    ) as T;
  if (value && typeof value === 'object') {
    if (
      'slug' in value &&
      typeof value.slug === 'string' &&
      unitDictionaries[value.slug]
    )
      lexicon = { ...dictionary, ...unitDictionaries[value.slug] };
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        translateValue(item, missing, key, lexicon),
      ]),
    ) as T;
  }
  return value;
}

let english: ReturnType<typeof buildEnglish> | undefined;
/** Glossary aliases are reader-facing search terms, unlike stable section aliases. */
export function translateGlossary(missing: Set<string>) {
  const lexicon = { ...dictionary, ...glossaryMessages };
  return GLOSSARY_ENTRIES.map((entry) => ({
    ...translateValue(entry, missing, '', lexicon),
    aliases: [
      ...new Set(
        entry.aliases.map((alias) =>
          translateValue(alias, missing, '', lexicon),
        ),
      ),
    ],
  }));
}

function buildEnglish() {
  const missing = new Set<string>();
  const course = loadCourse(translateValue(getCourse(), missing));
  const glossary = translateGlossary(missing);
  return {
    locale: 'en' as const,
    course,
    glossary,
    untranslatedCount: missing.size,
  };
}

export function getLocalizedCourse(locale: CourseLocale) {
  if (locale === 'zh')
    return {
      locale,
      course: getCourse(),
      glossary: GLOSSARY_ENTRIES,
      untranslatedCount: 0,
    };
  english ??= buildEnglish();
  return english;
}
