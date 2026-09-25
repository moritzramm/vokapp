import { useMemo, useState } from 'react';
import { COMMON_LANGUAGES } from '../lib/languages';
import { LIMITS } from '../lib/validation';
import { valueOf } from './fields';

const OTHER = '__other__';

interface Props {
  source: string;
  target: string;
  onChange: (pair: { sourceLanguage: string; targetLanguage: string }) => void;
  /** Languages the user already uses; offered in addition to the common ones. */
  usedLanguages: string[];
}

/**
 * Both languages in one row with a swap button. Each side is a select with
 * common languages plus "Andere Sprache …" for free text. Option values are
 * URI-encoded because select values must not contain spaces.
 */
export function LanguagePairField({ source, target, onChange, usedLanguages }: Props) {
  const options = useMemo(() => {
    const set = new Set([...usedLanguages, ...COMMON_LANGUAGES]);
    return [...set].sort((a, b) => a.localeCompare(b, 'de'));
  }, [usedLanguages]);

  return (
    <fieldset className="language-pair">
      <legend className="wa-visually-hidden">Sprachen</legend>
      <div className="language-pair-row">
        <LanguageSelect label="Ausgangssprache" value={source} options={options} onChange={(sourceLanguage) => onChange({ sourceLanguage, targetLanguage: target })} />
        <wa-button
          appearance="plain"
          size="m"
          className="swap-button"
          aria-label="Sprachen tauschen"
          title="Sprachen tauschen"
          onClick={() => onChange({ sourceLanguage: target, targetLanguage: source })}
        >
          <wa-icon name="arrow-right-arrow-left"></wa-icon>
        </wa-button>
        <LanguageSelect label="Zielsprache" value={target} options={options} onChange={(targetLanguage) => onChange({ sourceLanguage: source, targetLanguage })} />
      </div>
    </fieldset>
  );
}

function LanguageSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const [custom, setCustom] = useState(() => value !== '' && !options.includes(value));
  const showCustom = custom || (value !== '' && !options.includes(value));

  return (
    <div className="language-select">
      <wa-select
        label={label}
        size="l"
        required={!showCustom}
        value={showCustom ? OTHER : value ? encodeURIComponent(value) : ''}
        placeholder={label}
        onInput={(e) => {
          const raw = valueOf(e);
          if (raw === OTHER) {
            setCustom(true);
            onChange('');
          } else {
            setCustom(false);
            onChange(decodeURIComponent(raw));
          }
        }}
      >
        {options.map((language) => (
          <wa-option key={language} value={encodeURIComponent(language)}>
            {language}
          </wa-option>
        ))}
        <wa-divider></wa-divider>
        <wa-option value={OTHER}>Andere Sprache …</wa-option>
      </wa-select>
      {showCustom ? (
        <wa-input label={`${label} (eigene)`} placeholder="Sprache eingeben" size="l" required maxlength={LIMITS.language} autocapitalize="words" value={value} onInput={(e) => onChange(valueOf(e))}></wa-input>
      ) : null}
    </div>
  );
}
